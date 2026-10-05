import { describe, expect, it } from "vitest";

import { currentNflSeasonId, nflSeasonOptions } from "./season";

describe("currentNflSeasonId", () => {
  it("juillet-decembre : saison de l'annee", () => {
    expect(currentNflSeasonId(new Date("2026-10-05T12:00:00Z"))).toBe("2026");
    expect(currentNflSeasonId(new Date("2026-07-01T00:00:00Z"))).toBe("2026");
  });

  it("janvier-juin : saison precedente (play-offs, Super Bowl)", () => {
    expect(currentNflSeasonId(new Date("2027-02-14T23:00:00Z"))).toBe("2026");
    expect(currentNflSeasonId(new Date("2026-06-30T23:59:00Z"))).toBe("2025");
  });
});

describe("nflSeasonOptions", () => {
  it("de la saison courante jusqu'a 2023, la plus recente d'abord", () => {
    expect(nflSeasonOptions(new Date("2026-10-05T12:00:00Z"))).toEqual([
      "2026",
      "2025",
      "2024",
      "2023",
    ]);
  });
});
