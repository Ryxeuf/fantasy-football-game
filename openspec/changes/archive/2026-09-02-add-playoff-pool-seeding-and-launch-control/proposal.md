# Qualification par poule et contrôle commissaire du lancement des playoffs

## Why

Le passage « phase de poule → playoffs » est aujourd'hui **entièrement
implicite** : il n'existe aucune action de clôture. Le bascule se produit dans un
hook *fire-and-forget* déclenché quand tous les `LeagueRound` de la saison
passent `completed` — dans
[`league-match-result.ts:330`](../../../apps/server/src/services/league-match-result.ts#L330)
pour la saisie en ligne, dans
[`league-forfeit.ts:275`](../../../apps/server/src/services/league-forfeit.ts#L275)
(`maybeCompleteRoundAndSeason`) pour le forfait et la saisie offline. Deux
manques concrets en découlent.

**1. Les poules ne qualifient personne.** `LeaguePool.qualifiesForPlayoffs` est
configurable par le commissaire (`PoolsManagerPanel`), stocké, et… jamais lu
pour construire le bracket. `startPlayoffs`
([`league-playoffs.ts:233`](../../../apps/server/src/services/league-playoffs.ts#L233))
seede sur `computeSeasonStandings(seasonId)`, c'est-à-dire le classement
**global** de la saison. Avec deux poules, le top 4 global peut sortir
intégralement d'une seule poule : la poule perdante n'envoie personne en
playoffs alors que l'UI affiche fièrement son badge « 2 qualifié(s) PO ». Le
champ n'est aujourd'hui qu'un ornement (`page.tsx:608`).

**2. Le commissaire n'a aucune prise sur le lancement.** La route
`POST /leagues/seasons/:seasonId/playoff/start` existe mais **aucune UI ne
l'appelle** : elle n'est atteignable qu'au curl. Si le hook fire-and-forget
échoue, la saison reste `in_progress` sans bracket et sans recours. Symétri­quement,
`playoffSize` n'est réglable qu'à la **création** de la saison
(`NewSeasonModal`) : `PATCH /seasons/:seasonId/config` ne gère que
`meceneEnabled`, donc un commissaire qui a oublié de le régler doit passer par
la base. Enfin, `startPlayoffs` ne vérifie pas que la phase régulière est
terminée — brancher un bouton dessus tel quel permettrait de générer un bracket
en plein milieu de la saison.

## What Changes

- **Seeding par poule.** Quand la saison a des poules dont la somme des
  `qualifiesForPlayoffs` est > 0, les seeds sont construits **poule par poule**
  (`computeSeasonStandingsByPool`) : les N premiers de chaque poule, ordonnés en
  serpentin (tous les 1ers par `pool.order`, puis tous les 2èmes, etc.). Le
  seeding croisé existant (1v8/4v5/2v7/3v6) s'applique ensuite sans changement.
  Comportement legacy strictement préservé : sans poule, ou si toutes les poules
  qualifient 0, on retombe sur le classement global actuel.
- **Cohérence config vérifiée.** Si `Σ qualifiesForPlayoffs ≠ playoffSize`, la
  génération est **refusée** (`pool-qualification-mismatch`) plutôt que de
  produire un bracket qui contredit la configuration affichée. Idem si une poule
  compte moins d'équipes éligibles que son quota.
- **Garde « phase régulière terminée ».** `startPlayoffs` refuse désormais si un
  round non-playoff n'est pas `completed` (`regular-season-incomplete`). Le hook
  automatique n'est pas affecté (il ne s'exécute qu'une fois tout complété).
- **Clôture anticipée explicite.** Le commissaire peut forcer la fin de la phase
  de poule (`force: true`) : les pairings réguliers restants passent `cancelled`,
  les rounds réguliers `completed`, puis le bracket est généré. Journalisé.
- **`playoffSize` réglable en cours de saison.** `PATCH /seasons/:seasonId/config`
  accepte `playoffSize` (0/2/4/8) tant que le bracket n'existe pas et que la
  saison n'est pas `completed`.
- **UI commissaire.** `PlayoffBracketView` affiche, avant tout bracket, un
  panneau commissaire : sélecteur `playoffSize`, bouton « Lancer les playoffs »,
  case « clôturer la phase de poule en cours », et restitution en clair des
  refus (`skippedReason`). Les non-commissaires ne voient rien de plus qu'aujourd'hui.

Hors périmètre (volontaire) : le match nul en playoff bloque toujours la
progression du bracket (`advancePlayoffsWithWinner` n'est appelé que si
`winner !== "draw"`) — c'est un défaut distinct, à traiter séparément ; pas
d'évitement des affrontements intra-poule au 1er tour au-delà de ce que le
serpentin garantit ; pas de bracket asymétrique (tailles hors 0/2/4/8).

## Impact

- **Capability** : `league-playoff-launch` (nouvelle — formalise la
  qualification par poule et le contrôle commissaire du lancement).
- **Code serveur** : `services/league-playoffs.ts` (fonction pure de sélection
  des seeds, nouvelles gardes, option `force`) ;
  `schemas/league.schemas.ts` (`playoffSize` dans le config, corps du start) ;
  `routes/league.ts` (`handleStartPlayoffs`, `handleUpdateSeasonConfig`).
- **Code web** : `PlayoffBracketView.tsx` (panneau commissaire),
  `leagues/[id]/page.tsx` (passage du `playoffSize` courant).
- **Données** : **aucune migration**. `LeaguePool.qualifiesForPlayoffs` et
  `LeagueSeason.playoffSize` existent déjà ; seule leur lecture change.
- **Rétro-compat** : saisons sans poule → seeding inchangé ; saisons dont les
  poules qualifient 0 → seeding inchangé ; brackets déjà générés → intouchés
  (`playoffs-already-started` reste prioritaire).
