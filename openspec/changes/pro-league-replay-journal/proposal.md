# Pro League — le journal rejouable (lot 2)

## Pourquoi

Un replay du full driver (`Replay.payload`, v1) stocke un `GameState` COMPLET
après chaque coup, chacun embarquant le `gameLog` cumulé : mesuré sur
`ENGINE_VER 0.27.0` avec des rosters de 13 joueurs, **2,3 Mo compressés par
match** pour ~550 coups. Et rien n'y est rejouable : les dés d'un coup ne sont
pas enregistrés, le flux de dés est UNIQUE pour tout le match (l'IA et les
coups précédents le consomment), donc on ne peut ni reproduire un coup isolé
ni poser le match sur un plateau physique.

Deuxième des cinq lots de l'exploration
[`docs/roadmap/explorations/2026-10-05-pro-league-match-integral.md`](../../../docs/roadmap/explorations/2026-10-05-pro-league-match-integral.md)
(§5, décision 4 de la §8 : « RNG forké par coup ET dés enregistrés »).

## Quoi

1. **Un flux de dés par coup.** Le full driver donne au coup `n` le flux
   `makeRNG(`${seed}:move:${n}`)` (et `drive:${n}` à une remise en jeu
   headless, `toss` / `kickoff` au pré-match). Le résultat d'un coup ne dépend
   plus de ce que l'IA a tiré en réfléchissant.
2. **Le journal** : `{ v: 2, seed, initialState (sans gameLog), steps[] }`,
   chaque pas portant le coup appliqué et les dés consommés (entrées `dice`
   du log du moteur). `replayJournal(journal)` re-dérive TOUS les états bit à
   bit (`gameLog` compris).
3. **Payload v2** : `{ v: 2, events, journal }` ; le v1 (`fullReplay`
   snapshots) reste décodable, et le serveur DÉRIVE `fullReplay` d'un journal
   pour que `/pro-league/matches/:id/full-replay` garde son contrat.
4. **Feuille de match papier** (`renderMatchSheet`) : une ligne par
   activation (joueur, chemin case par case, action, dés), groupée par
   mi-temps, tour et équipe, touchdowns, turnovers, remises en jeu ; servie en
   texte par `GET /admin/sim/matches/:id/narration?format=sheet`.
5. **Viewer** : navigation par ACTIVATION (boutons « activation précédente /
   suivante » dans la vue terrain), le pas par coup restant disponible.
6. Un touchdown obtenu par une POUSSÉE efface le choix de suivi en attente
   (trouvé par les invariants du lot 1 sur un flux de dés par coup).

`ENGINE_VER` passe à 0.28.0 (les issues changent à graine constante),
`bench/bench-baseline.json` est re-snapshoté.

## Mesuré (Orques vs Elfes sylvains, 10 graines)

| | v1 (0.27.0) | v2 (0.28.0) |
|---|---|---|
| Payload compressé | 2,27 Mo | **13,5 Ko** (max 15,5 Ko) |
| Coups par match | 547 | 547, dont 131 avec dés |
| Re-dérivation des états | — | 36 ms |
| Rejeu bit à bit | — | 5 graines en CI, `gameLog` compris |

## Hors périmètre

- Mise en place et coup d'envoi comme COUPS du journal : l'état initial est
  pris APRÈS le coup d'envoi d'ouverture, les remises en jeu sont des pas
  `drive` rejoués headless. Les rendre explicites attend le lot 3 (placement
  tactique).
- Dés rendus par `BlockDieIcon` / `D6Icon` sur le terrain, live par coups
  sur `/live` (lot 5), e2e Playwright du viewer.
- `coachProfiles` dans le journal (lot 4).
