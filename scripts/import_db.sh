#!/usr/bin/env bash
# WorkMate HU – adatbázis visszatöltés egy export könyvtárból
set -euo pipefail

[ $# -eq 1 ] || { echo "Használat: ./scripts/import_db.sh <backup/workmatehu-DÁTUM>"; exit 1; }
SRC="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env"

MONGO_URL=$(grep -E '^MONGO_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
DB_NAME=$(grep -E '^DB_NAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')

[ -d "$SRC/$DB_NAME" ] || { echo "Nem találom a dump könyvtárat: $SRC/$DB_NAME"; exit 1; }

echo "Visszatöltés: $SRC/$DB_NAME -> $DB_NAME (meglévő kollekciók felülírása)"
mongorestore --uri="$MONGO_URL" --db="$DB_NAME" --drop "$SRC/$DB_NAME" --quiet
echo "Kész."
