# Investigation moteur 0.16.0 — TD/match trop bas

> **2026-05-12** — User rapporte 4 matchs sandbox consecutifs 0-0 sur
> les pairings : Gold Rush vs Iron Bears (x2), Tomb Cardinals vs Gold
> Rush, Smashers vs Vipers. EngineVer 0.16.0.
>
> Investigation : le tuning actuel produit **0.95 TD/match en moyenne**
> sur 120 matchups (matrix bench), bien en-dessous de la baseline
> FUMBBL (1.5-2.2 selon race).

## Constat

### Bench matrix (20 runs/pairing × 120 pairings)

| Stat | Observe | Reference FUMBBL |
|---|---|---|
| TD/match mean | **0.95** | 1.5-2.2 selon race |
| TD/match min | 0.10 | — |
| TD/match max | 2.70 | — |
| Draw rate (single pairing) | **50-80%** | ~25-30% |

### Cas concret : Gold Rush (Skaven, fast) vs Iron Bears (Dwarf, slow)

5 runs, seed=42 :
- 4 draws, 1 away win
- TD mean 0.20 (vs Skaven FUMBBL ref 2.2)

50 runs, seed=1 :
- 9H / 18A / 23D (46% draws)
- TD mean 1.04, std 0.85

### Cas concret : match debug seed=42

- 16 turns total, 13 MOVE events
- MOVE breakdown : 8 "positioning" (16 yds total), 4 "halt" (0 yds), 1 "sweep" (12 yds)
- Total yards : home 18, away 10
- Pour scorer (yardline 4 → 26 = 22 yds), il faudrait ~22 yards par drive
- BLOCK success 0/3 (0%), DODGE 6/7, PASS 1/3

## Hypotheses

### Hypothese 1 : tuning `rollYards` trop conservateur (probable)

Le commentaire dans `hybrid-driver.ts:443-458` explique le re-tuning suite a un "Bug #2 panel feedback" :

> "breakthrough magnitudes 30/35/40 → 12/15/18. The original values
> meant a single breakthrough roll could traverse the entire 26-yard
> field, producing TDs from the kickoff line right after a single
> block. The reduced magnitudes still create 'long play' drama but
> multi-yard advances now require 2-3 turns to compose into a TD."

> "Hard cap at MAX_TURN_YARDS = 16 yards/turn. Belt-and-suspenders :
> even with the reduced magnitudes, dice + bonuses + breakthrough
> could still reach ~30 yards in extreme stacks. Capping at 16
> guarantees a drive needs at least 2 turns to score from the
> receiving yardline (4 + 16 = 20 < 26 = FIELD_YARDS)."

Math des yards/turn actuels (Skaven attack, Dwarf defense) :

```
dice = 2d6+2 (mean 7)
paceOffset = round(90/25) - 2 = +2
bashCounter = -round(90/28) = -3      // Dwarf bashIndex high
defensiveDisruption = -3              // Dwarf stall*bash high
tvBonus = round(-50/80) = -1
breakthrough = 0.18 * ~15 + 0.16 * -10 = +1.1
                                       ─────
Total mean = 7 + 2 - 3 - 3 - 1 + 1.1 = 3.1 yds/turn
```

Pour scorer 22 yds, il faut ~7-8 turns parfaits sans turnover. Avec
turnovers observes (~5/match), drives moyens font 2-3 turns avant
turnover. Donc TD rare.

### Hypothese 2 : starting yardline trop bas (4 / 26)

BB officiel utilise un terrain 26 yards × 15 hexes. Le receiving team
demarre vers son cote du terrain, pas a yardline 4. Selon BB rules, le
ball est au centre apres kick (yardline 13) ou plus selon kick distance.

Si on demarrait a yardline 8-10, on aurait besoin de 16-18 yds pour TD
au lieu de 22. C'est une difference materielle (1-2 turns de moins).

### Hypothese 3 : breakthrough trop rare (probable)

Probability breakthrough positif = 18%. Magnitudes 12/15/18 selon
defense bashIndex.

Pour les pairings rapides vs slow defense :
- Skaven (pace 90) vs Dwarf (bash 90) : breakthrough rarement positif
  car defenseProfile.bashIndex 90 ≥ 70 → magnitude minimum 12
- Le gain breakthrough est insufficient pour compenser le penalty
  defensif (-6)

## Recommendations possibles

| Option | Difficulte | Impact estime | Risque |
|---|---|---|---|
| **A.** Starting yardline 4 → 8 | trivial | +30% TDs (1 turn de moins) | Modere, casse baseline |
| **B.** Base dice 2d6+2 → 3d6+0 (mean 7 → 10.5) | facile | +50-60% TDs | Eleve, perte de granularite |
| **C.** Reduire defensiveDisruption max -3 → -2 | facile | +15-20% TDs | Faible |
| **D.** Augmenter breakthrough probability 18% → 25% | facile | +25-30% TDs | Modere |
| **E.** Breakthrough magnitudes 12/15/18 → 16/20/24 | facile | +30-40% TDs | Modere (vs panel feedback original) |
| **F.** Combo C + D | facile | +40-50% TDs | Modere |

**Recommandation initiale (a discuter)** : combo C + D, conservateur,
sans toucher aux magnitudes que le panel avait critiquees.

## Outils ajoutes pour debug

`packages/sim-engine/scripts/debug-match.ts` — nouvel utilitaire :

```bash
pnpm tsx scripts/debug-match.ts --teamA=sf-gold-rush --teamB=chi-iron-bears --seed=42
```

Affiche : event histogram, MOVE breakdown par kind, turnover reasons,
key moments success rates. Permet d'isoler la cause d'un drive sans TD.

Optionnel `--events` pour dump le stream complet d'events JSON.

## Process pour fix

1. Decide quelle option (A-F) tester en premier (input user)
2. Modifier `hybrid-driver.ts`
3. Re-run `pnpm sim:bench --matrix --runs=20 --seed=1` pour mesurer
4. Comparer contre `fumbbl-reference.ts` (race tdAverage)
5. Si OK : snapshot le nouveau baseline `pnpm tsx scripts/bench-baseline-snapshot.ts`
6. Bump `ENGINE_VER` 0.16.0 → 0.17.0 (changement comportement)

## Etat actuel

- Pas de fix applique (en attente input user)
- Script debug commit pour permettre investigation parallele
- Baseline 0.16.0 reste en place
- Tous les replays existants restent decodables
