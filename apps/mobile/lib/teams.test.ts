import { describe, it, expect } from "vitest";
import {
  validateTeamName,
  validateTeamValue,
  formatTeamValue,
  formatGoldShort,
  countPlayersByPosition,
  summarizeTeamRoster,
  getTeamValueOptions,
  TEAM_NAME_MIN,
  TEAM_NAME_MAX,
  TEAM_VALUE_MIN,
  TEAM_VALUE_MAX,
  type TeamSummary,
  type TeamPlayer,
} from "./teams";

describe("validateTeamName", () => {
  it("accepts a non-empty short name", () => {
    expect(validateTeamName("Reikland Reavers")).toEqual({ valid: true });
  });

  it("trims surrounding whitespace before validating", () => {
    expect(validateTeamName("  My Team  ")).toEqual({ valid: true });
  });

  it("rejects an empty string", () => {
    const result = validateTeamName("");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/requis|vide|nom/i);
    }
  });

  it("rejects whitespace-only", () => {
    const result = validateTeamName("    ");
    expect(result.valid).toBe(false);
  });

  it("rejects names longer than the max", () => {
    const result = validateTeamName("a".repeat(TEAM_NAME_MAX + 1));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/100/);
    }
  });

  it("accepts a name exactly at the maximum length", () => {
    expect(validateTeamName("a".repeat(TEAM_NAME_MAX))).toEqual({ valid: true });
  });

  it("requires at least the minimum length after trim", () => {
    expect(TEAM_NAME_MIN).toBeGreaterThanOrEqual(1);
  });
});

describe("validateTeamValue", () => {
  it("accepts the canonical 1000K po budget", () => {
    expect(validateTeamValue(1000)).toEqual({ valid: true });
  });

  it("accepts the lower bound", () => {
    expect(validateTeamValue(TEAM_VALUE_MIN)).toEqual({ valid: true });
  });

  it("accepts the upper bound", () => {
    expect(validateTeamValue(TEAM_VALUE_MAX)).toEqual({ valid: true });
  });

  it("rejects values below the lower bound", () => {
    const result = validateTeamValue(TEAM_VALUE_MIN - 1);
    expect(result.valid).toBe(false);
  });

  it("rejects values above the upper bound", () => {
    const result = validateTeamValue(TEAM_VALUE_MAX + 1);
    expect(result.valid).toBe(false);
  });

  it("rejects non-integer or NaN", () => {
    expect(validateTeamValue(Number.NaN).valid).toBe(false);
    expect(validateTeamValue(1500.5).valid).toBe(false);
  });
});

describe("formatTeamValue", () => {
  it("formats whole-thousand values without decimals", () => {
    // currentValue is in 'pieces d'or' (po), 1000 po = 1K po
    expect(formatTeamValue(1000)).toBe("1K po");
    expect(formatTeamValue(1_500_000)).toBe("1500K po");
  });

  it("formats zero", () => {
    expect(formatTeamValue(0)).toBe("0K po");
  });

  it("rounds non-whole-thousand values down to nearest K", () => {
    expect(formatTeamValue(1499)).toBe("1K po");
    expect(formatTeamValue(1999)).toBe("1K po");
  });
});

describe("formatGoldShort", () => {
  it("returns short form like 1.5K for 1500 po", () => {
    expect(formatGoldShort(1500)).toBe("1.5K");
    expect(formatGoldShort(1000)).toBe("1K");
    expect(formatGoldShort(0)).toBe("0K");
  });
});

describe("countPlayersByPosition", () => {
  const players: TeamPlayer[] = [
    { id: "1", name: "A", position: "Lineman", number: 1, ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: "" },
    { id: "2", name: "B", position: "Lineman", number: 2, ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: "" },
    { id: "3", name: "C", position: "Blitzer", number: 3, ma: 7, st: 3, ag: 3, pa: 4, av: 9, skills: "block" },
  ];

  it("groups players by position with counts", () => {
    expect(countPlayersByPosition(players)).toEqual([
      { position: "Blitzer", count: 1 },
      { position: "Lineman", count: 2 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(countPlayersByPosition([])).toEqual([]);
  });
});

describe("summarizeTeamRoster", () => {
  const team: TeamSummary = {
    id: "t1",
    name: "Test",
    roster: "human",
    ruleset: "season_2",
    createdAt: new Date().toISOString(),
    currentValue: 1_000_000,
  };

  it("provides a one-line summary string", () => {
    const out = summarizeTeamRoster(team);
    expect(out).toContain("human");
    expect(out).toMatch(/1000K/);
  });

  it("falls back gracefully when currentValue is missing", () => {
    const out = summarizeTeamRoster({ ...team, currentValue: undefined });
    expect(out).toContain("human");
  });
});

describe("getTeamValueOptions", () => {
  it("returns common BB3 budget choices", () => {
    const options = getTeamValueOptions();
    expect(options).toContain(1000);
    expect(options).toContain(1100);
    expect(options[0]).toBe(TEAM_VALUE_MIN <= 1000 ? 1000 : TEAM_VALUE_MIN);
    expect(options.every((v) => v >= TEAM_VALUE_MIN && v <= TEAM_VALUE_MAX)).toBe(true);
    expect([...options].sort((a, b) => a - b)).toEqual(options);
  });
});
