# Ligue physique — Licenciements (firing) réversibles (2026-06-25)

> Chantier 2 du « reste à faire » de
> [`league-physical-rework-2026-06-25.md`](./league-physical-rework-2026-06-25.md).
> Permet de **licencier** un joueur en fin de match (section LICENCIEMENTS de
> la feuille), de façon **réversible** et **sans perte d'historique**.

## Modèle

Champ `TeamPlayer.firedAt DateTime?` (PG + miroir sqlite) plutôt qu'un
`delete` : le joueur licencié est **retiré du roster actif** mais **conservé
en base** (carrière/historique). `firedAt = null` ⇒ actif.

La liste des licenciements est portée par la feuille :
`LeagueMatchSheet.firedPlayerIds Json?` (`[teamPlayerId]`, `String?` en miroir
sqlite).

Régénération des clients Prisma (PG + sqlite) effectuée ; les binaires
multi-plateformes du client sqlite committé sont préservés (seuls les fichiers
source `.js`/`.d.ts`/`schema.prisma` changent).

## Effet à la validation

`recordOfflineLeagueResult` applique les licenciements via
`applyOfflineFirings(homeTeamId, awayTeamId, firedPlayerIds)` :

1. valide l'appartenance aux 2 équipes + `firedAt: null` (pas déjà licencié) ;
2. pose `firedAt = now` sur les joueurs valides ;
3. recalcule la TV des équipes touchées (les licenciés quittent le roster) ;
4. retourne les ids **réellement** licenciés, mémorisés dans le snapshot
   (`firedApplied`) pour une réversion exacte.

`updateTeamValues` exclut désormais les joueurs licenciés (`firedAt`) **et**
morts du calcul de VE.

## Réversion (invalidation)

`reverseOfflineLeagueResult` ré-active les joueurs licenciés par ce match
(`firedAt = null` pour `snapshot.firedApplied`) et recalcule la TV des 2
équipes. Aucun garde-fou supplémentaire requis (un joueur licencié est inerte :
il ne peut plus être sélectionné dans une feuille ultérieure, cf. filtre
pickers).

## Pickers

`loadSheetTeams` (alimente `getMatchSheet`) filtre `where: { firedAt: null }`
sur les joueurs : un licencié **ne réapparaît plus** dans les pickers actifs
(MVP, acteur/cible d'event, SPP bonus, licenciement). Les morts restent
inclus mais flaggés. À l'invalidation, le joueur ré-activé réapparaît.

## UI

Section **Licenciements** dans le `PostMatchPanel` (par équipe) :
`FiredEditor` = liste de `PlayerSelect` + bouton retirer + « + licenciement ».
`page.tsx` parse/enregistre `firedPlayerIds` ; `postMatchSchema` (Zod) accepte
`firedPlayerIds: string[]` (max 32).

## Tests

- `league-offline-result.test.ts` (+1) — application : `firedAt` posé sur les
  joueurs valides, TV recalculée, `firedApplied` au snapshot.
- `league-offline-edit.test.ts` (+1) — réversion : `firedAt = null` + TV
  recalculée.
- `league-match-sheet.test.ts` (+1) — pickers : `team.findMany` filtre
  `firedAt: null`.

## Hors scope (assumé)

Les listings génériques de roster (builder online, `/me/teams`) n'appliquent
pas le filtre `firedAt` : `firedAt` n'est posé que par le flux ligue physique,
donc inerte ailleurs. Le périmètre du filtre est volontairement limité à la
feuille de match (pickers) + au calcul de TV.
