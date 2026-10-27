#!/bin/sh
set -e

# En Neon, DIRECT_URL (conexión sin pooler) es la recomendada para migrar; si no existe se usa DATABASE_URL
echo "[entrypoint] Aplicando migraciones…"
DATABASE_URL="${DIRECT_URL:-$DATABASE_URL}" prisma migrate deploy --schema ./prisma/schema.prisma

# Cuenta de administrador de la app (solo si ADMIN_USERNAME y ADMIN_PASSWORD están definidos)
node ./prisma/ensure-admin.mjs

if [ "$SEED_DEMO" = "true" ]; then
  node ./prisma/seed.mjs
fi

echo "[entrypoint] Iniciando AU Scrims en el puerto ${PORT:-3000}"
exec node server.js
