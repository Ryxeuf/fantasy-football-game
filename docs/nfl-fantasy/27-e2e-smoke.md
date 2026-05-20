# 27 — E2E smoke user-facing (Phase 4)

> Premiers tests Playwright sur `/nfl-fantasy/*`. Objectif : garde-fou
> minimal qui catch les regressions critiques (page 500, form
> disparu, route renommee) sans bloquer le dev sur des tests
> authentifies complets.

## Motivation

Phase 3 a livré l'integralite du backend + admin. Phase 3.A avait pose
le frontend V1 user-facing (`/nfl-fantasy` dashboard + new + join +
leagues/[id] + lineup + matchups) mais sans aucun test UI. Un PR qui
casse l'un de ces 6 ecrans (rename testid, refactor types) passe
silencieusement.

Phase 4 introduit un spec Playwright minimaliste qui valide les
parcours non-authentifies (rendu HTML + presence des elements clefs)
pour catch les regressions structurelles.

## Spec `nfl-fantasy-smoke.spec.ts`

5 tests, tous compatibles avec un user non-authentifie :

1. **Hub /nfl-fantasy** : verifie que la page rend SOIT le dashboard
   (`nfl-fantasy-create-cta` visible) SOIT le block "Authentification
   requise". Catch le crash 500 mais tolere les 2 etats.
2. **Page /nfl-fantasy/new** : verifie h1 + form testid +
   input/select critiques (name, teamName, seasonId, draftMode).
   Cette page rend toujours, l'erreur auth n'apparait qu'au submit.
3. **Page /nfl-fantasy/join** : verifie h1 + form testid.
4. **Navigation retour** : clique le lien "← Mes leagues" depuis
   /new et verifie le retour a /nfl-fantasy.
5. **League inexistante** : navigue vers une URL avec un id bidon et
   verifie que le body rend SANS le texte "Application error" (Next.js
   error boundary). Tolere le 404, le redirect, ou l'auth-required.

Les flows complets authentifies (creer une league, draft, lineup,
settle) sont deja testes en backend via le script E2E
`nfl-fantasy-admin-explorer-e2e.ts` (Phase 3.C/3.E). Re-tester via
Playwright serait redondant et fragile.

## Pas de fixtures DB

Le spec n'appelle pas `resetDb` ni `seedUser`. Il est read-only et
peut tourner contre n'importe quel state DB. Ca le rend rapide et
isole — un fail d'un autre spec ne casse pas celui-ci.

## Hors scope (futurs)

- **Flow authentifie complet** : un test qui seed un user, log in,
  cree une league, fait un autoFill admin + finalize + setLineup +
  navigate sur /matchups. Necessite des helpers Playwright pour le
  seed admin (POST /admin/nfl-fantasy/explore/...) + l'authMiddleware
  bypass de test. A faire si Phase 5 prevoit de relancer un flow
  complet en CI.
- **Page lineup + matchups** : pas teste pour l'instant car necessite
  un user dans une league. A ajouter une fois le helper authentifie
  pret.
- **Tests visuels** : screenshots des principales pages pour catch
  les regressions UI. Playwright supporte `toHaveScreenshot()`.
