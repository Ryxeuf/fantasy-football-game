import { describe, it, expect } from "vitest";
import {
  aggregateTeamCareer,
  toPlayerCareerStats,
  type TeamMatchRecord,
  type TeamPlayerForStats,
} from "./career-stats";

const baseRecord = (overrides: Partial<TeamMatchRecord> = {}): TeamMatchRecord => ({
  matchId: "m1",
  teamSide: "A",
  scoreA: 0,
  scoreB: 0,
  casualtiesInflicted: 0,
  casualtiesSuffered: 0,
  completions: 0,
  interceptions: 0,
  createdAt: new Date("2026-01-01"),
  endedAt: new Date("2026-01-01"),
  opponentCoachName: null,
  opponentTeamName: null,
  opponentRoster: null,
  ...overrides,
});

describe("aggregateTeamCareer", () => {
  it("returns all zeroes for an empty list", () => {
    const result = aggregateTeamCareer([]);
    expect(result).toEqual({
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      touchdownsFor: 0,
      touchdownsAgainst: 0,
      casualtiesInflicted: 0,
      casualtiesSuffered: 0,
      completions: 0,
      interceptions: 0,
      winRate: 0,
    });
  });

  it("counts a win correctly when this team is side A", () => {
    const result = aggregateTeamCareer([
      baseRecord({ teamSide: "A", scoreA: 2, scoreB: 1 }),
    ]);
    expect(result.matchesPlayed).toBe(1);
    expect(result.wins).toBe(1);
    expect(result.draws).toBe(0);
    expect(result.losses).toBe(0);
    expect(result.touchdownsFor).toBe(2);
    expect(result.touchdownsAgainst).toBe(1);
    expect(result.winRate).toBe(1);
  });

  it("counts a win correctly when this team is side B", () => {
    const result = aggregateTeamCareer([
      baseRecord({ teamSide: "B", scoreA: 1, scoreB: 3 }),
    ]);
    expect(result.wins).toBe(1);
    expect(result.touchdownsFor).toBe(3);
    expect(result.touchdownsAgainst).toBe(1);
  });

  it("counts a draw", () => {
    const result = aggregateTeamCareer([
      baseRecord({ teamSide: "A", scoreA: 1, scoreB: 1 }),
    ]);
    expect(result.draws).toBe(1);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(0);
    expect(result.winRate).toBe(0.5);
  });

  it("counts a loss", () => {
    const result = aggregateTeamCareer([
      baseRecord({ teamSide: "A", scoreA: 0, scoreB: 2 }),
    ]);
    expect(result.losses).toBe(1);
    expect(result.winRate).toBe(0);
  });

  it("sums casualties, completions and interceptions across records", () => {
    const result = aggregateTeamCareer([
      baseRecord({
        teamSide: "A",
        scoreA: 1,
        scoreB: 0,
        casualtiesInflicted: 2,
        casualtiesSuffered: 1,
        completions: 3,
        interceptions: 1,
      }),
      baseRecord({
        matchId: "m2",
        teamSide: "B",
        scoreA: 2,
        scoreB: 2,
        casualtiesInflicted: 1,
        casualtiesSuffered: 3,
        completions: 2,
        interceptions: 0,
      }),
    ]);
    expect(result.matchesPlayed).toBe(2);
    expect(result.casualtiesInflicted).toBe(3);
    expect(result.casualtiesSuffered).toBe(4);
    expect(result.completions).toBe(5);
    expect(result.interceptions).toBe(1);
    expect(result.touchdownsFor).toBe(3); // 1 (A) + 2 (B side => scoreB)
    expect(result.touchdownsAgainst).toBe(2); // 0 (opp) + 2 (opp)
  });

  it("computes winRate counting draws as half-wins", () => {
    const result = aggregateTeamCareer([
      baseRecord({ teamSide: "A", scoreA: 2, scoreB: 0 }), // win
      baseRecord({ matchId: "m2", teamSide: "A", scoreA: 1, scoreB: 1 }), // draw
      baseRecord({ matchId: "m3", teamSide: "A", scoreA: 0, scoreB: 3 }), // loss
      baseRecord({ matchId: "m4", teamSide: "A", scoreA: 1, scoreB: 0 }), // win
    ]);
    expect(result.wins).toBe(2);
    expect(result.draws).toBe(1);
    expect(result.losses).toBe(1);
    // (2 + 0.5) / 4 = 0.625
    expect(result.winRate).toBe(0.625);
  });

  it("never returns a negative winRate", () => {
    const result = aggregateTeamCareer([
      baseRecord({ teamSide: "A", scoreA: 0, scoreB: 10 }),
    ]);
    expect(result.winRate).toBe(0);
  });
});

describe("toPlayerCareerStats", () => {
  const basePlayer: TeamPlayerForStats = {
    id: "p1",
    name: "Skritter",
    number: 1,
    position: "Lineman",
    spp: 12,
    matchesPlayed: 4,
    totalTouchdowns: 2,
    totalCasualties: 1,
    totalCompletions: 3,
    totalInterceptions: 1,
    totalMvpAwards: 0,
    nigglingInjuries: 0,
    advancements: "[]",
    dead: false,
  };

  it("maps a TeamPlayer record to career stats", () => {
    const result = toPlayerCareerStats(basePlayer);
    expect(result).toMatchObject({
      id: "p1",
      name: "Skritter",
      number: 1,
      position: "Lineman",
      spp: 12,
      matchesPlayed: 4,
      totalTouchdowns: 2,
      totalCasualties: 1,
      totalCompletions: 3,
      totalInterceptions: 1,
      totalMvpAwards: 0,
      nigglingInjuries: 0,
      dead: false,
    });
  });

  it("parses advancements JSON to a count", () => {
    const result = toPlayerCareerStats({
      ...basePlayer,
      advancements: JSON.stringify([{ type: "normal" }, { type: "random" }]),
    });
    expect(result.advancementsCount).toBe(2);
  });

  it("handles empty or invalid advancements string safely", () => {
    expect(toPlayerCareerStats({ ...basePlayer, advancements: "" }).advancementsCount).toBe(0);
    expect(toPlayerCareerStats({ ...basePlayer, advancements: "not-json" }).advancementsCount).toBe(0);
    expect(toPlayerCareerStats({ ...basePlayer, advancements: "{}" }).advancementsCount).toBe(0);
  });

  it("flags dead players", () => {
    const result = toPlayerCareerStats({ ...basePlayer, dead: true });
    expect(result.dead).toBe(true);
  });
});
