import os

# Centro del mapa y datos de ejemplo. Cámbialo con variables de entorno para tu municipio.
CIUDAD = {
    "nombre": os.getenv("CIUDAD_NOMBRE", "Ciudad de Guatemala"),
    "lat": float(os.getenv("CIUDAD_LAT", "14.6265")),
    "lng": float(os.getenv("CIUDAD_LNG", "-90.5155")),
    "zoom": int(os.getenv("CIUDAD_ZOOM", "14")),
}

# Mosaicos del mapa. OpenStreetMap sirve para demos; en producción usa un proveedor propio o con contrato.
TESELAS = {
    "url": os.getenv("TESELAS_URL", "https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
    "atribucion": os.getenv("TESELAS_ATRIBUCION", "© colaboradores de OpenStreetMap"),
}

TAMANO_MAX_MB = 10
