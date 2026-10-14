#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if [ ! -x ".venv/bin/python" ]; then
  echo "Criando ambiente virtual..."
  python3 -m venv .venv
fi

echo "Instalando/atualizando dependências..."
.venv/bin/python -m pip install -r requirements.txt

echo
echo "Blue Chip iniciado em: http://localhost:8000"
echo "Painel administrativo: http://localhost:8000/admin"
echo "Pressione Ctrl+C para encerrar."
echo

exec .venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000 --reload
