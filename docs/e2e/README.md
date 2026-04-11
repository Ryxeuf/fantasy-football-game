# E2E testing — Nuffle Arena

Cette section regroupe les ressources de test end-to-end multijoueur.

## Trois niveaux

| Niveau | Techno | Vitesse | Couverture | Exécution |
|--------|--------|---------|------------|-----------|
| **1. API** | Vitest + socket.io-client | < 30 s | contrats REST + WebSocket | `pnpm --filter @bb/tests-e2e-api run test` |
| **2. UI** | Playwright (2 BrowserContext) | 3–8 min | parcours happy path | `pnpm --filter @bb/tests-e2e-ui run test` |
| **3. Manuel** | Playbooks `docs/e2e/playbooks/*.md` | variable | scénarios complexes, skills, UX | humain |

## Intégration CI

Voir `.github/workflows/e2e.yml`. Deux jobs :

- `e2e-api` — lancé sur chaque PR, bloquant. SQLite in-memory, pas de
  navigateur. Rapide (< 1 min).
- `e2e-ui` — lancé sur `push` vers `main` et sur PR portant le label
  `run-e2e`. Installe Playwright, démarre server + web, exécute la
  suite. Les traces / screenshots / vidéos sont uploadés en artefacts
  sur échec.

## Exécution à la main

### Niveau 1 — API

```bash
pnpm --filter @bb/tests-e2e-api run test
```

La suite démarre automatiquement son propre serveur (SQLite in-memory,
port 18002). Aucune dépendance externe.

### Niveau 2 — UI

```bash
# terminal 1: serveur API
cd apps/server
TEST_SQLITE=1 TEST_DATABASE_URL='file:memdb-e2e?mode=memory&cache=shared' \
  API_PORT=18002 JWT_SECRET=e2e-jwt pnpm run dev:nowatch

# terminal 2: front Next.js
cd apps/web
NEXT_PUBLIC_API_BASE=http://localhost:18002 pnpm dev

# terminal 3: Playwright
cd tests/e2e-ui
WEB_BASE_URL=http://localhost:3100 API_BASE_URL=http://localhost:18002 \
  pnpm run test
```

### Niveau 3 — Manuel

Suivre les étapes dans `docs/e2e/playbooks/` :

- `01-full-match.md` — un match complet 2 × 8 tours
- `02-all-actions.md` — checklist exhaustive des actions
- `03-skills-triggers.md` — déclenchement de compétences
- `04-edge-cases.md` — fumble, interception, foul, throw team-mate
- `05-network-failures.md` — coupure réseau et forfeit
