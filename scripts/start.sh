#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export PATH="$PWD/.venv/bin:$PATH"
exec .venv/bin/python -m uvicorn slopguard.app:app --host 127.0.0.1 --port 8000 --workers 1
