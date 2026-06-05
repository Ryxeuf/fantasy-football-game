# Unification du feature flag des ligues — 2026-06-05

## Contexte / bug

La brique « Ligue » était gatée par **deux** feature flags distincts :

- `league` (`LEAGUE_FLAG`) — accès au hub `/leagues` (via `LeagueGate`,
  monté dans `apps/web/app/leagues/layout.tsx`).
- `leagues_v2_ui` (`LEAGUES_V2_UI_FLAG`) — bouton **+ Créer une ligue**,
  `/leagues/new`, édition draft, admin saison, calendrier interactif,
  level-up de roster (`/me/teams/:id/level-up`), bannière advancements,
  et la section « Ligues » du menu admin.

Conséquence piégeuse : un compte avec **seulement** `league` activé voyait
le hub et la liste, mais **pas** le bouton « + Créer une ligue » (gated par
l'autre flag). Symptôme rapporté : « le bouton n'est pas disponible même
pour un user avec le FF activé ».

## Décision

**Fusionner les deux flags en un seul : `league`.** Le flag `leagues_v2_ui`
n'existe plus dans le code. Activer `league` (global ou override user) débloque
désormais TOUTE la fonctionnalité ligue.

## Changements

### Web (`apps/web/app`)
- `lib/featureFlagKeys.ts` — suppression de `LEAGUES_V2_UI_FLAG` ; doc de
  `LEAGUE_FLAG` étendue (flag unique).
- `leagues/page.tsx`, `leagues/new/page.tsx`, `leagues/[id]/page.tsx`,
  `admin/layout.tsx`, `me/teams/[id]/page.tsx`,
  `me/teams/[id]/level-up/page.tsx` — `useFeatureFlag(LEAGUE_FLAG)`
  (variables renommées `v2UiEnabled` → `leagueEnabled` le cas échéant).
- Commentaires mis à jour : `NewSeasonModal.tsx`, `seasons/[sid]/recap/page.tsx`,
  `PendingAdvancementsBanner.tsx`.
- `leagues/page.test.tsx` — descriptions/commentaires alignés sur `league`.

### Server (`apps/server/src`)
- `services/featureFlags.ts` — suppression de la constante `LEAGUES_V2_UI_FLAG`
  et de son entrée `KNOWN_FLAGS` ; doc de `LEAGUE_FLAG` étendue.
- `index.ts` — endpoint test-seed seed désormais `league` (au lieu de
  `leagues_v2_ui`, qui n'était pas seedé auparavant pour `league` !).
- `seed.ts` — le bloc de seed crée maintenant le flag `league` (+ override
  pour `user@example.com`) au lieu de `leagues_v2_ui`.

## Vérification

- `tsc --noEmit` OK (web + server).
- Tests : `apps/web` (leagues/admin/me-teams — 199 tests), `apps/server`
  `featureFlags.test.ts` (31 tests) — tous verts.

## Migration BDD (prod/staging)

`leagues_v2_ui` n'est plus référencé : la synchro code→BDD ne le recrée pas,
mais l'ancienne ligne (et ses overrides) **subsiste** en base sans effet.
Pour activer la feature après déploiement, activer le flag **`league`**
(toggle global ou override user dans `/admin/feature-flags`). Cleanup optionnel :
supprimer la ligne `leagues_v2_ui` et ses overrides.
