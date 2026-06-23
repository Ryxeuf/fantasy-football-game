import { describe, it, expect } from "vitest";
import {
  parsePlayerAdvancements,
  formatSpp,
  formatStatValue,
  getEffectiveStat,
  getNextAdvancementOptions,
  canAffordAdvancement,
  computeInjurySummary,
  computePlayerStatus,
  type TeamPlayerWithProgression,
} from "./player-details";

function buildPlayer(
  overrides: Partial<TeamPlayerWithProgression> = {},
): TeamPlayerWithProgression {
  return {
    id: "p1",
    name: "Grot",
    position: "Lineman",
    number: 1,
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
    skills: "",
    spp: 0,
    totalTouchdowns: 0,
    totalCasualties: 0,
    totalCompletions: 0,
    totalInterceptions: 0,
    totalMvpAwards: 0,
    matchesPlayed: 0,
    nigglingInjuries: 0,
    maReduction: 0,
    stReduction: 0,
    agReduction: 0,
    paReduction: 0,
    avReduction: 0,
    missNextMatch: false,
    advancements: "[]",
    dead: false,
    ...overrides,
  };
}

describe("parsePlayerAdvancements", () => {
  it("returns an empty array for an empty or default string", () => {
    expect(parsePlayerAdvancements("")).toEqual([]);
    expect(parsePlayerAdvancements("[]")).toEqual([]);
  });

  it("parses a valid JSON array of advancements", () => {
    const raw = JSON.stringify([
      { skillSlug: "block", type: "primary", isRandom: false, at: 1 },
      // Une amelioration de caracteristique n'a pas de skillSlug : elle
      // doit quand meme survivre au parsing.
      { type: "characteristic", stat: "ma", isRandom: false, at: 2 },
    ]);
    const parsed = parsePlayerAdvancements(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].skillSlug).toBe("block");
    expect(parsed[1].type).toBe("characteristic");
    expect(parsed[1].stat).toBe("ma");
  });

  it("returns an empty array on invalid JSON", () => {
    expect(parsePlayerAdvancements("not json")).toEqual([]);
    expect(parsePlayerAdvancements("{}")).toEqual([]);
  });

  it("ignores non-array payloads", () => {
    expect(parsePlayerAdvancements(JSON.stringify({ foo: "bar" }))).toEqual([]);
  });
});

describe("formatSpp", () => {
  it("formats SPP as a simple string", () => {
    expect(formatSpp(0)).toBe("0 SPP");
    expect(formatSpp(12)).toBe("12 SPP");
  });

  it("handles undefined or null as zero", () => {
    expect(formatSpp(undefined)).toBe("0 SPP");
    expect(formatSpp(null)).toBe("0 SPP");
  });
});

describe("formatStatValue", () => {
  it("formats PA as /+ (target value) for Blood Bowl stats", () => {
    expect(formatStatValue("pa", 4)).toBe("4+");
    expect(formatStatValue("ag", 3)).toBe("3+");
  });

  it("formats MA/ST/AV as plain numbers", () => {
    expect(formatStatValue("ma", 6)).toBe("6");
    expect(formatStatValue("st", 3)).toBe("3");
    expect(formatStatValue("av", 9)).toBe("9+");
  });

  it("renders missing PA as '-'", () => {
    expect(formatStatValue("pa", 0)).toBe("-");
  });
});

describe("getEffectiveStat", () => {
  it("subtracts reductions from the base value", () => {
    const player = buildPlayer({ ma: 7, maReduction: 2 });
    expect(getEffectiveStat(player, "ma")).toBe(5);
  });

  it("floors at 1 when the reduction exceeds the base", () => {
    const player = buildPlayer({ st: 3, stReduction: 5 });
    expect(getEffectiveStat(player, "st")).toBe(1);
  });

  it("returns the base value when no reduction is present", () => {
    const player = buildPlayer({ av: 9, avReduction: 0 });
    expect(getEffectiveStat(player, "av")).toBe(9);
  });
});

