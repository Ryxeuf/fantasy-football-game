# Pro League — le cerveau du coach (lot 3)

## Pourquoi

Après les lots 1 et 2, un match du full driver est structurellement complet
et rejouable, mais il est joué par un évaluateur GLOUTON case par case
(`pickBestMove2Ply`) : aucun plan, aucune probabilité (une esquive à 4+ vaut
une case libre), aucune coordination (la cage, c'est cinq joueurs), des
choix résolus hors contexte. Mesuré sur `ENGINE_VER 0.28.0` : 0,5 TD par
match contre 3 à 4,8 en référence FUMBBL, 72 % des tours terminés sur
turnover. Troisième des cinq lots de l'exploration
[`docs/roadmap/explorations/2026-10-05-pro-league-match-integral.md`](../../../docs/roadmap/explorations/2026-10-05-pro-league-match-integral.md)
(§4 « le coach, le plan, le joueur », §8 décisions 1 et 7).

## Quoi

Un COACH par équipe (`packages/sim-engine/src/coach/`) remplace la sélection
de coups du full driver :

1. **Plan de drive collant** : choisi au début d'un drive par softmax
   (température du `riskAppetite`), ré-évalué seulement sur évènement.
   Il fixe formation, tempo, plancher de risque, politique de relance et
   d'agression, réserve du blitz.
2. **Modèle de probabilité** des jets, calé sur les cibles et modificateurs
   du moteur (esquive, GFI, ramassage, passe, réception, dés et soutiens de
   blocage, armure).
3. **Planificateur d'activations** : des activations ENTIÈRES (chemin le
   plus sûr + action finale) scorées en espérance, l'ordre canonique BB
   (sans dés → blocages à deux dés → blitz → ballon → esquives) quasi
   strict, les blocages qui libèrent le porteur valorisés.
4. **Fonction de valeur locale** : contribution par joueur selon le plan
   (progression, sécurité, escorte en coins de cage ancrée sur la case
   visée du porteur, mobilité, écran/pression/marquage).
5. **Rôles**, **personnalités**, **momentum** et **softmax** sur les
   meilleures activations.
6. **Choix** (dé, poussée, suivi, apothicaire, remise) par l'évaluateur du
   moteur ; **relance** selon le plan.
7. **Bench CI sur le full driver** (décision 1) : `runBench({ driverKind })`,
   baseline de 20 matchs par duel, `sim:bench:ci` mesure le driver de
   production.

Au passage, huit bugs du moteur trouvés par le bench (ballon, soutiens,
activation, compteur de rounds) sont corrigés avec leurs tests.

## Mesuré (20 matchs par duel, baseline `0.29.0`)

| Duel | TD / match | Sorties | Turnovers | Référence FUMBBL (TD / match) |
|---|---|---|---|---|
| Orques – Elfes sylvains | 1,9 | 1,45 | 11,9 | 4,1 |
| Ogres – Halflings | 1,6 | 1,5 | 6,5 | 2,1 |
| Nains – Vipères (Skavens) | 1,5 | 1,15 | 11,8 | 3,7 |

Contre 0,5 TD par match au lot 1 ; ~1 s par match (budget ≤ 30 s). L'écart
restant au bench FUMBBL est connu et mesuré (cf. design « Ce qui manque
encore ») : il relève du calibrage, pas de l'architecture.

## Gate du lot (décision 7)

Bench FUMBBL : partiellement atteint (sorties dans la tolérance sur un duel,
TD à la moitié de la référence). Panel humain (3 à 5 coachs sur 20 replays
Terrain) : à tenir par le coach — les replays sont lisibles pas par pas et
par activation depuis le lot 2.

## Hors périmètre

- `ProCoach` persisté, adaptation bornée, mémoire expliquée (lot 4).
- Pool de `worker_threads`, cotes, bench nocturne (lot 5).
- Calibrage fin du bench (tempo du porteur, défense qui marque trop, passes
  rares) : suites listées dans `tasks.md`.
