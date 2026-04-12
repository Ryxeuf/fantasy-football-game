# Sprint 2 — Game Engine Stabilization

> Remaining bugs found by multi-agent analysis (2026-04-12).
> Sprint 1 fixed: armor roll 1D6→2D6, double RNG consumption, missing injury roll,
> Wrestle turnover, handlePushBack auto follow-up, handleBlock extra RNG.

## HIGH Priority

### 2.1 — State mutation throughout blocking.ts and injury.ts

**Severity:** HIGH
**Files:**
- `packages/game-engine/src/mechanics/blocking.ts` (lines 562, 599, 620, 640–648, 675–683, 724–725, 766–769, 778, 797, 800, 811–812, 825–828, 843–844, 862–865, 878, 896–900)
- `packages/game-engine/src/mechanics/injury.ts` (lines 54–56, 130–133)

**Problem:** `handlePlayerDown`, `handleBothDown`, `handlePushBack`, `handleStumble`, `handlePow` all directly mutate the `state` parameter (`state.players = ...`, `state.isTurnover = true`, `state.gameLog = ...`). While a `structuredClone` is done upstream in `resolveBlockResult`, this is fragile and inconsistent with the project's immutability rule.

**Fix:** Replace all direct assignments with spread-based immutable updates:
```typescript
// Before
state.players = state.players.map(...)
state.isTurnover = true;

// After
return { ...state, players: state.players.map(...), isTurnover: true };
```

---

### 2.2 — PLAYER_DOWN armor roll uses stale attacker reference

**Severity:** HIGH
**File:** `packages/game-engine/src/mechanics/blocking.ts:560–604`

**Problem:** After `state.players = state.players.map(...)` at line 562, the local `attacker` variable is not updated. Line 575 calls `performArmorRollWithNotification(attacker, rng)` with the pre-mutation snapshot, using potentially stale AV.

**Fix:** Re-fetch the attacker from `state.players` after the map update:
```typescript
const updatedAttacker = state.players.find(p => p.id === attacker.id)!;
const attackerArmorResult = performArmorRollWithNotification(updatedAttacker, rng);
```

---

### 2.3 — canBlock incorrectly prevents blocking tired-but-standing players

**Severity:** HIGH
**File:** `packages/game-engine/src/mechanics/blocking.ts:108–111`

**Problem:** `if (target.stunned || target.pm <= 0) return false;` — A player with 0 PM who is not stunned CAN be blocked in Blood Bowl rules. The `pm <= 0` check on the **target** is incorrect. A standing target with 0 movement remaining is still a valid block target.

**Fix:** Remove the `pm <= 0` check for the target:
```typescript
// Attacker check: must have PM or be performing a block action
if (player.stunned || player.pm <= 0) return false;
// Target check: only check stunned status
if (target.stunned) return false;
```

---

### 2.4 — handleFollowUpChoose double-move risk

**Severity:** HIGH
**File:** `packages/game-engine/src/actions/actions.ts:1218–1258`

**Problem:** If `handlePushBack` already moved the attacker (via the now-fixed auto-follow path) AND `handleFollowUpChoose` runs, the attacker could be double-moved. While Sprint 1 fixed the single-direction auto-follow, the `handleFollowUpChoose` function still doesn't validate that the `targetOldPosition` is free.

**Fix:** Add validation that `targetOldPosition` is unoccupied before moving the attacker.

---

### 2.5 — isPositionOccupied includes dugout players at (-1,-1)

**Severity:** HIGH
**File:** `packages/game-engine/src/mechanics/movement.ts:34–36`

**Problem:** All dugout/off-field players have `pos = { x: -1, y: -1 }`. `isPositionOccupied` doesn't filter them out. If any code checks position (-1,-1), it returns true for 16+ players.

**Fix:** Filter out off-field players:
```typescript
export function isPositionOccupied(state: GameState, pos: Position): boolean {
  return state.players.some(p =>
    p.pos.x >= 0 && p.pos.y >= 0 &&
    p.pos.x === pos.x && p.pos.y === pos.y
  );
}
```

---

### 2.6 — Injury injuryType field confusion

**Severity:** HIGH
**File:** `packages/game-engine/src/mechanics/injury.ts:165–179`

**Problem:** `seriously_hurt` stores `injuryType: 'niggling'` as a "placeholder". The same field is used by `serious_injury` to mean actual Niggling Injury. Post-match code reading `injuryType === 'niggling'` cannot distinguish the two.

