# Auto-avancement de `League.status` sur le cycle de vie des saisons

## Why

Une ligue restait affichee « Brouillon » (`League.status = "draft"`) **a vie**,
meme apres avoir ouvert les inscriptions et demarre des saisons. Ce n'etait pas
un design voulu mais un champ mort fonctionnellement :

- `createLeague` n'ecrit jamais `status` → valeur par defaut Prisma `"draft"`
  ([`schema.prisma` modele `League`](../../../prisma/schema.prisma),
  [`services/league.ts:173`](../../../apps/server/src/services/league.ts#L173)).
- Tout le cycle de vie reel vit dans **`LeagueSeason.status`**
  (`draft`→`scheduled`→`in_progress`→`completed`). `startSeason` et
  `openSeasonForRegistration` ne modifiaient **que** la saison, jamais la ligue
  ([`services/league-scheduler.ts`](../../../apps/server/src/services/league-scheduler.ts)).
- Seul `PATCH /admin/leagues/:id/status` (force-status admin) faisait bouger
  `League.status` ([`routes/admin-leagues.ts:149`](../../../apps/server/src/routes/admin-leagues.ts#L149)).

Cote UI, le badge de statut (liste + detail) refletait donc toujours
« Brouillon » alors que la ligue tournait — confusion pour le createur, sans
aucun gate fonctionnel pour compenser.

## What Changes

- **Brique 1 — Auto-avancement (serveur).** `League.status` progresse en effet
  de bord des actions de saison **deja existantes**, de maniere *forward-only*
  et idempotente :
  - `openSeasonForRegistration` (ouverture des inscriptions d'une saison) :
    ligue `draft` → `open`.
  - `startSeason` (demarrage d'une saison) : ligue `draft`/`open` → `in_progress`.
  - Echelle `draft < open < in_progress`. `completed` et `archived` sont **hors
    echelle** : pilotes manuellement par l'admin, jamais retrogrades ni ecrases.
  - Helper `advanceLeagueStatus(leagueId, target)` : relit la ligue, ne fait
    rien si elle est deja au niveau cible/au-dela ou hors echelle.
- **Brique 2 — Backfill ponctuel.** Script
  [`scripts/backfill-league-status.ts`](../../../apps/server/src/scripts/backfill-league-status.ts)
  recale les ligues existantes deja actives mais bloquees en `draft`/`open`,
  d'apres l'etat de leurs saisons (`--dry-run` supporte). Le correctif n'agit que
  sur les actions futures ; ce script rattrape l'existant une fois.

Hors perimetre (volontaire) : pas de bouton manuel « publier » (doublon avec
l'ouverture des inscriptions et le force-status admin) ; pas de transition
automatique vers `completed`/`archived` (les ligues sont multi-saisons ;
ces etats restent une decision admin) ; aucun changement de schema (la colonne
`status` et son `@default("draft")` sont inchanges).

## Impact

- **Capability** : `league-status-lifecycle` (nouvelle — formalise l'invariant
  entre `League.status` et l'etat de ses saisons).
- **Code** : `apps/server/src/services/league-scheduler.ts` (+ helper),
  `apps/server/src/scripts/backfill-league-status.ts` (nouveau).
- **Tests** : `league-scheduler.test.ts` — 4 tests de non-regression.
- **Donnees** : aucune migration ; backfill optionnel et idempotent.
- **UI** : aucun changement de code ; le badge de statut (liste/detail) reflete
  desormais la realite via la donnee corrigee.
