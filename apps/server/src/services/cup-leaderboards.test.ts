import { describe, it, expect } from "vitest";
import { clampCupTopN, cupTeamLeaderboards } from "./cup-leaderboards";
import type { CupTeamStats } from "../cupScoring";

function stats(teamId: string, over: Partial<CupTeamStats>): CupTeamStats {
  return {
    teamId,
    teamName: `Team ${teamId}`,
    roster: "orc",
    logoUrl: null,
    matchesPlayed: 2,
    wins: 0,
    draws: 0,
    losses: 0,
    forfeits: 0,
    byes: 0,
    touchdownsFor: 0,
    touchdownsAgainst: 0,
    touchdownDiff: 0,
    passes: 0,
    blockCasualties: 0,
    foulCasualties: 0,
    blockCasualtiesAgainst: 0,
    foulCasualtiesAgainst: 0,
    totalCasualtiesFor: 0,
    totalCasualtiesAgainst: 0,
    resultPoints: 0,
    actionPoints: 0,
    totalPoints: 0,
    ...over,
  };
}

describe("clampCupTopN", () => {
  it("borne entre 1 et 50, 10 par défaut", () => {
    expect(clampCupTopN(undefined)).toBe(10);
    expect(clampCupTopN("abc")).toBe(10);
    expect(clampCupTopN("0")).toBe(1);
    expect(clampCupTopN("500")).toBe(50);
    expect(clampCupTopN("20")).toBe(20);
    expect(clampCupTopN(7.9)).toBe(7);
  });
});

describe("cupTeamLeaderboards", () => {
  const STATS = [
    stats("a", { touchdownsFor: 5, touchdownsAgainst: 1, totalCasualtiesFor: 3, passes: 2 }),
    stats("b", { touchdownsFor: 5, touchdownsAgainst: 4, totalCasualtiesAgainst: 6 }),
    stats("c", { touchdownsFor: 1, touchdownsAgainst: 0, foulCasualties: 2 }),
    // N'a pas joué : jamais « meilleure défense » à 0 TD encaissé.
    stats("d", { matchesPlayed: 0 }),
  ];

  it("classe par valeur décroissante, ex æquo au même rang, sans les zéros", () => {
    const out = cupTeamLeaderboards(STATS, 10);
    expect(out.topScorers.map((r) => [r.teamId, r.rank, r.value])).toEqual([
      ["a", 1, 5],
      ["b", 1, 5],
      ["c", 3, 1],
    ]);
    expect(out.topBashers.map((r) => r.teamId)).toEqual(["a"]);
    expect(out.topMartyrs.map((r) => r.teamId)).toEqual(["b"]);
    expect(out.topAggressors.map((r) => r.teamId)).toEqual(["c"]);
  });

  it("classe la défense par TD encaissés croissants, équipes ayant joué seulement", () => {
    const out = cupTeamLeaderboards(STATS, 10);
    expect(out.bestDefenses.map((r) => [r.teamId, r.value])).toEqual([
      ["c", 0],
      ["a", 1],
      ["b", 4],
    ]);
  });

  it("borne chaque catégorie au top N", () => {
    expect(cupTeamLeaderboards(STATS, 2).topScorers).toHaveLength(2);
  });
});
