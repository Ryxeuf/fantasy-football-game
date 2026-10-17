import { describe, it, expect } from "vitest";
import { cupChampion, cupOracles } from "./cup-champion";

const team = (id: string) => ({ id, name: `Team ${id}`, roster: "orc", coachName: `Coach ${id}` });

function finalRound(overrides: Record<string, unknown> = {}) {
  return {
    kind: "playoff",
    bracketSlot: "final",
    pairings: [
      {
        status: "played",
        homeTeam: team("a"),
        awayTeam: team("b"),
        // Côté A du match local = b.
        localMatch: { status: "completed", teamAId: "b", scoreTeamA: 2, scoreTeamB: 1 },
        ...overrides,
      },
    ],
  };
}

const STANDINGS = [
  { teamId: "x", teamName: "Team x", roster: "skaven", matchesPlayed: 3 },
  { teamId: "y", teamName: "Team y", roster: "orc", matchesPlayed: 3 },
];

describe("cupChampion", () => {
  it("vainqueur de la finale, score orienté vainqueur d'abord", () => {
    const champion = cupChampion({
      status: "en_cours",
      rounds: [{ kind: "regular", bracketSlot: null, pairings: [] }, finalRound()],
      standings: STANDINGS,
    });
    expect(champion).toEqual({ team: team("b"), source: "final", finalScore: "2 – 1" });
  });

  it("finale non jouée ou nulle : pas de champion, même coupe close", () => {
    expect(
      cupChampion({
        status: "terminee",
        rounds: [finalRound({ status: "scheduled", localMatch: null })],
        standings: STANDINGS,
      }),
    ).toBeNull();
    expect(
      cupChampion({
        status: "terminee",
        rounds: [
          finalRound({
            localMatch: { status: "completed", teamAId: "a", scoreTeamA: 1, scoreTeamB: 1 },
          }),
        ],
        standings: STANDINGS,
      }),
    ).toBeNull();
  });

  it("bracket entamé sans finale : pas encore de champion", () => {
    expect(
      cupChampion({
        status: "terminee",
        rounds: [{ kind: "playoff", bracketSlot: "sf1", pairings: [] }],
        standings: STANDINGS,
      }),
    ).toBeNull();
  });

  it("sans play-offs : le premier du classement d'une coupe close", () => {
    expect(
      cupChampion({ status: "en_cours", rounds: [], standings: STANDINGS }),
    ).toBeNull();
    expect(
      cupChampion({
        status: "terminee",
        rounds: [],
        standings: STANDINGS,
        coachNameByTeamId: { x: "Bob" },
      }),
    ).toEqual({
      team: { id: "x", name: "Team x", roster: "skaven", logoUrl: null, coachName: "Bob" },
      source: "standings",
      finalScore: null,
    });
  });

  it("coupe close sans match joué : personne", () => {
    expect(
      cupChampion({
        status: "archivee",
        rounds: [],
        standings: [{ ...STANDINGS[0], matchesPlayed: 0 }],
      }),
    ).toBeNull();
  });
});

describe("cupOracles", () => {
  it("le ou les premiers, avec des points", () => {
    const entry = (userId: string, rank: number, points: number) => ({
      userId,
      displayName: userId,
      rank,
      points,
    });
    expect(
      cupOracles([entry("a", 1, 8), entry("b", 1, 8), entry("c", 3, 5)]).map((e) => e.userId),
    ).toEqual(["a", "b"]);
    expect(cupOracles([entry("a", 1, 0)])).toEqual([]);
    expect(cupOracles(null)).toEqual([]);
  });
});
