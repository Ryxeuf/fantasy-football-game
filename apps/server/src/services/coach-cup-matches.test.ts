import { describe, expect, it, vi } from "vitest";
import { countCupMatchesPlayed, cupMatchesPlayedWhere } from "./coach-cup-matches";

describe("cupMatchesPlayedWhere", () => {
  it("rencontres de coupe JOUÉES d'une équipe du coach, hors celles qu'il a créées", () => {
    expect(cupMatchesPlayedWhere("u1")).toEqual({
      status: "completed",
      creatorId: { not: "u1" },
      AND: [
        { OR: [{ cupId: { not: null } }, { cupPairingId: { not: null } }] },
        { OR: [{ teamA: { ownerId: "u1" } }, { teamB: { ownerId: "u1" } }] },
      ],
    });
  });
});

describe("countCupMatchesPlayed", () => {
  it("compte avec ce filtre", async () => {
    const count = vi.fn(async () => 4);
    await expect(countCupMatchesPlayed({ localMatch: { count } }, "u1")).resolves.toBe(4);
    expect(count).toHaveBeenCalledWith({ where: cupMatchesPlayedWhere("u1") });
  });
});
