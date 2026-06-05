/**
 * Lot E — Tests du service pur `league-bonus-points`.
 */

import { describe, it, expect } from "vitest";
import {
  evaluateBonusRules,
  parseBonusConfig,
  BONUS_PRESETS,
  type BonusRule,
  type MatchBonusContext,
} from "./league-bonus-points";

const baseCtx: MatchBonusContext = {
  tdsHome: 0,
  tdsAway: 0,
  casualtiesInflictedHome: 0,
  casualtiesInflictedAway: 0,
  winner: "draw",
};

describe("Lot E — evaluateBonusRules", () => {
  it("returns 0/0/[] when rules are empty or null", () => {
    expect(evaluateBonusRules([], baseCtx)).toEqual({
      homeBonus: 0,
      awayBonus: 0,
      applied: [],
    });
    expect(evaluateBonusRules(null, baseCtx)).toEqual({
      homeBonus: 0,
      awayBonus: 0,
      applied: [],
    });
    expect(evaluateBonusRules(undefined, baseCtx)).toEqual({
      homeBonus: 0,
      awayBonus: 0,
      applied: [],
    });
  });

  it("awards 1 pt to the side scoring 3+ TDs (both)", () => {
    const rule: BonusRule = {
      id: "r1",
      label: "3 TD",
      condition: { type: "tds_scored_gte", value: 3 },
      points: 1,
      appliesTo: "both",
    };
    const ctx: MatchBonusContext = {
      ...baseCtx,
      tdsHome: 3,
      tdsAway: 2,
      winner: "home",
    };
    const out = evaluateBonusRules([rule], ctx);
    expect(out.homeBonus).toBe(1);
    expect(out.awayBonus).toBe(0);
    expect(out.applied).toHaveLength(1);
    expect(out.applied[0]).toMatchObject({ ruleId: "r1", side: "home" });
  });

  it("awards bonus to both sides if both qualify", () => {
    const rule: BonusRule = {
      id: "r1",
      label: "3 TD",
      condition: { type: "tds_scored_gte", value: 3 },
      points: 1,
      appliesTo: "both",
    };
    const ctx: MatchBonusContext = {
      ...baseCtx,
      tdsHome: 4,
      tdsAway: 3,
      winner: "home",
    };
    const out = evaluateBonusRules([rule], ctx);
    expect(out.homeBonus).toBe(1);
    expect(out.awayBonus).toBe(1);
    expect(out.applied).toHaveLength(2);
  });

  it("awards bonus to winner only", () => {
    const rule: BonusRule = {
      id: "r1",
      label: "Won shutout",
      condition: { type: "shut_out_win" },
      points: 2,
      appliesTo: "winner",
    };
    const ctx: MatchBonusContext = {
      ...baseCtx,
      tdsHome: 3,
      tdsAway: 0,
      winner: "home",
    };
    const out = evaluateBonusRules([rule], ctx);
    expect(out.homeBonus).toBe(2);
    expect(out.awayBonus).toBe(0);
  });

  it("does not award winner/loser bonus on a draw", () => {
    const rules: BonusRule[] = [
      {
        id: "w",
        label: "Win shutout",
        condition: { type: "shut_out_win" },
        points: 2,
        appliesTo: "winner",
      },
      {
        id: "l",
        label: "Wood spoon",
        condition: { type: "tds_scored_gte", value: 0 },
        points: -1,
        appliesTo: "loser",
      },
    ];
    const ctx: MatchBonusContext = {
      ...baseCtx,
      tdsHome: 1,
      tdsAway: 1,
      winner: "draw",
    };
    const out = evaluateBonusRules(rules, ctx);
    expect(out.homeBonus).toBe(0);
    expect(out.awayBonus).toBe(0);
  });

  it("evaluates cas_inflicted_gte", () => {
    const rule: BonusRule = {
      id: "r2",
      label: "3 cas",
      condition: { type: "cas_inflicted_gte", value: 3 },
      points: 1,
      appliesTo: "both",
    };
    const ctx: MatchBonusContext = {
      ...baseCtx,
      casualtiesInflictedHome: 4,
      casualtiesInflictedAway: 2,
    };
    const out = evaluateBonusRules([rule], ctx);
    expect(out.homeBonus).toBe(1);
    expect(out.awayBonus).toBe(0);
  });

  it("evaluates clean_sheet (0 TDs conceded)", () => {
    const rule: BonusRule = {
      id: "r3",
      label: "Clean sheet",
      condition: { type: "clean_sheet" },
      points: 1,
      appliesTo: "both",
    };
    const ctx: MatchBonusContext = {
      ...baseCtx,
      tdsHome: 1,
      tdsAway: 0,
      winner: "home",
    };
    const out = evaluateBonusRules([rule], ctx);
    // home conceded 0 -> bonus ; away conceded 1 -> no bonus.
    expect(out.homeBonus).toBe(1);
    expect(out.awayBonus).toBe(0);
  });

  it("evaluates margin_gte", () => {
    const rule: BonusRule = {
      id: "r4",
      label: "Marge >= 3",
      condition: { type: "margin_gte", value: 3 },
      points: 2,
      appliesTo: "winner",
    };
    const ctx: MatchBonusContext = {
      ...baseCtx,
      tdsHome: 4,
      tdsAway: 1,
      winner: "home",
    };
    const out = evaluateBonusRules([rule], ctx);
    expect(out.homeBonus).toBe(2);
  });

  it("evaluates killings_gte", () => {
    const rule: BonusRule = {
      id: "r5",
      label: "3 kills",
      condition: { type: "killings_gte", value: 3 },
      points: 3,
      appliesTo: "home",
    };
    const ctx: MatchBonusContext = {
      ...baseCtx,
      killingsHome: 3,
      killingsAway: 0,
    };
    const out = evaluateBonusRules([rule], ctx);
    expect(out.homeBonus).toBe(3);
  });

  it("skips rules with non-finite or 0 points", () => {
    const rules: BonusRule[] = [
      {
        id: "zero",
        label: "Zero",
        condition: { type: "tds_scored_gte", value: 0 },
        points: 0,
        appliesTo: "both",
      },
      {
        id: "nan",
        label: "NaN",
        condition: { type: "tds_scored_gte", value: 0 },
        points: NaN,
        appliesTo: "both",
      },
    ];
    const out = evaluateBonusRules(rules, baseCtx);
    expect(out.applied).toHaveLength(0);
  });

  it("supports negative bonus points (malus)", () => {
    const rule: BonusRule = {
      id: "malus",
      label: "0 TD scored",
      condition: { type: "tds_scored_gte", value: 0 },
      points: -1,
      appliesTo: "loser",
    };
    const ctx: MatchBonusContext = {
      ...baseCtx,
      tdsHome: 0,
      tdsAway: 1,
      winner: "away",
    };
    const out = evaluateBonusRules([rule], ctx);
    // home is loser, 0 TDs >= 0 -> -1 pt
    expect(out.homeBonus).toBe(-1);
    expect(out.awayBonus).toBe(0);
  });

  it("accumulates multiple rules on the same side", () => {
    const rules: BonusRule[] = [
      {
        id: "r1",
        label: "A",
        condition: { type: "tds_scored_gte", value: 2 },
        points: 1,
        appliesTo: "both",
      },
      {
        id: "r2",
        label: "B",
        condition: { type: "cas_inflicted_gte", value: 1 },
        points: 2,
        appliesTo: "both",
      },
    ];
    const ctx: MatchBonusContext = {
      ...baseCtx,
      tdsHome: 3,
      casualtiesInflictedHome: 2,
    };
    const out = evaluateBonusRules(rules, ctx);
    expect(out.homeBonus).toBe(3);
    expect(out.applied).toHaveLength(2);
  });
});

