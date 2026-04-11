# @bb/tests-e2e-ui

End-to-end multijoueur UI pour Nuffle Arena, propulsé par Playwright.

## Prérequis

- Le serveur API doit tourner et exposer les endpoints de test
  (`/__test/seed-user`, `/__test/seed-team`, `/__test/reset`), donc avec
  `TEST_SQLITE=1`.
- Le front Next.js doit tourner et pointer sur ce serveur.
- Ajouter `data-testid` aux composants — voir liste dans
  `docs/e2e/testids.md` (ou lire le premier commit qui les introduit).

## Lancer en local

```bash
# 1. Démarrer le serveur API en mode test
cd apps/server
TEST_SQLITE=1 TEST_DATABASE_URL='file:memdb-e2e?mode=memory&cache=shared' \
  API_PORT=18002 JWT_SECRET=e2e-jwt pnpm run dev:nowatch

# 2. Démarrer le front Next.js en pointant vers le serveur de test
cd apps/web
NEXT_PUBLIC_API_BASE=http://localhost:18002 pnpm dev

# 3. Lancer la suite Playwright
cd tests/e2e-ui
pnpm run install:browsers   # une fois
WEB_BASE_URL=http://localhost:3100 \
  API_BASE_URL=http://localhost:18002 \
  pnpm run test
```

## Commandes utiles

- `pnpm run test` — headless
- `pnpm run test:headed` — navigateur visible
- `pnpm run test:debug` — pas-à-pas avec l'inspecteur
- `pnpm run test:ui` — mode interactif Playwright UI
- `pnpm run report` — ouvre le dernier rapport HTML

## Architecture

- `playwright.config.ts` — config globale (retries CI, reporters JUnit + HTML)
- `fixtures/two-players.ts` — fixture qui seed 2 coachs + les logge
- `pages/*.ts` — Page Objects (LoginPage, LobbyPage, WaitingRoomPage,
  GameViewPage)
- `helpers/api-seed.ts` — accès direct à l'API via les endpoints `/__test/*`
- `specs/*.spec.ts` — scénarios multijoueur
