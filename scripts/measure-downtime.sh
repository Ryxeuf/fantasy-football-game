#!/usr/bin/env bash
# =============================================================================
# measure-downtime.sh - Mesure le downtime perceptible pendant un deploy.
#
# Usage :
#   ./scripts/measure-downtime.sh                       # cible https://nufflearena.fr/
#   ./scripts/measure-downtime.sh --url <url>           # cible custom
#   ./scripts/measure-downtime.sh --interval 0.2        # poll toutes les 200ms (defaut)
#   ./scripts/measure-downtime.sh --duration 300        # mesure pendant 300s (defaut)
#
# Le script poll l'URL en boucle et imprime un resume :
#   - nb requetes totales
#   - nb requetes failed (status != 2xx/3xx, ou timeout, ou erreur connexion)
#   - duree max de coupure continue (en secondes)
#
# Lancer en parallele d'un deploy pour valider :
#   - Phase A : <= ~30s coupure continue (cold-start Next.js)
#   - Phase B : 0 coupure (rolling Blue/Green)
# =============================================================================
set -euo pipefail

URL="https://nufflearena.fr/"
INTERVAL=0.2
DURATION=300

while [ $# -gt 0 ]; do
  case "$1" in
    --url)      URL="$2";      shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    --duration) DURATION="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}[measure]${NC} URL=$URL interval=${INTERVAL}s duration=${DURATION}s"
echo -e "${CYAN}[measure]${NC} Started at $(date '+%H:%M:%S')"

TOTAL=0
FAILED=0
CURRENT_OUTAGE_START=0
MAX_OUTAGE=0
START_TS=$(date +%s)
LAST_STATE="up"

while :; do
  NOW=$(date +%s)
  ELAPSED=$((NOW - START_TS))
  if [ "$ELAPSED" -ge "$DURATION" ]; then break; fi

  TOTAL=$((TOTAL + 1))
  # -o /dev/null : drop body. -w "%{http_code}" : just the status.
  # --max-time 2 : timeout court pour detecter rapidement les coupures.
  HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 2 "$URL" 2>/dev/null || echo "000")

  if [[ "$HTTP_CODE" =~ ^[23] ]]; then
    # Up.
    if [ "$LAST_STATE" = "down" ]; then
      OUTAGE_END=$NOW
      OUTAGE_DUR=$((OUTAGE_END - CURRENT_OUTAGE_START))
      if [ "$OUTAGE_DUR" -gt "$MAX_OUTAGE" ]; then MAX_OUTAGE=$OUTAGE_DUR; fi
      echo -e "${GREEN}[measure]${NC} $(date '+%H:%M:%S') UP after ${OUTAGE_DUR}s outage."
    fi
    LAST_STATE="up"
  else
    # Down (ou erreur).
    FAILED=$((FAILED + 1))
    if [ "$LAST_STATE" = "up" ]; then
      CURRENT_OUTAGE_START=$NOW
      echo -e "${RED}[measure]${NC} $(date '+%H:%M:%S') DOWN (status=$HTTP_CODE)."
    fi
    LAST_STATE="down"
  fi

  sleep "$INTERVAL"
done

# Si on termine en etat down, compter l'outage en cours.
if [ "$LAST_STATE" = "down" ]; then
  OUTAGE_DUR=$(( $(date +%s) - CURRENT_OUTAGE_START ))
  if [ "$OUTAGE_DUR" -gt "$MAX_OUTAGE" ]; then MAX_OUTAGE=$OUTAGE_DUR; fi
fi

echo ""
echo -e "${CYAN}=== Resume ===${NC}"
echo -e "  Requetes totales   : $TOTAL"
echo -e "  Requetes failed    : $FAILED"
echo -e "  Coupure max (s)    : $MAX_OUTAGE"
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}  ZERO downtime detecte (objectif Phase B atteint).${NC}"
elif [ "$MAX_OUTAGE" -le 30 ]; then
  echo -e "${GREEN}  Downtime court ${MAX_OUTAGE}s (objectif Phase A atteint).${NC}"
else
  echo -e "${RED}  Downtime trop long (${MAX_OUTAGE}s). Cible Phase A : <=30s.${NC}"
fi
