#!/usr/bin/env bash
# =============================================================================
# deploy.sh - Deploiement complet de Nuffle Arena avec page de maintenance
#
# Usage:
#   ./scripts/deploy.sh              Deploy complet (pull + build + restart)
#   ./scripts/deploy.sh --no-cache   Deploy sans cache Docker
#   ./scripts/deploy.sh --skip-pull  Deploy sans git pull (build local)
#
# Ce script :
#   1. Active la page de maintenance
#   2. Pull les derniers changements (git)
#   3. Rebuild les images Docker
#   4. Redemarre les services
#   5. Attend que les health checks passent
#   6. Desactive la page de maintenance
#   7. En cas d'echec : rollback automatique
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_PROD="$PROJECT_DIR/docker-compose.prod.yml"
MAINTENANCE_SCRIPT="$SCRIPT_DIR/maintenance.sh"
DEPLOY_LOG="$PROJECT_DIR/deploy.log"
HEALTH_TIMEOUT=120

# Options
NO_CACHE=""
SKIP_PULL=false

for arg in "$@"; do
  case "$arg" in
    --no-cache)  NO_CACHE="--no-cache" ;;
    --skip-pull) SKIP_PULL=true ;;
  esac
done

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${CYAN}[INFO]${NC}    $1"; }
log_ok()      { echo -e "${GREEN}[OK]${NC}      $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}    $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC}   $1"; }
log_section() { echo -e "\n${BOLD}${CYAN}=== $1 ===${NC}"; }

timestamp() { date '+%Y-%m-%d %H:%M:%S'; }

# Enregistre dans le log de deploy
log_deploy() {
  echo "[$(timestamp)] $1" >> "$DEPLOY_LOG"
}

# --- Pre-checks ---
cd "$PROJECT_DIR"

PREVIOUS_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

echo -e "\n${BOLD}🏈 Deploiement Nuffle Arena${NC}"
echo -e "   Branche: ${CYAN}$BRANCH${NC}"
echo -e "   Commit actuel: ${CYAN}${PREVIOUS_COMMIT:0:7}${NC}"
echo -e "   Options: cache=${NO_CACHE:-oui} pull=${SKIP_PULL/true/non}"
echo ""

log_deploy "deploy start - branch $BRANCH - commit ${PREVIOUS_COMMIT:0:7} - options: no-cache=${NO_CACHE:-false} skip-pull=$SKIP_PULL"

# --- Fonction de rollback ---
rollback() {
  log_section "ROLLBACK"
  log_error "Le deploiement a echoue. Rollback en cours..."
  log_deploy "deploy FAILED - rollback to ${PREVIOUS_COMMIT:0:7}"

  # Desactiver la maintenance en cas d'erreur pendant le rollback
  trap '' ERR

  if [ "$PREVIOUS_COMMIT" != "unknown" ] && [ "$SKIP_PULL" = false ]; then
    log_info "Retour au commit $PREVIOUS_COMMIT..."
    git reset --hard "$PREVIOUS_COMMIT"
  fi

  log_info "Rebuild des services (rollback)..."
  docker compose -f "$COMPOSE_PROD" build $NO_CACHE 2>&1 | tail -5
  docker compose -f "$COMPOSE_PROD" up -d

  log_info "Attente du demarrage des services..."
  sleep 15

  # Desactiver la maintenance apres rollback
  "$MAINTENANCE_SCRIPT" off 2>/dev/null || true

  log_error "Rollback termine. Verifiez les logs : docker compose -f docker-compose.prod.yml logs"
  log_deploy "rollback completed to ${PREVIOUS_COMMIT:0:7}"
  exit 1
}

trap rollback ERR

# =============================================================================
# ETAPE 1 : Activer la maintenance
# =============================================================================
log_section "1/5 - Activation de la maintenance"
"$MAINTENANCE_SCRIPT" on

# Petit delai pour que Traefik detecte le nouveau container
sleep 2

# =============================================================================
# ETAPE 2 : Pull des changements
# =============================================================================
log_section "2/5 - Mise a jour du code"

if [ "$SKIP_PULL" = true ]; then
  log_warn "Pull ignore (--skip-pull)"
else
  log_info "Fetch et reset sur origin/$BRANCH..."
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
  NEW_COMMIT=$(git rev-parse HEAD)
  log_ok "Code mis a jour: ${PREVIOUS_COMMIT:0:7} -> ${NEW_COMMIT:0:7}"
fi

# =============================================================================
# ETAPE 3 : Build des images
# =============================================================================
log_section "3/5 - Build des images Docker"
log_info "Build en cours... (peut prendre quelques minutes)"

docker compose -f "$COMPOSE_PROD" build $NO_CACHE 2>&1 | while IFS= read -r line; do
  # Affiche seulement les lignes importantes
  if echo "$line" | grep -qE '(Step|Successfully|ERROR|CACHED)'; then
    echo "  $line"
  fi
done

log_ok "Build termine."

# =============================================================================
# ETAPE 4 : Redemarrage des services
# =============================================================================
log_section "4/5 - Redemarrage des services"
log_info "Arret et redemarrage des containers..."

docker compose -f "$COMPOSE_PROD" up -d

# =============================================================================
# ETAPE 5 : Health checks
# =============================================================================
log_section "5/5 - Verification des services"
log_info "Attente que les services soient healthy (max ${HEALTH_TIMEOUT}s)..."

ELAPSED=0
while [ $ELAPSED -lt $HEALTH_TIMEOUT ]; do
  WEB_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' nufflearena_web 2>/dev/null || echo "starting")
  SERVER_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' nufflearena_server 2>/dev/null || echo "starting")
  DB_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' nufflearena_db 2>/dev/null || echo "starting")

  echo -ne "\r  DB: $DB_HEALTH | Server: $SERVER_HEALTH | Web: $WEB_HEALTH (${ELAPSED}s/${HEALTH_TIMEOUT}s)  "

  if [ "$WEB_HEALTH" = "healthy" ] && [ "$SERVER_HEALTH" = "healthy" ]; then
    echo ""
    log_ok "Tous les services sont healthy !"
    break
  fi

  # Echec immediat si un container a crashe
  for container in nufflearena_web nufflearena_server; do
    RUNNING=$(docker inspect --format='{{.State.Running}}' "$container" 2>/dev/null || echo "false")
    if [ "$RUNNING" = "false" ]; then
      echo ""
      log_error "Le container $container a crashe !"
      docker compose -f "$COMPOSE_PROD" logs --tail=30 "$container"
      exit 1  # Declenche le trap -> rollback
    fi
  done

  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

# Timeout atteint ?
if [ $ELAPSED -ge $HEALTH_TIMEOUT ]; then
  echo ""
  log_error "Les services ne sont pas healthy apres ${HEALTH_TIMEOUT}s."
  docker compose -f "$COMPOSE_PROD" logs --tail=20
  exit 1  # Declenche le trap -> rollback
fi

# =============================================================================
# SUCCES : Desactiver la maintenance
# =============================================================================
trap '' ERR  # Desactive le trap rollback

log_section "Finalisation"
"$MAINTENANCE_SCRIPT" off

FINAL_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
DURATION=$ELAPSED

echo ""
echo -e "${BOLD}${GREEN}✅ Deploiement reussi !${NC}"
echo -e "   Commit: ${CYAN}${FINAL_COMMIT:0:7}${NC}"
echo -e "   Duree health check: ${CYAN}${DURATION}s${NC}"
echo ""

log_deploy "deploy all - commit ${FINAL_COMMIT:0:7} - SUCCESS"
