#!/bin/sh
set -e
cd /app
alembic upgrade head
# Production / shared hosts: set SKIP_SEED_ADMIN_ON_START=1 so deploys do not run seed_admin.
if [ -n "${SKIP_SEED_ADMIN_ON_START:-}" ]; then
  echo "[entrypoint] Skipping seed_admin (SKIP_SEED_ADMIN_ON_START is set)"
elif [ -n "$SEED_ADMIN_EMAIL" ] && [ -n "$SEED_ADMIN_PASSWORD" ]; then
  echo "[entrypoint] Running seed_admin for SEED_ADMIN_EMAIL=$SEED_ADMIN_EMAIL"
  python -m scripts.seed_admin
else
  echo "[entrypoint] Skipping seed_admin (set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to enable)"
fi
echo "[entrypoint] Dev fixtures (Spring Fiesta, sample posts): run \`make seed\` or \`docker compose run --rm backend python -m scripts.seed_dev\`"
exec "$@"
