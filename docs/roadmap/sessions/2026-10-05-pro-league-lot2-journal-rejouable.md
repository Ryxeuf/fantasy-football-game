# Session 2026-10-05 — Pro League lot 2 : le journal rejouable

> Change OpenSpec `pro-league-replay-journal`. Deuxième des cinq lots de
> l'exploration
> [`2026-10-05-pro-league-match-integral.md`](../explorations/2026-10-05-pro-league-match-integral.md),
> à la suite du lot 1
> ([`2026-10-05-pro-league-lot1-match-complet.md`](./2026-10-05-pro-league-lot1-match-complet.md)).
> Objectif : qu'un match se REJOUE (sur le site, sur un plateau) à partir de
> ses coups et de ses dés, pas de photos de l'état.

## Ce qui a changé

| Avant (0.27.0) | Après (0.28.0) |
|---|---|
| Un `GameState` complet par coup, `gameLog` cumulé : 2,27 Mo compressés | État initial + 547 coups + dés : **13,5 Ko** |
| Un seul flux de dés pour tout le match, consommé aussi par l'IA | Un flux PAR PAS (`seed:move:n`, `seed:drive:n`), l'IA tire à part |
| Aucun dé enregistré | Les entrées `dice` ajoutées par chaque coup (131 pas sur 547) |
| Pas de rejeu possible | `replayJournal` re-dérive les états bit à bit en 36 ms |
| Pas de trace papier | `renderMatchSheet`, servie par `?format=sheet` (admin) |
| Pas par coup dans le viewer | Pas par ACTIVATION (`replay-activations`, boutons dans la vue terrain) |

Le serveur stocke le journal (`sim-runner`) et DÉRIVE `fullReplay` à la
lecture : l'endpoint `/full-replay`, le hook web et les annotations gardent
leur contrat ; un replay v1 archivé se lit comme avant.

## Pièges rencontrés

- **Une mutation en place cassait le rejeu au pas 496** : `calculateMatchResult`
  incrémentait `matchStats[...].mvp` dans l'objet partagé ; l'IA l'appelait
  en lookahead (2-ply sur `END_TURN`) sur un clone partiel, donc l'état RÉEL
  changeait. Copie profonde + retour explicite. Toute fonction du moteur que
  l'IA appelle en simulation doit être pure, `cloneGameState` ne protège que
  les sous-arbres qu'il connaît.
- **Changer le flux de dés révèle des cas nouveaux** : la graine 13 a produit
  un porteur repoussé dans l'en-but adverse, TD attribué avec un
  `pendingFollowUpChoice` encore ouvert — les invariants du lot 1 l'ont
  attrapé. `awardTouchdown` efface désormais poussée et suivi.
- **Les dés se lisent par DIFFÉRENCE de log** (références des entrées), pas par
  index : le moteur tronque le log en fin de tour.
- **CI du lot 1** : le smoke de perf (p95 < 5 s) tenait en local (~1 s) mais pas
  sur le runner partagé où turbo lance toutes les suites en parallèle (5,8 s) ;
  budget porté à 15 s, qui attrape toujours une régression x5. Et deux tests de
  `@bb/tests` (continuation après blitz) ne résolvaient pas les choix de
  poussée rendus obligatoires par le lot 1.

## Suites

Lot 3 cerveau du coach (le journal est l'outil pour le juger à l'œil), dés
rendus par `BlockDieIcon` / `D6Icon` et live par coups sur `/live` (lot 5),
`coachProfiles` dans le journal (lot 4).
