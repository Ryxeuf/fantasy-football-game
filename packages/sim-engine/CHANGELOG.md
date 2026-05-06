# `@bb/sim-engine` changelog

Tracks tuning iterations and engine version bumps for the Pro League
sim engine. Used as the audit trail for sprint Pro League lots 0.D
(bench harness) and 0.E (tuning loop + gate).

Each version bump matches `ENGINE_VER` in `src/types.ts` and is
reflected in `bench/bench-baseline.json`.

## 0.3.0 — 2026-05-06 (sprint task 0.E.1 iter #2)

### Why bump

After iter #1 (`0.2.0`), the gate doc identified 3 remaining failures :
- **C1** std dev TD ≥ 1.4 (was 0.9)
- **C2** upset rate not measurable (no `tv` on team profiles)
- **C3** Dwarves vs Skaven 32% / 50% (Skaven dominate, opposite of FUMBBL)
- Casualty rate 0.04 / match (FUMBBL ~1.0-1.5)

This iteration targets all four.

### Changes

- **`tv` field** on `ProTeamProfile` — populated for all 16 teams based
  on race archetype (Halflings 800, Ogres 900, Norse-alt-Outlaws 950,
  most rosters 1000, Dwarves 1050, all-elf rosters 1100). Enables C2
  measurement and the underdog boost (lot 0.C.3).
- **Block resolver armor + injury chain** (`block.ts`) — when a block
  produces a knockdown (POW, STUMBLE, BOTH_DOWN without block skill),
  the resolver now rolls 2d6 vs AV+1 ; if armor breaks, an injury roll
  (2-7 stunned, 8-9 KO, 10+ casualty) determines the victim's state and
  emits the corresponding `KO` / `CASUALTY` MatchEvent. Previously the
  defender just went prone with no injury chain.
- **`rollYards` defense counter-term** — adds `-bashIndex/40` (rounded)
  on the opposing team to slow drives against bash defenses. This
  partially fixes the iter #1 over-reward of `pace`.
- **`rollYards` fat-tail variance** — 1% chance of +20 yards
  breakthrough, 1% chance of -10 yards crush. Increases TD variance
  per match.

### Observed deltas vs 0.2.0 (200 runs / pairing, seed=0)

| Matchup | 0.2.0 H/D/A | 0.3.0 H/D/A | Casualties | Upset rate |
|---|---|---|---|---|
| Smashers vs Soaring Hawks | 82 / 47 / 71 | 83 / 57 / 60 | 0.04 → 0.09 | now 70.0% |
| Snow Ogres vs Cheese Halflings | 93 / 58 / 49 | 104 / 74 / 22 | 0.04 → 0.12 | now 48.0% |
| Iron Bears vs Gold Rush | 57 / 46 / 97 | 55 / 53 / 92 | 0.04 → 0.07 | now 72.5% |
| Cold Tacticians vs Tomb Cardinals | 70 / 62 / 68 | 66 / 82 / 52 | 0.04 → 0.12 | parité TV (no fav) |

### Gate criteria status

- ✅ **C2 upset rate** : maintenant mesurable grâce au `tv` per-team. Premières mesures : 48-72% — TROP HAUT (cible 12-18%) ; signal que la sim sur-récompense les outsiders. À ajuster en iter #3 (sample plus de pairings TV-balanced).
- ⚠️ **Casualty rate** : 0.04 → 0.07-0.12 (+75-200%). Toujours sous FUMBBL ~1.0 mais variance positive sur les matchups bash (Norse, Ogres, Beastmen) ; les multi-blocks par turn manquent encore dans la synthèse 1v1.
- ❌ **C1 std dev TD** : 0.85 → 0.75-0.85. Fat-tails 1% trop rares
  (≈ 0.32 events / match) pour bouger l'écart-type. Iter #3 doit
  augmenter à 3-5%.
- ❌ **C3 Dwarves vs Skaven** : 32% → 27.5% (régression légère). Le
  bash counter-term n'est pas suffisant face au pace 90 des Skaven.

### Known gaps (iter #3)

1. **Std dev TD** : monter `breakthrough` à 5%, ajouter une "defensive
   stop" event qui termine un drive prématurément.
2. **Upset rate trop élevé** : la déviation du favori est trop
   pénalisée par les bash counter-terms. Soit calibrer en sens inverse,
   soit injecter un bonus "TV plus élevé = plus de skills donc moins
   de turnovers".
3. **Casualty rate** : ajouter un coup de pouce à la fréquence des
   blocks (incrementer `momentCount` quand bashIndex >= 70).
