#!/bin/sh
set -e

echo "[entrypoint] Aplicando migraciones…"
prisma migrate deploy --schema ./prisma/schema.prisma

if [ "$SEED_DEMO" = "true" ]; then
  node ./prisma/seed.mjs
fi

echo "[entrypoint] Iniciando AU Scrims en el puerto ${PORT:-3000}"
exec node server.js
