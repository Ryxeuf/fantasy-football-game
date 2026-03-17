#!/usr/bin/env bash
# =============================================================================
# maintenance.sh - Active/desactive la page de maintenance Nuffle Arena
#
# Usage:
#   ./scripts/maintenance.sh on      Activer la maintenance
#   ./scripts/maintenance.sh off     Desactiver la maintenance
#   ./scripts/maintenance.sh status  Verifier l'etat
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.maintenance.yml"
CONTAINER_NAME="nufflearena_maintenance"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

is_maintenance_active() {
  docker inspect --format='{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null | grep -q "true"
}

maintenance_on() {
  if is_maintenance_active; then
    log_warn "La maintenance est deja active."
    return 0
  fi

  log_info "Activation de la page de maintenance..."
  docker compose -f "$COMPOSE_FILE" up -d --force-recreate

  # Attendre que le container soit pret
  local retries=10
  while [ $retries -gt 0 ]; do
    if is_maintenance_active; then
      log_ok "Page de maintenance active sur nufflearena.fr et api.nufflearena.fr"
      return 0
    fi
    sleep 1
    retries=$((retries - 1))
  done

  log_error "Le container de maintenance n'a pas demarre correctement."
  return 1
}

maintenance_off() {
  if ! is_maintenance_active; then
    log_warn "La maintenance n'est pas active."
    return 0
  fi

  log_info "Desactivation de la page de maintenance..."
  docker compose -f "$COMPOSE_FILE" down

  log_ok "Page de maintenance desactivee. Le site est de nouveau accessible."
}

maintenance_status() {
  if is_maintenance_active; then
    echo -e "${YELLOW}MAINTENANCE ACTIVE${NC} - Le trafic est redirige vers la page de maintenance."
  else
    echo -e "${GREEN}MAINTENANCE INACTIVE${NC} - Le site fonctionne normalement."
  fi
}

# --- Main ---
case "${1:-}" in
  on)
    maintenance_on
    ;;
  off)
    maintenance_off
    ;;
  status)
    maintenance_status
    ;;
  *)
    echo "Usage: $0 {on|off|status}"
    echo ""
    echo "  on      Active la page de maintenance"
    echo "  off     Desactive la page de maintenance"
    echo "  status  Verifie l'etat de la maintenance"
    exit 1
    ;;
esac
