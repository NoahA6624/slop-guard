$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:PATH = "$PWD\.venv\Scripts;$env:PATH"
& .venv/Scripts/python -m uvicorn slopguard.app:app --host 127.0.0.1 --port 8000 --workers 1
