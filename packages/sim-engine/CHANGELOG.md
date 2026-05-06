# `@bb/sim-engine` changelog

Tracks tuning iterations and engine version bumps for the Pro League
sim engine. Used as the audit trail for sprint Pro League lots 0.D
(bench harness) and 0.E (tuning loop + gate).

Each version bump matches `ENGINE_VER` in `src/types.ts` and is
reflected in `bench/bench-baseline.json`.

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
