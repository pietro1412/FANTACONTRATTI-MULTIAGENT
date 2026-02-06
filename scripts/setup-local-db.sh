#!/bin/bash
# Setup DB locale per sviluppo e test
# Uso: ./scripts/setup-local-db.sh [dev|test]

set -e

MODE=${1:-dev}

if [ "$MODE" = "test" ]; then
  echo "=== Setup DB TEST (porta 5434, tmpfs) ==="
  export DATABASE_URL="postgresql://postgres:postgres@localhost:5434/fantacontratti_test?schema=public"
  docker compose up db-test -d --wait
else
  echo "=== Setup DB DEV (porta 5433, persistent) ==="
  export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/fantacontratti?schema=public"
  docker compose up db -d --wait
fi

echo "DB avviato. Applico schema..."
npx prisma db push --schema=prisma/schema.generated.prisma --accept-data-loss

echo "Genero client Prisma..."
npx prisma generate --schema=prisma/schema.generated.prisma

if [ "$MODE" = "dev" ]; then
  echo "Eseguo seed..."
  npx tsx prisma/seed.ts
fi

echo "=== Setup completato ($MODE) ==="
echo "DATABASE_URL=$DATABASE_URL"
