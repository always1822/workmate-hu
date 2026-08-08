#!/usr/bin/env bash
# WorkMate HU – teljes adatbázis mentés (BSON + olvasható JSON)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env"
[ -f "$ENV_FILE" ] || { echo "Nem találom: $ENV_FILE"; exit 1; }

MONGO_URL=$(grep -E '^MONGO_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
DB_NAME=$(grep -E '^DB_NAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
STAMP=$(date +%Y-%m-%d_%H%M)
OUT="$ROOT/backup/workmatehu-$STAMP"
mkdir -p "$OUT"

echo "Mentés: $DB_NAME -> $OUT"
mongodump --uri="$MONGO_URL" --db="$DB_NAME" --out="$OUT" --quiet

for C in users company customers jobs quotes invoices payments documents worklogs contacts; do
  mongoexport --uri="$MONGO_URL" --db="$DB_NAME" --collection="$C" \
    --jsonArray --pretty --out="$OUT/$C.json" --quiet 2>/dev/null || true
done

echo "Kész. Visszatöltés: ./scripts/import_db.sh $OUT"
