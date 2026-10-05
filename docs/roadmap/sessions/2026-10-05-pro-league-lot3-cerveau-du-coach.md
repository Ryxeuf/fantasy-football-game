# Session 2026-10-05 — Pro League lot 3 : le cerveau du coach

> Change OpenSpec `pro-league-coach-brain`. Troisième des cinq lots de
> l'exploration
> [`2026-10-05-pro-league-match-integral.md`](../explorations/2026-10-05-pro-league-match-integral.md),
> après le lot 1 (match complet, #1053) et le lot 2 (journal rejouable, #1055).

## Ce qui a changé

Le full driver ne choisit plus ses coups avec l'évaluateur glouton du moteur :
un **coach par équipe** (`packages/sim-engine/src/coach/`) tient un plan de
drive collant, planifie des activations entières (chemin le plus sûr + action
finale) scorées en espérance avec les probabilités DU MOTEUR, joue dans
l'ordre canonique de Blood Bowl, escorte le porteur là où il VA, libère un
porteur marqué avant de le faire esquiver, décide les relances selon le plan,
et tire ses activations par softmax tempéré par le profil, le momentum et le
score. Le bench CI mesure désormais le full driver (20 matchs par duel).

## Mesuré

| | Lot 1 (0.27.0) | Lot 3 (0.29.0) | Référence FUMBBL |
|---|---|---|---|
| TD / match, Orques – Elfes sylvains | 0,5 | 1,9 | 4,1 |
| TD / match, Ogres – Halflings | — | 1,6 | 2,1 |
| TD / match, Nains – Vipères | — | 1,5 | 3,7 |
| Sorties / match (trois duels) | — | 1,15 à 1,5 | 2,1 à 2,7 |
| Turnovers / match | ~16 | 6,5 à 12 | 6 à 10 |
| Calcul par match | 0,8 s | ~1 s | ≤ 30 s (décision 5) |

## Huit bugs du moteur trouvés par le bench

Le bench a d'abord servi de détecteur : à chaque palier, la mesure qui ne
bougeait pas pointait une règle fausse du moteur plutôt qu'un défaut du
coach. Dans l'ordre où ils ont coûté le plus :

1. **Le porteur rejouait un ramassage à chaque case** (40 jets par match, un
   turnover sur six) — `state.ball` suit le porteur et chaque handler de
   mouvement testait « atterrit sur le ballon ».
2. **Le ballon restait coincé sous un joueur au sol**, parfois plusieurs
   tours — les résolutions de blocage le posaient « en attendant le rebond de
   l'appelant » que personne n'appelait, et un rebond s'arrêtait sous un
   joueur au sol ou sans PM. `settleLooseBall` après chaque coup.
3. **Un porteur KO emportait le ballon en réserve** ; Les Deux Plaqués ne
   lâchait le ballon que pour l'attaquant.
4. **Pas de remise en jeu** : le ballon « rebondissait » contre la touche.
5. **Deux dés annoncés, un dé lancé** : un soutien de blocage exigeait des
   PM restants — donc aucun après les déplacements.
6. **Le dernier joueur activé était coupé après une case** : tous ayant
   « agi », `shouldAutoEndTurn` fermait le tour.
7. **Neuf tours par mi-temps** : le compteur de rounds et l'ordre
   d'alternance lisaient `kickingTeam`, qui change après chaque TD
   (`halfKickingTeam`).
8. **La 2e mi-temps était engagée par le dernier marqueur** (même cause).

## Pièges du coach

- **La cage retenait le porteur** : les gardes adjacents valaient +18/+24
  chacun, chaque pas en avant les « perdait ». Soutien POTENTIEL (coéquipiers
  qui peuvent rejoindre la destination) et escorte ancrée sur la case visée.
- **Le porteur ne rentrait pas dans l'en-but** quand la progression par case
  valait 30 : à une case du but, sa base valait déjà plus que 1000. Le gain
  d'un TD est posé SUR la base.
- **Le coût d'un turnover de porteur** à 80 % de la possession interdisait
  toute esquive ; un porteur qui chute lâche le ballon sur place, la
  possession est disputée (50 %).
- **« Stall » et « blitz-train »** hérités du driver hybride se déclenchaient
  sur le seul profil (geler le ballon à 18 cases de l'en-but, presser avec le
  ballon) : conditionnés au score et à la possession.
- **Une version lente** (6 s par match) ré-évaluait tout l'état par case ;
  la fonction de valeur locale et le contexte précalculé ramènent à ~1 s.
- **Le smoke de perf** du lot 1 (p95 < 5 s) tenait en local mais pas sur le
  runner CI partagé (turbo en parallèle) : 15 s.

## Ce qui reste (calibrage, suites du change)

Le porteur avance de 2 à 3 cases par tour et n'a, au premier coup du tour,
aucun déplacement acceptable dans la moitié des cas : les zones de tacle
adverses couvrent ses cases avant parce que la défense marque le porteur à
chaque tour sans que cela lui coûte assez. Passes et remises restent rares.
Turnovers des duels agiles à 11-12. Pistes dans le change. Le panel humain
(décision 7) est à tenir par le coach sur les replays Terrain.
