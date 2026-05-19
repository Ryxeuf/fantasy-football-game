#!/usr/bin/env bash
#
# Bloque la presence de fichiers .js shadow (.js dont un .ts equivalent
# existe au meme chemin) dans packages/game-engine/src/.
#
# Contexte : Vitest/Vite resout `.js` avant `.ts` quand les deux existent.
# Une modification du `.ts` peut etre invisible aux tests si le `.js`
# stale shadow le source. Bug reproduit le 2026-05-19 (skill awareness
# ignoree par les tests — cf. docs/engine-audit-2026-05-19-full.md).
#
# Exit codes :
#   0 = OK (aucun shadow)
#   1 = shadow detecte (liste affichee sur stderr)
#
# Usage :
#   bash scripts/check-no-js-shadow.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

SHADOWS=$(find "${ROOT_DIR}/packages/game-engine/src" -name "*.js" -type f \
  | while read -r f; do
      ts="${f%.js}.ts"
      if [ -f "$ts" ]; then echo "$f"; fi
    done)

if [ -n "$SHADOWS" ]; then
  {
    echo "ERREUR : fichiers .js shadow detectes (.ts equivalent existe)"
    echo
    echo "Ces fichiers font echouer silencieusement Vitest qui resout"
    echo "le .js avant le .ts. Supprime-les :"
    echo
    echo "$SHADOWS"
    echo
    echo "Commande :"
    echo "  bash scripts/check-no-js-shadow.sh --clean"
  } >&2

  if [ "${1:-}" = "--clean" ]; then
    echo "$SHADOWS" | xargs rm -f
    echo "Supprimes : $(echo "$SHADOWS" | wc -l) fichiers" >&2
    exit 0
  fi
  exit 1
fi

exit 0
