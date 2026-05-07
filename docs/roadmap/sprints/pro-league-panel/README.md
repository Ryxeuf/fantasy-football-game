# Pro League — Panel BB Experts (sprint 0.E.3)

Kit complet pour le panel humain de validation Phase 0 → Phase 1 du
sprint Pro League. Cinq testeurs BB experts évaluent 50 replays
aléatoires sur 4 axes (lisibilité tactique, cohérence des drives,
identité raciale, moments mémorables) avec une grille 0-10. La
moyenne agrégée doit atteindre **≥ 7/10** pour passer le gate
(cf. `pro-league-gate.md` lot 0.E.4).

## Contenu

| Fichier | Rôle |
|---|---|
| [`panel-instructions.md`](./panel-instructions.md) | Brief testeur — recrutement, workflow, deadline |
| [`notation-grille.md`](./notation-grille.md) | Grille 0-10 vierge à dupliquer par testeur |
| [`score-synthesis.md`](./score-synthesis.md) | Aggregation des 5 grilles + verdict gate |
| [`replays/`](./replays/) | 50 replays texte deterministes (seed 2026) |

## Comment regenerer les replays

Les 50 fichiers `replay-XXX-*.txt` sont produits par :

```bash
pnpm --filter @bb/sim-engine sim:replay \
  --random=50 \
  --seed=2026 \
  --out=docs/roadmap/sprints/pro-league-panel/replays
```

Le seed `2026` est figé pour que tous les testeurs reçoivent le même
échantillon. Si l'engine est tuné (bump `engineVer` dans
`packages/sim-engine/CHANGELOG.md`), regénérer le set complet.

## Statut actuel

- Engine version : `0.13.0` (lot 0.E.1 iter #16, gate stat C1-C5 ✅)
- Replays générés : 50 (seed 2026, format narratif enrichi 2026-05-07)
- Panel recruté : **TODO** — recrutement humain hors scope automatique
- Synthèse remplie : **TODO** — après réception des 5 grilles

## Format narratif (post 2026-05-07)

Les `.txt` ont été enrichis pour rendre la lecture panel plus fidèle :

- Préfixe `[T+MM:SS]` sur chaque event (timing match-clock issu de `displayAtMs`).
- Annotation `(drive ±N yds)` sur les TURN_STARTs successifs même drive.
- Skill annotations sur BLOCK (`wrestled`) et DODGE (`[tackle blocks reroll]`).
- Détail `(armor=N, injury=M)` sur KO et CASUALTY quand disponible.
- Footer FINAL inchangé (compatible aggregation panel).

Restent agrégés à la turn (pas event-par-event) : déplacements simples, pickups
réussis, setups. Pour la plénitude visuelle, donner aux testeurs l'URL spectate
Pixi en complément du `.txt` (post-deploy).
