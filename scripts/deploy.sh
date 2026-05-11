#!/usr/bin/env bash
# =============================================================================
# deploy.sh - Deploiement Nuffle Arena (Phase A : pull-only, sans maintenance).
#
# Usage:
#   ./scripts/deploy.sh --image-tag <sha>   Deploy de l'image taggee <sha>
#   ./scripts/deploy.sh                      Deploy de l'image :latest
#   ./scripts/deploy.sh --maintenance        Active la maintenance pendant le swap
#                                            (a reserver aux migrations breaking)
#   ./scripts/deploy.sh --skip-migrate       Skip la migration Prisma (rare)
#   ./scripts/deploy.sh --dry-run            Affiche les actions sans les executer
#
# Flux nominal (Phase A) :
#   1. Resolve IMAGE_TAG (CLI > .env.deploy > "latest").
#   2. Sauvegarde PREVIOUS_IMAGE_TAG depuis .env.deploy pour rollback.
#   3. docker compose pull (images deja buildees par la CI sur GHCR).
#   4. scripts/db-migrate.sh (schema + seed, idempotent).
#   5. docker compose up -d --no-deps web server (swap des containers).
#   6. Wait healthy via /health endpoints (timeout 120s).
#   7. Si fail : restore PREVIOUS_IMAGE_TAG et up -d (rollback en ~30s).
#
# Downtime attendu : 10-30s (cold-start Next.js apres le swap).
# Pour passer a ~0s : voir Phase B (Blue/Green Traefik).
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_PROD="$PROJECT_DIR/docker-compose.prod.yml"
MAINTENANCE_SCRIPT="$SCRIPT_DIR/maintenance.sh"
DB_MIGRATE_SCRIPT="$SCRIPT_DIR/db-migrate.sh"

DEPLOY_LOG="$PROJECT_DIR/deploy.log"
LAST_DEPLOYED_FILE="$PROJECT_DIR/.last-deployed-commit"
# .env.deploy : memoire du tag image actuellement en service. Permet le
# rollback meme si la CI a pushe plusieurs tags :latest entre temps.
ENV_DEPLOY_FILE="$PROJECT_DIR/.env.deploy"

HEALTH_TIMEOUT=120

# Charge les variables locales (ex: DISCORD_WEBHOOK_URL).
if [ -f "$PROJECT_DIR/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PROJECT_DIR/.env.local"
  set +a
fi
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"

# --- Args ---
IMAGE_TAG_ARG=""
USE_MAINTENANCE=false
SKIP_MIGRATE=false
DRY_RUN=false
while [ $# -gt 0 ]; do
  case "$1" in
    --image-tag)   IMAGE_TAG_ARG="$2"; shift 2 ;;
    --maintenance) USE_MAINTENANCE=true; shift ;;
    --skip-migrate)SKIP_MIGRATE=true; shift ;;
    --dry-run)     DRY_RUN=true; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

# --- Logging ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log_info()    { echo -e "${CYAN}[INFO]${NC}    $1"; }
log_ok()      { echo -e "${GREEN}[OK]${NC}      $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}    $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC}   $1"; }
log_section() { echo -e "\n${BOLD}${CYAN}=== $1 ===${NC}"; }
timestamp()   { date '+%Y-%m-%d %H:%M:%S'; }
log_deploy()  { echo "[$(timestamp)] $1" >> "$DEPLOY_LOG"; }

# `run` execute la commande ou la prefixe par "[dry-run]" selon le flag.
run() {
  if [ "$DRY_RUN" = true ]; then
    echo "[dry-run] $*"
    return 0
  fi
  "$@"
}

