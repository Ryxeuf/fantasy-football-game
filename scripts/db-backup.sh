#!/usr/bin/env bash
# =============================================================================
# db-backup.sh — Sauvegarde quotidienne PostgreSQL avec rotation sur 5 jours.
#
# Usage :
#   ./scripts/db-backup.sh            # backup + rotation
#   ./scripts/db-backup.sh --dry-run  # simule sans écrire
#
# Flux :
#   1. pg_dump compressé (custom format, ~10x plus compact qu'un .sql brut)
#   2. Stockage dans backups/nuffle_arena_YYYYMMDD_HHMMSS.dump
#   3. Suppression des fichiers > 5 jours (rotation)
#   4. Notification Discord (succès ou échec)
#
# Restauration manuelle :
#   docker compose -f docker-compose.prod.yml exec db \
#     pg_restore -U bb_user -d bb_db -c /chemin/vers/fichier.dump
#
# Planification (cron — lancé par scripts/install-cron.sh) :
#   0 3 * * * /var/www/nuffle-arena/scripts/db-backup.sh >> /var/log/nuffle-backup.log 2>&1
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_PROD="$PROJECT_DIR/docker-compose.prod.yml"
BACKUP_DIR="$PROJECT_DIR/backups"
RETENTION_DAYS=5

DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# Charger les variables d'environnement (.env + .env.local)
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PROJECT_DIR/.env"
  set +a
fi
if [ -f "$PROJECT_DIR/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$PROJECT_DIR/.env.local"
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-bb_user}"
POSTGRES_DB="${POSTGRES_DB:-bb_db}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"

# --- Helpers ---
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log()   { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${CYAN}[backup]${NC} $*"; }
ok()    { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${GREEN}[backup]${NC} $*"; }
err()   { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${RED}[backup]${NC} $*" >&2; }

discord_notify() {
  local message="$1"
  [ -z "${DISCORD_WEBHOOK_URL:-}" ] && return 0
  command -v curl >/dev/null 2>&1 || return 0
  local escaped="${message//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  escaped="${escaped//$'\n'/\\n}"
  curl -sS -m 5 -X POST -H "Content-Type: application/json" \
       -d "{\"content\":\"${escaped}\"}" "$DISCORD_WEBHOOK_URL" >/dev/null 2>&1 || true
}

# Trap pour notifier en cas d'échec
BACKUP_FILE=""
trap_error() {
  err "Backup ÉCHOUÉ (exit $?)"
  discord_notify ":x: **Nuffle Arena — Backup échoué** ($(date '+%Y-%m-%d %H:%M'))"
}
trap trap_error ERR

# =============================================================================
# 1. Vérifier que le container DB est up
# =============================================================================
log "Vérification du container DB..."
if ! docker compose -f "$COMPOSE_PROD" exec -T db pg_isready \
    -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; then
  err "PostgreSQL non disponible, backup annulé."
  exit 1
fi
ok "PostgreSQL prêt."

# =============================================================================
# 2. Créer le répertoire de backup si nécessaire
# =============================================================================
mkdir -p "$BACKUP_DIR"

# =============================================================================
# 3. pg_dump dans un container éphémère (même image que le service db)
# =============================================================================
TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
BACKUP_FILE="$BACKUP_DIR/nuffle_arena_${TIMESTAMP}.dump"

log "Dump en cours → $BACKUP_FILE"

if [ "$DRY_RUN" = true ]; then
  log "[dry-run] pg_dump simulé — aucun fichier créé."
else
  # Format custom (-Fc) : compressé, restaurable avec pg_restore.
  docker compose -f "$COMPOSE_PROD" exec -T db \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
    > "$BACKUP_FILE"

  BACKUP_SIZE="$(du -sh "$BACKUP_FILE" | cut -f1)"
  ok "Dump terminé : $BACKUP_FILE ($BACKUP_SIZE)"
fi

# =============================================================================
# 4. Rotation : supprimer les fichiers plus vieux que RETENTION_DAYS jours
# =============================================================================
log "Rotation (conservation : ${RETENTION_DAYS} jours)..."

if [ "$DRY_RUN" = true ]; then
  OBSOLETE=$(find "$BACKUP_DIR" -name "nuffle_arena_*.dump" \
    -mtime "+${RETENTION_DAYS}" -print 2>/dev/null || true)
  if [ -n "$OBSOLETE" ]; then
    log "[dry-run] Fichiers qui seraient supprimés :"
    echo "$OBSOLETE"
  else
    log "[dry-run] Aucun fichier à supprimer."
  fi
else
  DELETED=0
  while IFS= read -r -d '' old_file; do
    rm -f "$old_file"
    log "  Supprimé : $(basename "$old_file")"
    DELETED=$((DELETED + 1))
  done < <(find "$BACKUP_DIR" -name "nuffle_arena_*.dump" \
    -mtime "+${RETENTION_DAYS}" -print0 2>/dev/null || true)

  REMAINING=$(find "$BACKUP_DIR" -name "nuffle_arena_*.dump" | wc -l)
  ok "Rotation terminée : ${DELETED} fichier(s) supprimé(s), ${REMAINING} conservé(s)."
fi

# =============================================================================
# 5. Notification Discord
# =============================================================================
if [ "$DRY_RUN" = false ]; then
  REMAINING_FINAL=$(find "$BACKUP_DIR" -name "nuffle_arena_*.dump" | wc -l)
  discord_notify ":floppy_disk: **Nuffle Arena — Backup réussi** \`${TIMESTAMP}\` · ${BACKUP_SIZE:-?} · ${REMAINING_FINAL} backup(s) conservé(s)"
fi

ok "Backup terminé avec succès."
