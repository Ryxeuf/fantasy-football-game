#!/usr/bin/env bash
# Infra smoke test — verifie que les 5 cibles make du daily dev existent
# et que docker-compose.yml inclut bien la configuration hot-reload (S24.9).
#
# Pas de docker requis : `docker compose config` est tente uniquement si
# le binaire est present (sinon on fallback sur un parsing YAML naif).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0
fail() {
  echo "  ❌ $1" >&2
  FAIL=$((FAIL + 1))
}
ok() {
  echo "  ✅ $1"
  PASS=$((PASS + 1))
}

echo "→ Make targets daily-dev (S24.9)"
for target in logs reset-db seed tunnel snapshot-prod; do
  if make -n "$target" >/dev/null 2>&1; then
    ok "make $target existe"
  else
    fail "make $target introuvable ou casse"
  fi
done

echo ""
echo "→ docker-compose.yml hot-reload"

# Mount workspace bind
if grep -qE "^\s*-\s*\.:/app\s*$" docker-compose.yml; then
  ok "bind mount workspace (./:/app) present"
else
  fail "bind mount workspace manquant"
fi

# Anonymous volumes pour eviter l'overlay node_modules host
if grep -qE "^\s*-\s*/app/node_modules\s*$" docker-compose.yml; then
  ok "anonymous volume /app/node_modules present"
else
  fail "anonymous volume /app/node_modules manquant"
fi

# next build artefact masque pour eviter conflit dev/prod
if grep -qE "^\s*-\s*/app/apps/web/\.next\s*$" docker-compose.yml; then
  ok "anonymous volume /app/apps/web/.next present"
else
  fail "anonymous volume /app/apps/web/.next manquant"
fi

# init: true pour signal handling correct (Ctrl+C, SIGTERM)
if [ "$(grep -cE '^[[:space:]]+init:[[:space:]]+true[[:space:]]*$' docker-compose.yml)" -ge 2 ]; then
  ok "init: true actif sur web + server (signal handling)"
else
  fail "init: true manquant — Ctrl+C ne propagera pas SIGTERM aux processes Node"
fi

# docker compose config si dispo
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  if docker compose config >/dev/null 2>&1; then
    ok "docker compose config parse OK"
  else
    fail "docker compose config echoue"
  fi
fi

echo ""
echo "Total: $PASS reussis, $FAIL echecs"
[ "$FAIL" -eq 0 ]
