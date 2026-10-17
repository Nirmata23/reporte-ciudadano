# Arranca Banqueta en http://127.0.0.1:8000
# Uso:  .\iniciar.ps1            (motor automático: Claude si hay ANTHROPIC_API_KEY, si no local)
#       .\iniciar.ps1 -Local     (fuerza el clasificador local)

param([switch]$Local)

Set-Location $PSScriptRoot

if (-not (Test-Path ".venv")) {
    python -m venv .venv
    & .\.venv\Scripts\python.exe -m pip install -r requirements.txt
}

if ($Local) { $env:MOTOR_IA = "local" }

Write-Host "Banqueta en http://127.0.0.1:8000  (Ctrl+C para detener)" -ForegroundColor Yellow
& .\.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --port 8000 --reload
