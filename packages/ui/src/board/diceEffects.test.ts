import { describe, it, expect } from "vitest";
import type { GameLogEntry } from "@bb/game-engine";
import {
  detectDiceRollEvents,
  createDiceAnimation,
  updateDiceAnimation,
  getDiceDisplayValue,
  getDiceAlpha,
  DICE_ANIMATION_DURATION_MS,
  TUMBLE_PHASE_MS,
  HOLD_PHASE_MS,
  type DiceRollEvent,
  type DiceAnimation,
} from "./diceEffects";

/* ── Helper: minimal GameLogEntry ────────────────────────────────── */

function makeLogEntry(
  overrides: Partial<GameLogEntry> & { type: GameLogEntry["type"] },
): GameLogEntry {
  return {
    id: `log-${Math.random()}`,
    timestamp: Date.now(),
    message: "Test",
    ...overrides,
  };
}

/* ── detectDiceRollEvents ────────────────────────────────────────── */

describe("diceEffects — detectDiceRollEvents", () => {
  it("returns empty array when both logs are empty", () => {
    expect(detectDiceRollEvents([], [])).toEqual([]);
  });

  it("returns empty array when no new dice entries appear", () => {
    const prev = [makeLogEntry({ type: "action", message: "Move" })];
    const next = [
      makeLogEntry({ type: "action", message: "Move" }),
      makeLogEntry({ type: "action", message: "Block" }),
    ];
    expect(detectDiceRollEvents(prev, next)).toEqual([]);
  });

  it("detects a single new dice entry", () => {
    const prev = [makeLogEntry({ type: "action", message: "Move" })];
    const diceEntry = makeLogEntry({
      type: "dice",
      message: "Dodge : 4 vs 3+ = Reussi",
      playerId: "p1",
      team: "A",
      details: { diceRoll: 4, targetNumber: 3, success: true },
    });
    const next = [...prev, diceEntry];
    const events = detectDiceRollEvents(prev, next);
    expect(events).toHaveLength(1);
    expect(events[0].diceRoll).toBe(4);
    expect(events[0].success).toBe(true);
  });

  it("detects multiple new dice entries", () => {
    const prev: GameLogEntry[] = [];
    const dice1 = makeLogEntry({
      type: "dice",
      message: "Dodge",
      details: { diceRoll: 3, targetNumber: 3, success: true },
    });
    const dice2 = makeLogEntry({
      type: "dice",
      message: "GFI",
      details: { diceRoll: 1, targetNumber: 2, success: false },
    });
    const next = [dice1, dice2];
    const events = detectDiceRollEvents(prev, next);
    expect(events).toHaveLength(2);
  });

  it("ignores dice entries already present in previous log", () => {
    const diceEntry = makeLogEntry({
      type: "dice",
      message: "Roll",
      details: { diceRoll: 5 },
    });
    expect(detectDiceRollEvents([diceEntry], [diceEntry])).toEqual([]);
  });

  it("extracts diceRoll from details when available", () => {
    const prev: GameLogEntry[] = [];
    const diceEntry = makeLogEntry({
      type: "dice",
      message: "Armor: 8 vs 9+",
      details: { diceRoll: 8, targetNumber: 9, success: false },
    });
    const events = detectDiceRollEvents(prev, [diceEntry]);
    expect(events[0].diceRoll).toBe(8);
    expect(events[0].targetNumber).toBe(9);
    expect(events[0].success).toBe(false);
  });

  it("handles dice entries without details gracefully", () => {
    const prev: GameLogEntry[] = [];
    const diceEntry = makeLogEntry({
      type: "dice",
      message: "Some roll happened",
    });
    const events = detectDiceRollEvents(prev, [diceEntry]);
    expect(events).toHaveLength(1);
    expect(events[0].diceRoll).toBeUndefined();
  });

  it("preserves team and playerId from the log entry", () => {
    const prev: GameLogEntry[] = [];
    const diceEntry = makeLogEntry({
      type: "dice",
      message: "Roll",
      playerId: "player-42",
      team: "B",
      details: { diceRoll: 6 },
    });
    const events = detectDiceRollEvents(prev, [diceEntry]);
    expect(events[0].team).toBe("B");
    expect(events[0].playerId).toBe("player-42");
  });
});

/* ── createDiceAnimation ─────────────────────────────────────────── */

