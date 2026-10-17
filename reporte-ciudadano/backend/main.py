"""
API de Banqueta — reporte ciudadano inteligente.

Ejecutar (desde la carpeta del proyecto):
    .venv\\Scripts\\python -m uvicorn main:app --app-dir backend --reload
"""

from __future__ import annotations

import json
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from PIL import UnidentifiedImageError
from pydantic import BaseModel, Field

import clasificador
import db
from config import CIUDAD, TAMANO_MAX_MB, TESELAS

RAIZ = Path(__file__).resolve().parent.parent
CARPETA_FOTOS = Path(__file__).resolve().parent / "datos" / "fotos"
CARPETA_FOTOS.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Banqueta · Reporte ciudadano")
db.iniciar()


# ---------------------------------------------------------------------------
# Modelos
# ---------------------------------------------------------------------------

class NuevoReporte(BaseModel):
    borrador_id: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    referencia: Optional[str] = Field(default=None, max_length=140)
    comentario: Optional[str] = Field(default=None, max_length=600)
    categoria_corregida: Optional[Literal["bache", "fuga", "basura", "otro"]] = None


class CambioEstado(BaseModel):
    estado: Literal["recibido", "en_revision", "en_proceso", "resuelto"]


# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------

@app.get("/api/config")
def configuracion():
    return {"ciudad": CIUDAD, "teselas": TESELAS, "motor": "claude" if clasificador.claude_disponible() else "local",
            "modelo": clasificador.MODELO_CLAUDE}


@app.post("/api/analizar")
async def analizar(foto: UploadFile = File(...)):
    datos = await foto.read()
    if len(datos) > TAMANO_MAX_MB * 1024 * 1024:
        raise HTTPException(413, f"La foto pesa más de {TAMANO_MAX_MB} MB.")
    try:
        img, gps = clasificador.preparar_imagen(datos)
    except (UnidentifiedImageError, OSError):
        raise HTTPException(415, "No pudimos leer el archivo. Sube una foto JPG, PNG o WEBP.")

    analisis = await run_in_threadpool(clasificador.clasificar, img)

    borrador_id = uuid.uuid4().hex
    nombre = f"{borrador_id}.jpg"
    (CARPETA_FOTOS / nombre).write_bytes(clasificador.a_jpeg(img, calidad=82))
    with db.conectar() as con:
        con.execute("INSERT INTO borradores VALUES (?,?,?,?)",
                    (borrador_id, nombre, json.dumps(analisis), db.ahora()))
    return {"borrador_id": borrador_id, "imagen_url": f"/uploads/{nombre}", "gps": gps, **analisis}


@app.get("/api/reportes")
def listar(categoria: Optional[str] = None, estado: Optional[str] = None, gravedad_min: int = 1):
    sql, args = "SELECT * FROM reportes WHERE gravedad >= ?", [gravedad_min]
    if categoria:
        sql += " AND categoria = ?"
        args.append(categoria)
    if estado:
        sql += " AND estado = ?"
        args.append(estado)
    with db.conectar() as con:
        filas = [db.a_dict(f) for f in con.execute(sql + " ORDER BY creado DESC", args)]
    return filas


@app.get("/api/reportes/cercanos")
def cercanos(lat: float, lng: float, categoria: str, radio: float = 60):
    """Reportes abiertos de la misma categoría a menos de `radio` metros (para evitar duplicados)."""
    with db.conectar() as con:
        filas = con.execute("SELECT * FROM reportes WHERE categoria = ? AND estado != 'resuelto'",
                            (categoria,)).fetchall()
    resultado = []
    for f in filas:
        d = db.distancia_m(lat, lng, f["lat"], f["lng"])
        if d <= radio:
            resultado.append({**db.a_dict(f), "distancia_m": round(d)})
    return sorted(resultado, key=lambda r: r["distancia_m"])


