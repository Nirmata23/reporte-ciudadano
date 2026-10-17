"""Persistencia en SQLite: reportes ciudadanos y borradores de análisis."""

from __future__ import annotations

import json
import math
import random
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

RUTA_DB = Path(__file__).resolve().parent / "datos" / "reportes.db"

ESTADOS = ("recibido", "en_revision", "en_proceso", "resuelto")

ESQUEMA = """
CREATE TABLE IF NOT EXISTS borradores (
    id TEXT PRIMARY KEY,
    imagen TEXT NOT NULL,
    analisis TEXT NOT NULL,
    creado TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reportes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio TEXT UNIQUE,
    categoria TEXT NOT NULL,
    categoria_ia TEXT NOT NULL,
    gravedad INTEGER NOT NULL,
    confianza INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    factores TEXT,
    riesgos TEXT,
    dependencia TEXT,
    sla_horas INTEGER,
    motor TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    referencia TEXT,
    comentario TEXT,
    imagen TEXT,
    estado TEXT NOT NULL DEFAULT 'recibido',
    apoyos INTEGER NOT NULL DEFAULT 0,
    creado TEXT NOT NULL,
    actualizado TEXT NOT NULL
);
"""


def ahora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def conectar() -> sqlite3.Connection:
    RUTA_DB.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(RUTA_DB)
    con.row_factory = sqlite3.Row
    return con


def iniciar() -> None:
    with conectar() as con:
        con.executescript(ESQUEMA)
        if con.execute("SELECT COUNT(*) FROM reportes").fetchone()[0] == 0:
            _sembrar(con)


def distancia_m(lat1, lng1, lat2, lng2) -> float:
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def prioridad(fila: dict) -> int:
    """Índice 0-100 para ordenar la cola de atención del municipio."""
    if fila["estado"] == "resuelto":
        return 0
    dias = (datetime.now(timezone.utc) - datetime.fromisoformat(fila["creado"])).total_seconds() / 86400
    return int(min(100, fila["gravedad"] * 16 + min(fila["apoyos"], 12) * 1.5 + min(dias, 14) * 0.9))


def a_dict(fila: sqlite3.Row) -> dict:
    d = dict(fila)
    d["factores"] = json.loads(d["factores"] or "[]")
    d["riesgos"] = json.loads(d["riesgos"] or "[]")
    d["imagen_url"] = f"/uploads/{d['imagen']}" if d["imagen"] else None
    d["prioridad"] = prioridad(d)
    vence = datetime.fromisoformat(d["creado"]) + timedelta(hours=d["sla_horas"] or 0)
    d["vence"] = vence.isoformat(timespec="seconds")
    d["vencido"] = d["estado"] != "resuelto" and vence < datetime.now(timezone.utc)
    return d


# ---------------------------------------------------------------------------
# Datos de ejemplo para que el mapa no arranque vacío
# ---------------------------------------------------------------------------

_EJEMPLOS = {
    "bache": [
        ("Bache profundo en carril derecho", "Bache de aprox. 60 cm con bordes desmoronados y fondo expuesto."),
        ("Grietas en cruce peatonal", "Fisuras ramificadas sobre el paso de cebra, sin hundimiento visible."),
        ("Hundimiento junto a coladera", "Pavimento hundido alrededor de la tapa de drenaje, desnivel notorio."),
        ("Bache mediano en ciclovía", "Bache poco profundo que obliga a ciclistas a invadir el carril vehicular."),
    ],
    "fuga": [
        ("Fuga constante en banqueta", "Agua limpia brotando entre losetas, escurre hacia el arroyo vehicular."),
        ("Encharcamiento por tubería", "Charco permanente sin lluvia reciente, con corriente visible."),
        ("Brote fuerte en esquina", "Chorro de agua desde el pavimento, inunda medio carril."),
    ],
    "basura": [
        ("Bolsas acumuladas en esquina", "Seis a ocho bolsas apiladas junto a poste, algunas rotas."),
        ("Tiradero de escombro", "Montículo de cascajo y madera que ocupa la banqueta completa."),
        ("Basura obstruyendo coladera", "Residuos plásticos sobre la rejilla de drenaje pluvial."),
    ],
}
_REFERENCIAS = ("Frente a la tienda de la esquina", "Junto a la parada de bus", "Esquina con la farmacia",
                "A media cuadra del mercado", "Afuera de la escuela", "Frente al parque", None, None)


def _sembrar(con: sqlite3.Connection) -> None:
    from clasificador import DEPENDENCIAS, SLA_HORAS
    from config import CIUDAD

    azar = random.Random(313)
    base = datetime.now(timezone.utc)
    lat0, lng0 = CIUDAD["lat"], CIUDAD["lng"]
    for i in range(34):
        cat = azar.choices(("bache", "fuga", "basura"), weights=(5, 3, 4))[0]
        titulo, desc = azar.choice(_EJEMPLOS[cat])
        gravedad = azar.choices((1, 2, 3, 4, 5), weights=(1, 3, 4, 3, 1))[0]
        # Un tercio muy recientes (menos de 30 h) y el resto repartido en los últimos 9 días
        creado = base - timedelta(hours=azar.uniform(1, 30) if i % 3 == 0 else azar.uniform(1, 24 * 9))
        estado = azar.choices(ESTADOS, weights=(4, 3, 3, 3))[0]
        actualizado = creado if estado == "recibido" else min(base, creado + timedelta(hours=azar.uniform(3, 110)))
        ang, rad = azar.uniform(0, 2 * math.pi), azar.uniform(0.002, 0.03) ** 0.9
        con.execute(
            """INSERT INTO reportes (folio, categoria, categoria_ia, gravedad, confianza, titulo, descripcion,
                factores, riesgos, dependencia, sla_horas, motor, lat, lng, referencia, comentario, imagen,
                estado, apoyos, creado, actualizado)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                f"BQ-{1000 + i}", cat, cat, gravedad, azar.randint(78, 97), titulo, desc,
                json.dumps(["Reporte de ejemplo"]), json.dumps([]),
                DEPENDENCIAS[cat], SLA_HORAS[cat][gravedad - 1], "ejemplo",
                lat0 + math.sin(ang) * rad, lng0 + math.cos(ang) * rad * 1.15,
                azar.choice(_REFERENCIAS), None, None, estado, azar.randint(0, 14),
                creado.isoformat(timespec="seconds"), actualizado.isoformat(timespec="seconds"),
            ),
        )