describe("Lot E — parseBonusConfig", () => {
  it("parses an array directly (PG case)", () => {
    const raw = [
      {
        id: "x",
        label: "X",
        condition: { type: "tds_scored_gte", value: 3 },
        points: 1,
        appliesTo: "both",
      },
    ];
    const out = parseBonusConfig(raw);
    expect(out).toHaveLength(1);
    expect(out?.[0].id).toBe("x");
  });

  it("parses a JSON string (sqlite mirror case)", () => {
    const raw = JSON.stringify([
      {
        id: "x",
        label: "X",
        condition: { type: "tds_scored_gte", value: 3 },
        points: 1,
        appliesTo: "both",
      },
    ]);
    const out = parseBonusConfig(raw);
    expect(out).toHaveLength(1);
  });

  it("returns null on null/undefined/garbage", () => {
    expect(parseBonusConfig(null)).toBeNull();
    expect(parseBonusConfig(undefined)).toBeNull();
    expect(parseBonusConfig("not-json")).toBeNull();
    expect(parseBonusConfig(42)).toBeNull();
  });

  it("filters out invalid rules silently", () => {
    const raw = [
      { id: "ok", label: "OK", condition: { type: "tds_scored_gte", value: 1 }, points: 1, appliesTo: "both" },
      { id: "missing-cond", label: "X", points: 1, appliesTo: "both" },
      { id: "bad-applies", label: "X", condition: { type: "tds_scored_gte", value: 1 }, points: 1, appliesTo: "other" },
      { /* no id */ label: "X", condition: { type: "tds_scored_gte", value: 1 }, points: 1, appliesTo: "both" },
      { id: "bad-cond-type", label: "X", condition: { type: "unknown" }, points: 1, appliesTo: "both" },
    ];
    const out = parseBonusConfig(raw);
    expect(out).toHaveLength(1);
    expect(out?.[0].id).toBe("ok");
  });
});

describe("Lot E — BONUS_PRESETS", () => {
  it("exposes the 4 documented presets", () => {
    expect(BONUS_PRESETS).toHaveLength(4);
    const ids = BONUS_PRESETS.map((p) => p.id);
    expect(ids).toContain("preset_3_tds");
    expect(ids).toContain("preset_3_cas");
    expect(ids).toContain("preset_clean_sheet");
    expect(ids).toContain("preset_shutout_win");
  });

  it("presets pass evaluateBonusRules without throwing", () => {
    const ctx: MatchBonusContext = {
      tdsHome: 3,
      tdsAway: 0,
      casualtiesInflictedHome: 3,
      casualtiesInflictedAway: 0,
      winner: "home",
    };
    const out = evaluateBonusRules(BONUS_PRESETS, ctx);
    expect(out.homeBonus).toBeGreaterThan(0);
  });
});
