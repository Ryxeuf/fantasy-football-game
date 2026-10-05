import { describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({ prisma: {} }));
vi.mock("../services/nfl-ingest", () => ({}));
vi.mock("../services/nfl-ingest-rosters", () => ({}));
vi.mock("../services/nfl-fantasy-scoring", () => ({}));

import { parseArgs, parseWeekRange } from "./bootstrap-nfl-prod";

describe("parseWeekRange", () => {
  it("accepte A-B dans 1..22", () => {
    expect(parseWeekRange("1-4")).toEqual({ from: 1, to: 4 });
    expect(parseWeekRange("22-22")).toEqual({ from: 22, to: 22 });
  });

  it("refuse les bornes inversees ou hors saison", () => {
    expect(parseWeekRange("4-1")).toBeNull();
    expect(parseWeekRange("0-3")).toBeNull();
    expect(parseWeekRange("1-23")).toBeNull();
    expect(parseWeekRange("W1-W4")).toBeNull();
  });
});

describe("parseArgs", () => {
  it("defaults : saisons historiques, ingest incremental, pas de re-settle", () => {
    expect(parseArgs([])).toEqual({
      seasons: ["2023", "2024", "2025"],
      skipStats: false,
      skipRosters: false,
      skipScores: false,
      refreshStats: false,
      resettleWeeks: null,
    });
  });

  it("rattrapage 2026 : refresh + re-settle W1-W4", () => {
    const a = parseArgs(["--season", "2026", "--refresh-stats", "--resettle-weeks", "1-4"]);
    expect(a.seasons).toEqual(["2026"]);
    expect(a.refreshStats).toBe(true);
    expect(a.resettleWeeks).toEqual({ from: 1, to: 4 });
  });

  it("leve sur une plage invalide ou un argument inconnu (une faute de frappe ne doit pas passer en silence)", () => {
    expect(() => parseArgs(["--resettle-weeks", "4-1"])).toThrow(/resettle-weeks invalide/);
    expect(() => parseArgs(["--refresh-stat"])).toThrow(/Argument inconnu/);
  });
});