describe("diceEffects — createDiceAnimation", () => {
  const event: DiceRollEvent = {
    diceRoll: 5,
    targetNumber: 3,
    success: true,
    message: "Dodge : 5 vs 3+",
    team: "A",
    playerId: "p1",
  };

  it("creates an animation with zero elapsed time", () => {
    const anim = createDiceAnimation(event);
    expect(anim.elapsed).toBe(0);
    expect(anim.duration).toBe(DICE_ANIMATION_DURATION_MS);
  });

  it("stores the final dice value", () => {
    const anim = createDiceAnimation(event);
    expect(anim.finalValue).toBe(5);
  });

  it("stores success and team info", () => {
    const anim = createDiceAnimation(event);
    expect(anim.success).toBe(true);
    expect(anim.team).toBe("A");
  });

  it("handles undefined diceRoll", () => {
    const noRollEvent: DiceRollEvent = {
      message: "Some dice roll",
    };
    const anim = createDiceAnimation(noRollEvent);
    expect(anim.finalValue).toBeUndefined();
  });
});

/* ── updateDiceAnimation ─────────────────────────────────────────── */

describe("diceEffects — updateDiceAnimation", () => {
  it("advances elapsed time", () => {
    const event: DiceRollEvent = {
      diceRoll: 4,
      message: "Roll",
      success: true,
    };
    const anim = createDiceAnimation(event);
    const updated = updateDiceAnimation(anim, 100);
    expect(updated.elapsed).toBe(100);
  });

  it("returns null when animation exceeds duration", () => {
    const event: DiceRollEvent = {
      diceRoll: 4,
      message: "Roll",
      success: true,
    };
    const anim = createDiceAnimation(event);
    const updated = updateDiceAnimation(anim, DICE_ANIMATION_DURATION_MS + 1);
    expect(updated).toBeNull();
  });

  it("returns new object (immutability)", () => {
    const event: DiceRollEvent = {
      diceRoll: 4,
      message: "Roll",
      success: true,
    };
    const anim = createDiceAnimation(event);
    const updated = updateDiceAnimation(anim, 50);
    expect(updated).not.toBe(anim);
    expect(anim.elapsed).toBe(0); // original unchanged
  });
});

/* ── getDiceDisplayValue ─────────────────────────────────────────── */

describe("diceEffects — getDiceDisplayValue", () => {
  it("returns a tumbling value during tumble phase (value cycles 1-6)", () => {
    const value = getDiceDisplayValue(5, 100); // 100ms into tumble
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(6);
  });

  it("returns the final value after tumble phase ends", () => {
    const elapsed = TUMBLE_PHASE_MS + 10; // after tumble
    const value = getDiceDisplayValue(3, elapsed);
    expect(value).toBe(3);
  });

  it("returns final value at exactly the tumble boundary", () => {
    const value = getDiceDisplayValue(6, TUMBLE_PHASE_MS);
    expect(value).toBe(6);
  });

  it("cycles through different values during tumble", () => {
    const values = new Set<number>();
    for (let t = 0; t < TUMBLE_PHASE_MS; t += 30) {
      values.add(getDiceDisplayValue(4, t));
    }
    // Should show at least 3 different values during tumble
    expect(values.size).toBeGreaterThanOrEqual(3);
  });
});

/* ── getDiceAlpha ────────────────────────────────────────────────── */

describe("diceEffects — getDiceAlpha", () => {
  it("fades in at the start (alpha increases from 0)", () => {
    const alphaStart = getDiceAlpha(0);
    const alphaEarly = getDiceAlpha(50);
    expect(alphaStart).toBeLessThanOrEqual(alphaEarly);
  });

  it("reaches full opacity during hold phase", () => {
    const alpha = getDiceAlpha(TUMBLE_PHASE_MS + 50);
    expect(alpha).toBeCloseTo(1);
  });

  it("fades out near the end", () => {
    const alphaMid = getDiceAlpha(TUMBLE_PHASE_MS + HOLD_PHASE_MS / 2);
    const alphaLate = getDiceAlpha(DICE_ANIMATION_DURATION_MS - 10);
    expect(alphaMid).toBeGreaterThan(alphaLate);
  });

  it("returns 0 at or beyond total duration", () => {
    expect(getDiceAlpha(DICE_ANIMATION_DURATION_MS)).toBeCloseTo(0);
    expect(getDiceAlpha(DICE_ANIMATION_DURATION_MS + 100)).toBe(0);
  });
});
