#!/usr/bin/env bash
# =============================================================================
# db-migrate.sh - Applique le schema Prisma + seed de reference en one-shot.
#
# Usage:
#   ./scripts/db-migrate.sh           # push + seed
#   ./scripts/db-migrate.sh --push    # push uniquement (pas de seed)
#   ./scripts/db-migrate.sh --seed    # seed uniquement
#
# Le script lance la migration dans un container ephemere base sur l'image
# server publiee (IMAGE_TAG, defaut: latest). Il ne touche pas au container
# nufflearena_server en cours d'execution, donc peut etre invoque avant le
# swap pour preparer la DB sans downtime.
#
# Pre-requis :
#   - docker-compose.prod.yml present (db doit etre running)
#   - .env charge (POSTGRES_*, DATABASE_URL via le compose)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_PROD="$PROJECT_DIR/docker-compose.prod.yml"

# Par défaut : push uniquement. Le seed NE doit JAMAIS tourner automatiquement
# en production (risque de perte de données). Utiliser --seed uniquement manuellement.
DO_PUSH=true
DO_SEED=false
for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=true;  DO_SEED=false ;;
    --seed) DO_PUSH=false; DO_SEED=true  ;;
    --push-and-seed) DO_PUSH=true; DO_SEED=true ;;
    *) echo "Unknown arg: $arg"; exit 2 ;;
  esac
done

GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'
log()    { echo -e "${CYAN}[migrate]${NC} $*"; }
ok()     { echo -e "${GREEN}[migrate]${NC} $*"; }
fatal()  { echo -e "${RED}[migrate]${NC} $*" >&2; exit 1; }

cd "$PROJECT_DIR"

# Attendre que la DB soit prete avant toute operation Prisma.
log "Wait for Postgres readiness..."
DB_TIMEOUT=60
DB_ELAPSED=0
until docker compose -f "$COMPOSE_PROD" exec -T db \
    pg_isready -U "${POSTGRES_USER:-bb_user}" \
    -d "${POSTGRES_DB:-bb_db}" >/dev/null 2>&1; do
  if [ $DB_ELAPSED -ge $DB_TIMEOUT ]; then
    fatal "Postgres unavailable after ${DB_TIMEOUT}s."
  fi
  sleep 3
  DB_ELAPSED=$((DB_ELAPSED + 3))
done
ok "Postgres ready."

# `docker compose run --rm server <cmd>` cree un container ephemere base
# sur la meme image que le service `server`, avec les memes env vars et
# le meme network. C'est isole du nufflearena_server en cours d'execution.
if [ "$DO_PUSH" = true ]; then
  log "Apply Prisma schema (db push)..."
  docker compose -f "$COMPOSE_PROD" run --rm --no-deps server \
    pnpm -w exec prisma db push \
    --schema prisma/schema.prisma \
    --accept-data-loss \
    --skip-generate
  ok "Schema applied."
fi

if [ "$DO_SEED" = true ]; then
  log "Seed reference data (rosters, skills, ...)"
  docker compose -f "$COMPOSE_PROD" run --rm --no-deps server \
    sh -c "cd apps/server && pnpm run db:seed"
  ok "Seed done."
fi