describe("getNextAdvancementOptions", () => {
  it("returns the 4 advancement types with their SPP costs for a rookie", () => {
    const options = getNextAdvancementOptions(0);
    expect(options).toHaveLength(4);
    const primary = options.find((o) => o.type === "primary");
    const secondary = options.find((o) => o.type === "secondary");
    const randomPrimary = options.find((o) => o.type === "random-primary");
    const characteristic = options.find((o) => o.type === "characteristic");
    expect(primary?.sppCost).toBe(6);
    expect(secondary?.sppCost).toBe(10);
    expect(randomPrimary?.sppCost).toBe(3);
    expect(characteristic?.sppCost).toBe(14);
  });

  it("increases the cost for later advancements", () => {
    const options = getNextAdvancementOptions(2);
    const primary = options.find((o) => o.type === "primary");
    expect(primary?.sppCost).toBe(12);
  });

  it("caps at the 6th advancement cost", () => {
    const options = getNextAdvancementOptions(10);
    const primary = options.find((o) => o.type === "primary");
    expect(primary?.sppCost).toBe(30);
  });

  it("does not return locale-bound labels (i18n moves to the UI)", () => {
    const options = getNextAdvancementOptions(0);
    for (const opt of options) {
      expect(opt).not.toHaveProperty("label");
    }
  });
});

describe("canAffordAdvancement", () => {
  it("returns true when SPP >= cost", () => {
    expect(canAffordAdvancement(6, 6)).toBe(true);
    expect(canAffordAdvancement(20, 6)).toBe(true);
  });

  it("returns false when SPP < cost", () => {
    expect(canAffordAdvancement(5, 6)).toBe(false);
    expect(canAffordAdvancement(0, 3)).toBe(false);
  });
});

describe("computeInjurySummary", () => {
  it("returns an empty list when the player is healthy", () => {
    const player = buildPlayer();
    expect(computeInjurySummary(player)).toEqual([]);
  });

  it("reports niggling injuries as a structured entry", () => {
    const player = buildPlayer({ nigglingInjuries: 2 });
    expect(computeInjurySummary(player)).toEqual([
      { kind: "niggling", count: 2 },
    ]);
  });

  it("reports stat reductions as structured entries", () => {
    const player = buildPlayer({
      maReduction: 1,
      avReduction: 2,
    });
    const summary = computeInjurySummary(player);
    expect(summary).toContainEqual({
      kind: "stat-reduction",
      stat: "ma",
      value: 1,
    });
    expect(summary).toContainEqual({
      kind: "stat-reduction",
      stat: "av",
      value: 2,
    });
  });

  it("reports miss-next-match as its own entry", () => {
    const player = buildPlayer({ missNextMatch: true });
    expect(computeInjurySummary(player)).toContainEqual({
      kind: "miss-next-match",
    });
  });

  it("preserves locale-agnostic shape (no FR strings leaked)", () => {
    const player = buildPlayer({
      nigglingInjuries: 1,
      stReduction: 1,
      missNextMatch: true,
    });
    const summary = computeInjurySummary(player);
    for (const entry of summary) {
      expect(typeof entry).toBe("object");
      expect(entry).toHaveProperty("kind");
    }
  });
});

describe("computePlayerStatus", () => {
  it("returns 'dead' for a dead player", () => {
    expect(computePlayerStatus(buildPlayer({ dead: true }))).toBe("dead");
  });

  it("returns 'miss-next-match' when flagged", () => {
    expect(computePlayerStatus(buildPlayer({ missNextMatch: true }))).toBe(
      "miss-next-match",
    );
  });

  it("returns 'injured' when there are persistent injuries", () => {
    expect(computePlayerStatus(buildPlayer({ nigglingInjuries: 1 }))).toBe(
      "injured",
    );
  });

  it("returns 'fit' for a healthy player", () => {
    expect(computePlayerStatus(buildPlayer())).toBe("fit");
  });

  it("prioritises death over other statuses", () => {
    const player = buildPlayer({
      dead: true,
      nigglingInjuries: 3,
      missNextMatch: true,
    });
    expect(computePlayerStatus(player)).toBe("dead");
  });
});
