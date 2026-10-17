# Banqueta · reporte ciudadano inteligente

Un vecino sube la foto de un **bache**, una **fuga** o **basura**. La IA la clasifica, estima su
gravedad (1–5), explica qué vio y la canaliza a la dependencia correcta con un plazo de atención.
El reporte aparece en un mapa público y en la cola de trabajo del municipio.

## Arrancar

```powershell
.\iniciar.ps1          # crea el entorno la primera vez y abre el servidor
```

Abre <http://127.0.0.1:8000>. La primera vez se cargan 34 reportes de ejemplo para que el mapa no
arranque vacío (para empezar de cero, borra `backend/datos/`).

## Motor de IA

| Modo | Cuándo se usa | Qué hace |
|---|---|---|
| **Claude** | Si existe `ANTHROPIC_API_KEY` | Visión de `claude-opus-5-5` con salida JSON estructurada: categoría, gravedad, confianza, título, descripción, evidencias y riesgos. Tiene activado el *fallback* del lado del servidor: si el modelo declina una imagen, la API reintenta con otro modelo. |
| **Local** | Sin llave, o con `MOTOR_IA=local` | Heurística de color y textura con Pillow. Sirve para demos sin conexión; su confianza tiene un tope de 72% y lo dice en pantalla. |

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
.\iniciar.ps1
```

Si Claude falla (red, cuota, credenciales), el reporte no se pierde: se usa el motor local y se avisa.

## Configuración (variables de entorno)

| Variable | Por defecto | Para qué |
|---|---|---|
| `CIUDAD_NOMBRE`, `CIUDAD_LAT`, `CIUDAD_LNG`, `CIUDAD_ZOOM` | Ciudad de Guatemala | Centro del mapa y zona de los datos de ejemplo |
| `MOTOR_IA` | `auto` | `auto`, `claude` o `local` |
| `MODELO_CLAUDE` | `claude-opus-5-5` | Modelo de visión |
| `TESELAS_URL`, `TESELAS_ATRIBUCION` | OpenStreetMap | Proveedor de mosaicos del mapa |

## Estructura

```
backend/
  main.py          API FastAPI y servidor de la interfaz
  clasificador.py  Motor Claude + motor local, dependencias y plazos por categoría
  db.py            SQLite, prioridad de atención, datos de ejemplo
  config.py        Ciudad, mosaicos, límites
  datos/           reportes.db y fotos (se crea solo)
frontend/
  index.html       Carga React 18, Leaflet y Babel desde CDN
  src/*.jsx        base · portada · reportar · mapa · panel · app
  styles/main.css  Toda la identidad visual
```

### API

| Método | Ruta | |
|---|---|---|
| `GET` | `/api/config` | Ciudad, mosaicos y motor activo |
| `POST` | `/api/analizar` | Sube `foto` (multipart) → análisis + `borrador_id`. Lee el GPS del EXIF si existe |
| `POST` | `/api/reportes` | Crea el reporte desde un borrador + ubicación (permite corregir la categoría) |
| `GET` | `/api/reportes` | Lista con filtros `categoria`, `estado`, `gravedad_min` |
| `GET` | `/api/reportes/cercanos` | Reportes abiertos de la misma categoría a menos de 60 m (evita duplicados) |
| `PATCH` | `/api/reportes/{id}` | Cambia el estado |
| `POST` | `/api/reportes/{id}/apoyar` | “A mí también me afecta” |
| `GET` | `/api/estadisticas` | Indicadores del panel municipal |

## Antes de producción

- **El panel municipal no tiene autenticación.** Cualquiera puede cambiar estados. Agrega login
  (p. ej. OAuth del municipio) antes de publicarlo.
- **React se transpila en el navegador** (Babel standalone) porque este equipo no tiene Node.js.
  Funciona bien para desarrollo; en producción conviene migrar a Vite: los `.jsx` ya están separados
  por componente, basta con agregar `import`/`export`.
- Los mosaicos de `tile.openstreetmap.org` son para uso ligero; en producción usa un proveedor con contrato.
- Los apoyos se limitan por navegador (localStorage), no por persona.

## Derechos de autor

© 2026 apellidos313@gmail.com. Todos los derechos reservados.

El programa Banqueta, su código fuente (backend en Python y frontend en React, HTML y CSS), su diseño
visual y sus textos son propiedad de su autor. Queda prohibido copiarlos, modificarlos, distribuirlos
o usarlos con fines comerciales sin autorización previa y por escrito del autor.

Las bibliotecas y servicios de terceros que usa el proyecto conservan sus propias licencias:
React, Leaflet, Babel, FastAPI, Uvicorn, Pillow y el SDK de Anthropic (licencias de código abierto),
los mosaicos de mapa de OpenStreetMap (ODbL) y las tipografías de Google Fonts (SIL Open Font License).