4. **Skaven > Dwarves** : ajuster le rapport pace/bash. Actuellement
   bash 90 → -2 yards mais pace 90 → +2 yards = net 0. Il faut que
   bash défensif > offensive pace.

## 0.2.0 — 2026-05-06 (sprint task 0.E.1, first tuning iteration)

### Why bump

The 0.1.0 engine produced racially-homogeneous matches : every team
got `st=3, ag=3, ma=6` at the synthetic LOS, so a Wood Elves vs Tomb
Kings match looked statistically identical to a Halflings vs Ogres
match (~33-40% home winrate, ~1.7 TDs / match, ~0.04 casualties / match,
all races within 5% of one another). Sprint 0.E.1 mandates "tous les
matchups raciaux dans ±10% du winrate FUMBBL" — that target was
unreachable without race-aware stats.

### Changes

- **Race-aware LOS stats** (`buildKeyMomentState` in
  `src/driver/hybrid-driver.ts`) : the synthetic 2-player LOS now
  derives `st / ag / ma` from the team's `TacticalProfile` :
  - `st = 2 + round(bashIndex / 25)` ∈ [2, 6]
  - `ag = 1 + round(breakawayInstinct / 33)` ∈ [1, 4]
  - `ma = 4 + round(pace / 25)` ∈ [4, 8]
  - Iconic skills granted at thresholds : `block` (bashIndex ≥ 80),
    `dodge` (breakawayInstinct ≥ 75), `pass` (passingFrequency ≥ 75),
    `dirty_player` (foulFrequency ≥ 75).
- **Pace-driven yard advancement** (`rollYards`) : the previous
  `2d6 + 2` (mean ~7) is now `2d6 + 2 + (pace/25 - 2)` :
  - pace 0 (Tomb Kings, Ogres) → mean ~5
  - pace 50 (default) → mean ~7
  - pace 100 (Skaven, Halflings) → mean ~9
  - Floored at 0 (no negative yards).

### Observed deltas (200 runs / pairing, seed=0)

| Matchup | 0.1.0 home / draw / away | 0.2.0 home / draw / away | Note |
|---|---|---|---|
| Cheese Halflings vs Snow Ogres | 33 / 35 / 32 | **42 / 49 / 109** | Ogres now dominate (~55%), Halflings underdog (~21%) |
| Soaring Hawks vs Tomb Cardinals | 31 / 39 / 30 | 70 / 62 / 68 | Wood Elves balance Khemri (near parity) |
| Iron Bears vs Gold Rush | (untested) | 57 / 46 / 97 | Skaven dominate Dwarves (counter-FUMBBL — see "known gaps" below) |
| Smashers vs Swamp Lizards | (untested) | 89 / 58 / 53 | Orcs > Lizardmen (consistent with FUMBBL) |

Bench baseline pairings (`pit-smashers`, `buf-snow-ogres`, `chi-iron-bears`)
re-snapshotted at engineVer 0.2.0 ; CI gate PASS.

### Known gaps (next iteration)

1. **Dwarves vs Skaven** : current model over-rewards `pace` ; in FUMBBL,
   Dwarves benefit from defensive bash + AV9 + reroll usage. Next iteration
   should add a `bashIndex` term to the underdog-resilience formula
   (turnovers absorbed by tank teams).
2. **Casualty rate** still ~0.04 / match across all matchups (FUMBBL avg
   ~1.0-1.5). The block resolver triggers casualties only on POW + armor
   break + injury 10+ with ST=3 vs ST=3. Now that ST varies, this should
   improve naturally in v0.3.0 — to be confirmed in next bench loop.
3. **TD mean** still ~1.5-2.2 (FUMBBL Wood Elves ~2.4, Halflings ~1.0).
   Yard advancement now varies by pace, which closes part of the gap.
4. **Sprint target `meetsTargets`** still failing : std dev TD < 1.4 and
   upset rate not measurable on equal-TV bench pairings (need TV gap).

### Not changed

- `tactical-profile.ts` schema (15 dimensions, [0, 100] integer) — unchanged.
- 16 `race-profiles.ts` values — unchanged ; the same profiles now
  produce different match outcomes thanks to the LOS stat derivation.
- All tests pass (sim-engine 258/258, monorepo typecheck vert).
- Public API (`simulateMatch`, `runBench`, `narrateMatch`) unchanged.

## 0.1.0 — 2026-05-05 (initial release)

Lot A (workspace + PRNG + MatchEvent format + resolvers + driver)
through Lot D (bench harness + FUMBBL reference + CI regression gate)
delivered at engineVer 0.1.0. See sprint Pro League lot completion
table for the exhaustive PR list.
