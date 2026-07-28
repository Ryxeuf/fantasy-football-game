# Design — colonnes étendues du classement de ligue

## Contexte

`computeSeasonStandings` lit exclusivement les compteurs matérialisés de
`LeagueParticipant` (`wins/draws/losses/points/touchdownsFor/
touchdownsAgainst/casualtiesFor/casualtiesAgainst`), écrits par
`league-match-result` et `league-forfeit`. Aucune des cinq nouvelles
métriques demandées (`For`, `P`, `Agr`, `SP`, `Exclu`) n'y figure.

## Décision 1 — agréger à la lecture plutôt que matérialiser

**Alternative A (retenue)** : agréger à la volée depuis
`LeagueMatchEvent` + `LeaguePairing.status`.

**Alternative B (rejetée)** : ajouter 5 compteurs sur
`LeagueParticipant`, incrémentés dans `league-match-result` /
`league-forfeit`.

| Critère | A (agrégation) | B (compteurs) |
|---|---|---|
| Migration Prisma | aucune | 1 migration + backfill des saisons en cours |
| Correction ex-post commissaire | reflétée immédiatement | nécessite de re-jouer les deltas (source de dérive) |
| Coût lecture | +2 requêtes par classement | 0 |
| Risque de désynchronisation | nul (source unique = les events) | réel (double écriture) |

Le classement est déjà une lecture peu fréquente et non temps-réel, et
l'édition ex-post de feuille de match par le commissaire existe (lots
G/H/I). B aurait introduit une seconde source de vérité qu'il aurait
fallu resynchroniser à chaque correction. A est retenue.

Les deux requêtes suivent le pattern `groupBy` du repo (cf. CLAUDE.md,
« Aggregation `groupBy` au lieu de N+1 ») : un `findMany` sur les
pairings de la saison, puis un `groupBy` unique sur les events par
`(matchSheetId, kind, team)`.

## Décision 2 — pliage pur, isolé du service Prisma

`foldSeasonExtraStats(pairings, eventCounts)` est 100 % pur : toute la
logique d'attribution (quel côté crédite quelle colonne, quels kinds
sont ignorés, quels statuts comptent comme forfait) est testable sans
DB. `aggregateSeasonExtraStats` se limite aux deux requêtes et à la
normalisation du résultat.

Convention de `team` héritée de `league-match-summary` : `team` désigne
l'équipe **à l'origine** de l'event. Donc `crowd_surge` est crédité à
l'équipe qui bénéficie de la sortie (colonne `SP`), et `expulsion` à
l'équipe dont le joueur est expulsé (colonne `Exclu` = exclusions
subies).

## Décision 3 — les colonnes étendues ne peuvent pas casser le classement

`loadSeasonExtraStatsSafely` encapsule l'agrégation dans un
`try/catch` : en cas d'échec, on `serverLog.error` et on retombe sur des
colonnes à zéro. Un classement dégradé reste très préférable à un
classement en erreur 500. Même esprit que les hooks post-settlement
isolés (Q.D.1).

## Décision 4 — `For` expose des points, pas un compte

Le coach écrit « For = pts en retrait dû au forfait ». On expose donc
`forfeitPoints = forfeits × League.forfeitPoints` (barème par défaut
`-1`), c'est-à-dire les points effectivement encaissés au titre des
forfaits — déjà inclus dans `points`, comme la colonne `Bo`. Le compte
brut reste disponible dans `forfeits` pour un usage futur.

Piège : `0 * -1` vaut `-0` en JavaScript, qui sérialise en `-0` dans le
JSON et s'affiche « -0 » dans la cellule. Le service normalise
explicitement le cas `forfeits === 0`.

## Décision 5 — rétro-compatibilité totale du contrat API

Tous les nouveaux champs de `StandingRow` sont optionnels (`?`) des deux
côtés, suivant le pattern « Backwards-compat sur champs API ajoutés »
du repo. Côté UI, les compteurs absents valent `0` et `Diff Sor` est
recalculé depuis `casualtiesFor - casualtiesAgainst`. Le frontend peut
donc être déployé avant ou après le serveur.

## Décision 6 — colonnes déclaratives côté UI

Le tableau est piloté par un tableau de `StandingsColumn`
(`key`, `label`, `hint`, `detail`, `value`) plutôt que par du JSX
dupliqué en-tête/cellule. Ajouter une colonne = ajouter une entrée ; le
flag `detail` suffit à la placer dans le bloc dépliable. Cela garde le
composant sous 250 lignes malgré le passage de 11 à 19 colonnes.

Les `data-testid` de cellules passent de `standings-row-<pid>-<key>` à
`standings-cell-<pid>-<key>` : le préfixe `standings-row-` identifie
désormais uniquement les lignes, sans quoi un sélecteur par préfixe
(utilisé dans `page.test.tsx`) remonterait aussi les cellules.
