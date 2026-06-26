# Règles spéciales d'équipe, mots-clés & affichage des compétences (2026-06-26)

Lot couvrant 5 points autour de l'affichage roster/builder/équipe et de la
gestion de ligue.

## 1. Encadré orange = compétences acquises seulement (source DB)

Problème : sur la fiche d'équipe (`/me/teams/[id]`), des compétences **par
défaut** d'une position pouvaient s'afficher avec l'encadré orange (réservé aux
compétences *acquises*) quand la liste hardcodée du game-engine
(`getBaseSkillSlugs`) divergeait de la base.

Fix : `SkillTooltip` accepte une prop `dbBaseSkills` (slugs des compétences par
défaut **sourcés de la DB**, via `Position.skills`). Quand fournie, elle est
prioritaire sur `separateSkills` (game-engine). La fiche d'équipe la dérive de
`rosterDetail.positions[].skills` (`buildPositionMetaByPosition`).

- `apps/web/app/me/teams/components/SkillTooltip.tsx`
- `apps/web/app/me/teams/[id]/roster-skill-access.ts` (`buildPositionMetaByPosition`)

## 2. Mots-clés des positions affichés partout

Composant partagé `KeywordChips` (CSV localisé → pastilles). Branché sur :

- Page roster publique `/teams/[slug]` (déjà via `KeywordTags`, inchangé)
- Fiche d'équipe `/me/teams/[id]` (desktop + mobile)
- Builder `/me/teams/new` (desktop + mobile)

Le builder consomme désormais `keywords`/`keywordsEn` exposés par
`GET /team/rosters/:id` (extension de `getRosterFromDb`).

## 3. Règles spéciales par équipe

Le catalogue existait (`packages/game-engine/src/rosters/team-special-rules.ts`)
mais **aucun roster** n'avait de règle assignée. Assignation faite dans les deux
maps (`SEASON_TWO_ROSTERS` de `positions.ts` + `SEASON_THREE_ROSTERS` de
`season3-rosters.ts`), source de vérité = `docs/roster-bb-2025/*.md` (ligne
« Règles spéciales : »). Stockage : CSV de slugs dans `Roster.specialRules`.

Affichage avec **hover** (détail de la règle, comme les compétences) via le
composant partagé `SpecialRulesBadges` :

- Builder `/me/teams/new`
- Fiche d'équipe `/me/teams/[id]` et page roster `/teams/[slug]` : sections
  dédiées existantes (accordéon détaillé) conservées.

Le builder reçoit `specialRules` résolues (slug + nom + description localisés)
via `getRosterFromDb` (`resolveSpecialRulesCsv`).

> Mapping → voir `team-special-rules-assignment.test.ts` (fige le mapping et
> valide que tout slug renseigné existe au catalogue).

## 4. « Bagarreurs Brutaux » et l'attribution des PSP (ligue)

La mécanique était **déjà câblée** (`apps/server/src/services/spp-tracking.ts`,
L2.B.8) : `calculatePlayerSPP` applique l'override (Élimination 2→3 PSP, TD 3→2)
et `loadLeagueSPPContext` lit `Roster.specialRules`. Elle était inactive faute
de données. Désormais les rosters concernés portent `bagarreurs_brutaux`, donc
l'override s'applique automatiquement en match de ligue offline
(`league-offline-result.ts`).

## 5. Page admin roster (`/admin/data/rosters/[id]`)

Ajout de deux sections (données déjà renvoyées par l'API admin) :

- **Règles spéciales** résolues (nom + description) au lieu du CSV brut.
- **Staff & coûts** par format (bb11 / sevens) depuis `staffConfigs`.

## Données / déploiement

Les règles spéciales ne s'appliquent qu'après **re-seed** des rosters
(`make db-seed`, idempotent — met à jour `Roster.specialRules`). À refaire en
staging/prod lors du déploiement.

## Tests

- `packages/game-engine/.../team-special-rules-assignment.test.ts` (mapping)
- `apps/server/src/utils/roster-helpers.test.ts` (`resolveSpecialRulesCsv`)
- `apps/web/app/me/teams/[id]/roster-skill-access.test.ts`
  (`buildPositionMetaByPosition`)
- SPP : couverture existante `apps/server/src/services/spp-tracking.test.ts`.