@app.post("/api/reportes", status_code=201)
def crear(datos: NuevoReporte):
    with db.conectar() as con:
        borrador = con.execute("SELECT * FROM borradores WHERE id = ?", (datos.borrador_id,)).fetchone()
        if not borrador:
            raise HTTPException(404, "El análisis expiró. Vuelve a subir la foto.")
        a = json.loads(borrador["analisis"])
        categoria = datos.categoria_corregida or a["categoria"]
        if categoria != a["categoria"]:
            a.update(dependencia=clasificador.DEPENDENCIAS[categoria],
                     sla_horas=clasificador.SLA_HORAS[categoria][a["gravedad"] - 1])
        t = db.ahora()
        cur = con.execute(
            """INSERT INTO reportes (categoria, categoria_ia, gravedad, confianza, titulo, descripcion, factores,
                riesgos, dependencia, sla_horas, motor, lat, lng, referencia, comentario, imagen, estado,
                apoyos, creado, actualizado)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'recibido',0,?,?)""",
            (categoria, a["categoria"], a["gravedad"], a["confianza"], a["titulo"], a["descripcion"],
             json.dumps(a["factores"]), json.dumps(a["riesgos"]), a["dependencia"], a["sla_horas"], a["motor"],
             datos.lat, datos.lng, (datos.referencia or "").strip() or None,
             (datos.comentario or "").strip() or None, borrador["imagen"], t, t),
        )
        nuevo_id = cur.lastrowid
        con.execute("UPDATE reportes SET folio = ? WHERE id = ?", (f"BQ-{1000 + nuevo_id}", nuevo_id))
        con.execute("DELETE FROM borradores WHERE id = ?", (datos.borrador_id,))
        return db.a_dict(con.execute("SELECT * FROM reportes WHERE id = ?", (nuevo_id,)).fetchone())


@app.get("/api/reportes/{rid}")
def detalle(rid: int):
    with db.conectar() as con:
        f = con.execute("SELECT * FROM reportes WHERE id = ?", (rid,)).fetchone()
    if not f:
        raise HTTPException(404, "Reporte no encontrado")
    return db.a_dict(f)


@app.patch("/api/reportes/{rid}")
def cambiar_estado(rid: int, cambio: CambioEstado):
    with db.conectar() as con:
        cur = con.execute("UPDATE reportes SET estado = ?, actualizado = ? WHERE id = ?",
                          (cambio.estado, db.ahora(), rid))
        if cur.rowcount == 0:
            raise HTTPException(404, "Reporte no encontrado")
        return db.a_dict(con.execute("SELECT * FROM reportes WHERE id = ?", (rid,)).fetchone())


@app.post("/api/reportes/{rid}/apoyar")
def apoyar(rid: int):
    with db.conectar() as con:
        cur = con.execute("UPDATE reportes SET apoyos = apoyos + 1 WHERE id = ?", (rid,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Reporte no encontrado")
        return db.a_dict(con.execute("SELECT * FROM reportes WHERE id = ?", (rid,)).fetchone())


@app.get("/api/estadisticas")
def estadisticas():
    with db.conectar() as con:
        filas = [db.a_dict(f) for f in con.execute("SELECT * FROM reportes")]
    total = len(filas)
    abiertos = [f for f in filas if f["estado"] != "resuelto"]
    resueltos = [f for f in filas if f["estado"] == "resuelto"]
    hace_7 = datetime.now(timezone.utc) - timedelta(days=7)

    horas_resolucion = [
        (datetime.fromisoformat(f["actualizado"]) - datetime.fromisoformat(f["creado"])).total_seconds() / 3600
        for f in resueltos
    ]
    return {
        "total": total,
        "abiertos": len(abiertos),
        "resueltos": len(resueltos),
        "criticos_abiertos": sum(1 for f in abiertos if f["gravedad"] >= 4),
        "vencidos": sum(1 for f in abiertos if f["vencido"]),
        "ultima_semana": sum(1 for f in filas if datetime.fromisoformat(f["creado"]) >= hace_7),
        "apoyos": sum(f["apoyos"] for f in filas),
        "horas_promedio_resolucion": round(sum(horas_resolucion) / len(horas_resolucion)) if horas_resolucion else None,
        "por_categoria": dict(Counter(f["categoria"] for f in filas)),
        "por_gravedad": {str(g): sum(1 for f in abiertos if f["gravedad"] == g) for g in range(1, 6)},
        "por_estado": {e: sum(1 for f in filas if f["estado"] == e) for e in db.ESTADOS},
        "correcciones_ia": sum(1 for f in filas if f["categoria"] != f["categoria_ia"]),
    }


# Archivos estáticos: fotos subidas y la interfaz React. "/" va al final para no tapar /api.
app.mount("/uploads", StaticFiles(directory=CARPETA_FOTOS), name="fotos")
app.mount("/", StaticFiles(directory=RAIZ / "frontend", html=True), name="frontend")