discord_notify() {
  local message="$1"
  if [ -z "${DISCORD_WEBHOOK_URL:-}" ] || [ "$DRY_RUN" = true ]; then return 0; fi
  command -v curl >/dev/null 2>&1 || return 0
  local escaped="${message//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  escaped="${escaped//$'\n'/\\n}"
  curl -sS -m 5 -X POST -H "Content-Type: application/json" \
       -d "{\"content\":\"${escaped}\"}" "$DISCORD_WEBHOOK_URL" >/dev/null 2>&1 || true
}

# --- Resolution du tag image ---
PREVIOUS_IMAGE_TAG=""
if [ -f "$ENV_DEPLOY_FILE" ]; then
  # shellcheck disable=SC1090
  PREVIOUS_IMAGE_TAG=$(grep -E '^IMAGE_TAG=' "$ENV_DEPLOY_FILE" | head -1 | cut -d= -f2- || true)
fi
PREVIOUS_IMAGE_TAG="${PREVIOUS_IMAGE_TAG:-latest}"

if [ -n "$IMAGE_TAG_ARG" ]; then
  NEW_IMAGE_TAG="$IMAGE_TAG_ARG"
else
  NEW_IMAGE_TAG="latest"
fi
export IMAGE_TAG="$NEW_IMAGE_TAG"

# --- Pre-checks ---
cd "$PROJECT_DIR"
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

echo -e "\n${BOLD}🏈 Deploiement Nuffle Arena (Phase A)${NC}"
echo -e "   Branche       : ${CYAN}$BRANCH${NC}"
echo -e "   Commit        : ${CYAN}${COMMIT:0:7}${NC}"
echo -e "   Image tag new : ${CYAN}$NEW_IMAGE_TAG${NC}"
echo -e "   Image tag prev: ${CYAN}$PREVIOUS_IMAGE_TAG${NC}"
echo -e "   Maintenance   : ${CYAN}$USE_MAINTENANCE${NC}  Dry-run: ${CYAN}$DRY_RUN${NC}"
echo ""

log_deploy "deploy start - branch $BRANCH - commit ${COMMIT:0:7} - new=$NEW_IMAGE_TAG prev=$PREVIOUS_IMAGE_TAG maintenance=$USE_MAINTENANCE"

# --- Rollback ---
ROLLBACK_DONE=false
rollback() {
  [ "$ROLLBACK_DONE" = true ] && return 0
  ROLLBACK_DONE=true

  log_section "ROLLBACK"
  log_error "Deploiement echoue. Restauration de l'image $PREVIOUS_IMAGE_TAG..."
  log_deploy "deploy FAILED - rollback to image=$PREVIOUS_IMAGE_TAG"
  trap '' ERR

  export IMAGE_TAG="$PREVIOUS_IMAGE_TAG"
  run docker compose -f "$COMPOSE_PROD" up -d --no-deps web server || true

  if [ "$USE_MAINTENANCE" = true ]; then
    run "$MAINTENANCE_SCRIPT" off 2>/dev/null || true
  fi

  discord_notify ":warning: **Nuffle Arena** - Deploy echoue, rollback vers image \`${PREVIOUS_IMAGE_TAG}\`."
  log_error "Rollback termine. Verifier: docker compose -f docker-compose.prod.yml logs"
  log_deploy "rollback completed to image=$PREVIOUS_IMAGE_TAG"
  exit 1
}
trap rollback ERR

# =============================================================================
# 1. Maintenance ON (optionnel, par defaut OFF)
# =============================================================================
if [ "$USE_MAINTENANCE" = true ]; then
  log_section "1/5 - Maintenance ON (mode breaking)"
  run "$MAINTENANCE_SCRIPT" on
  discord_notify ":tools: **Nuffle Arena** - Passage en maintenance (deploy breaking, branche \`$BRANCH\`)."
  sleep 2  # laisse Traefik detecter le router maintenance
else
  log_section "1/5 - Maintenance OFF (deploy sans coupure annoncee)"
  log_info "Pas de page de maintenance. Le swap engendrera ~10-30s de downtime cold-start."
fi

# =============================================================================
# 2. Pull des nouvelles images depuis GHCR
# =============================================================================
log_section "2/5 - Pull images Docker"
log_info "docker compose pull (IMAGE_TAG=$NEW_IMAGE_TAG)..."
run docker compose -f "$COMPOSE_PROD" pull web server
log_ok "Images $NEW_IMAGE_TAG presentes localement."

# =============================================================================
# 3. Migration DB (one-shot container, hors swap)
# =============================================================================
if [ "$SKIP_MIGRATE" = true ]; then
  log_section "3/5 - Migration DB (SKIPPED par flag)"
else
  log_section "3/5 - Migration DB (db push + seed)"
  # IMAGE_TAG est exporte au-dessus, db-migrate.sh lit la nouvelle image.
  run "$DB_MIGRATE_SCRIPT"
fi

# =============================================================================
# 4. Swap des containers applicatifs
# =============================================================================
log_section "4/5 - Swap containers (web + server)"
log_info "docker compose up -d --no-deps --pull never web server..."
# --no-deps : ne touche pas a la DB.
# --pull never : on a deja pulle a l'etape 2, evite un second round-trip.
run docker compose -f "$COMPOSE_PROD" up -d --no-deps --pull never web server

# =============================================================================
# 5. Health checks
# =============================================================================
log_section "5/5 - Verification health checks"
log_info "Attente que web + server soient healthy (max ${HEALTH_TIMEOUT}s)..."

if [ "$DRY_RUN" = true ]; then
  log_warn "Dry-run actif, health checks ignores."
  ELAPSED=0
else
  ELAPSED=0
  while [ $ELAPSED -lt $HEALTH_TIMEOUT ]; do
    WEB_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' nufflearena_web 2>/dev/null || echo "starting")
    SERVER_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' nufflearena_server 2>/dev/null || echo "starting")
    DB_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' nufflearena_db 2>/dev/null || echo "n/a")
    echo -ne "\r  DB: $DB_HEALTH | Server: $SERVER_HEALTH | Web: $WEB_HEALTH (${ELAPSED}s/${HEALTH_TIMEOUT}s)  "

    if [ "$WEB_HEALTH" = "healthy" ] && [ "$SERVER_HEALTH" = "healthy" ]; then
      echo ""; log_ok "Tous les services sont healthy."
      break
    fi

    for c in nufflearena_web nufflearena_server; do
      RUNNING=$(docker inspect --format='{{.State.Running}}' "$c" 2>/dev/null || echo "false")
      if [ "$RUNNING" = "false" ]; then
        echo ""
        log_error "Le container $c a crashe."
        docker compose -f "$COMPOSE_PROD" logs --tail=30 "$c"
        exit 1  # declenche rollback via trap
      fi
    done

    sleep 5
    ELAPSED=$((ELAPSED + 5))
  done

  if [ $ELAPSED -ge $HEALTH_TIMEOUT ]; then
    echo ""
    log_error "Services non healthy apres ${HEALTH_TIMEOUT}s."
    docker compose -f "$COMPOSE_PROD" logs --tail=30
    exit 1  # declenche rollback via trap
  fi
fi

# =============================================================================
# Finalisation : maintenance OFF + memoire deploy
# =============================================================================
trap '' ERR

if [ "$USE_MAINTENANCE" = true ]; then
  log_section "Finalisation"
  run "$MAINTENANCE_SCRIPT" off
fi

# Memoire : .env.deploy (tag image actif) + .last-deployed-commit (code).
if [ "$DRY_RUN" = false ]; then
  printf 'IMAGE_TAG=%s\n' "$NEW_IMAGE_TAG" > "$ENV_DEPLOY_FILE"
  if [ "$COMMIT" != "unknown" ]; then
    echo "$COMMIT" > "$LAST_DEPLOYED_FILE"
  fi
fi

discord_notify ":white_check_mark: **Nuffle Arena** - Deploy reussi (branche \`$BRANCH\`, commit \`${COMMIT:0:7}\`, image \`$NEW_IMAGE_TAG\`, health ${ELAPSED}s)."

echo ""
echo -e "${BOLD}${GREEN}Deploiement reussi !${NC}"
echo -e "   Commit      : ${CYAN}${COMMIT:0:7}${NC}"
echo -e "   Image       : ${CYAN}$NEW_IMAGE_TAG${NC}"
echo -e "   Duree health: ${CYAN}${ELAPSED}s${NC}"
echo ""

log_deploy "deploy SUCCESS - commit ${COMMIT:0:7} - image $NEW_IMAGE_TAG - health ${ELAPSED}s"