**Fix:** Use a distinct value like `injuryType: 'none'` for `seriously_hurt`:
```typescript
newState.lastingInjuryDetails[player.id] = {
  outcome: 'seriously_hurt',
  injuryType: 'none',
  missNextMatch: true,
};
```

---

## MEDIUM Priority

### 2.7 — calculateBlockDiceCount floating-point comparison

**Severity:** MEDIUM
**File:** `packages/game-engine/src/mechanics/blocking.ts:292–304`

**Problem:** `attackerStrength < targetStrength / 2` uses floating-point division. Should use integer math: `attackerStrength * 2 < targetStrength`.

**Fix:**
```typescript
if (attackerStrength * 2 < targetStrength) return 3;  // defender picks
```

---

### 2.8 — throw-team-mate applyScatters doesn't clamp per-step

**Severity:** MEDIUM
**File:** `packages/game-engine/src/mechanics/throw-team-mate.ts:148–163`

**Problem:** `applyScatters` accumulates all scatter directions without per-step boundary checks. BB rules say a thrown player leaving the field triggers crowd injury at the exit point, not after accumulating all scatters.

**Fix:** Check bounds after each scatter step and stop immediately if out of bounds.

---

### 2.9 — endPlayerTurn hardcodes action to 'MOVE'

**Severity:** MEDIUM
**File:** `packages/game-engine/src/core/game-state.ts:1054–1071`

**Problem:** `setPlayerAction(state, playerId, 'MOVE')` overwrites whatever action the player actually performed. Code checking `getPlayerAction(state, playerId) === 'BLITZ'` after `endPlayerTurn` will fail.

**Fix:** Accept the action type as a parameter or preserve the existing action:
```typescript
export function endPlayerTurn(state: GameState, playerId: string): GameState {
  // Don't overwrite the action — just mark the player as having acted
  const newState = { ...state };
  // ...
}
```

---

### 2.10 — bounceBall infinite recursion risk

**Severity:** MEDIUM
**File:** `packages/game-engine/src/mechanics/ball.ts:127–235`

**Problem:** If every bounce position has a player who fails to catch, the ball recurses indefinitely. No depth limit exists.

**Fix:** Add a max bounce counter (e.g., 20):
```typescript
export function bounceBall(state: GameState, rng: RNG, depth = 0): GameState {
  if (depth >= 20) return state; // safety valve
  // ...
  return bounceBall(newState, rng, depth + 1);
}
```

---

### 2.11 — handleBallPickup direct mutation pattern

**Severity:** MEDIUM
**File:** `packages/game-engine/src/actions/actions.ts:820–829`

**Problem:** Uses `state.gameLog = [...]` and `state.players[idx].hasBall = true` instead of spread. While the state is cloned upstream, this is fragile.

**Fix:** Use immutable spread pattern throughout.

---

### 2.12 — calculateFoulAssists may count off-field players

**Severity:** MEDIUM
**File:** `packages/game-engine/src/mechanics/foul.ts:42–58`

**Problem:** Offensive assist counter doesn't filter by `player.state === 'active'`. A `sent_off` player at (-1,-1) could theoretically match adjacency.

**Fix:** Add `player.state === 'active'` or `player.pos.x >= 0` filter.

---

## LOW Priority

### 2.13 — endPlayerTurn reads player from old state for log

**Severity:** LOW
**File:** `packages/game-engine/src/core/game-state.ts:1054–1071`

**Problem:** Reads `state.players.find()` from old state instead of `newState.players.find()`. Functionally works since player identity doesn't change, but inconsistent.

---

## Checklist

- [ ] 2.1 — Immutable state in blocking.ts / injury.ts
- [ ] 2.2 — Stale attacker reference in PLAYER_DOWN
- [ ] 2.3 — canBlock target PM check
- [ ] 2.4 — handleFollowUpChoose validation
- [ ] 2.5 — isPositionOccupied dugout filter
- [ ] 2.6 — Injury injuryType confusion
- [ ] 2.7 — Block dice count float comparison
- [ ] 2.8 — TTM scatter per-step bounds
- [ ] 2.9 — endPlayerTurn hardcoded MOVE
- [ ] 2.10 — bounceBall recursion guard
- [ ] 2.11 — handleBallPickup mutation
- [ ] 2.12 — Foul assists off-field filter
- [ ] 2.13 — endPlayerTurn log from old state
