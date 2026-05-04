/**
 * L2.C.1 — Tests du service `league-scoring.ts`.
 *
 * Couvre :
 *  - computeSeasonRecap : selection champion + awards (top scorer,
 *    best defense, basher, martyrs, cleanestSheet, mostWins),
 *    gestion des ties (toutes les equipes ex-aequo en tete sont
 *    listees), saison vide (aucun match joue), exclusion des
 *    `withdrawn` quand demandee.
 *  - persistSeasonAwards : creation snapshot, idempotence (re-appel
 *    n'ecrase pas), saison sans champion -> pas de row cree.
 *  - getPersistedSeasonAward : lecture, parsing JSON, fallback empty
 *    awards si JSON corrompu.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { StandingRow } from "./league";

vi.mock("./league", () => ({
  computeSeasonStandings: vi.fn(),
}));

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeasonAward: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { computeSeasonStandings } from "./league";
import {
  computeSeasonRecap,
  persistSeasonAwards,
  getPersistedSeasonAward,
} from "./league-scoring";
import { prisma } from "../prisma";

type MockFn = ReturnType<typeof vi.fn>;
const mocked = {
  standings: computeSeasonStandings as unknown as MockFn,
  awardFind: prisma.leagueSeasonAward.findUnique as MockFn,
  awardCreate: prisma.leagueSeasonAward.create as MockFn,
};

beforeEach(() => {
  vi.clearAllMocks();
});

function row(over: Partial<StandingRow>): StandingRow {
  return {
    participantId: "p",
    teamId: "t",
    teamName: "Team",
    roster: "skaven",
    ownerId: "u",
    coachName: "Coach",
    played: 1,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    touchdownsFor: 0,
    touchdownsAgainst: 0,
    touchdownDifference: 0,
    casualtiesFor: 0,
    casualtiesAgainst: 0,
    seasonElo: 1000,
    status: "active",
    ...over,
  };
}

describe("computeSeasonRecap", () => {
  it("returns empty awards + null champion when standings are empty", async () => {
    mocked.standings.mockResolvedValue([]);
    const recap = await computeSeasonRecap("season-1");
    expect(recap.championUserId).toBeNull();
    expect(recap.championTeamId).toBeNull();
    expect(recap.awards.topScorer).toHaveLength(0);
  });

  it("returns empty awards when no match has been played", async () => {
    mocked.standings.mockResolvedValue([
      row({ participantId: "a", teamId: "tA", played: 0 }),
    ]);
    const recap = await computeSeasonRecap("season-1");
    expect(recap.championUserId).toBeNull();
    expect(recap.awards.topScorer).toHaveLength(0);
  });

  it("picks the top of standings as champion (already sorted by computeSeasonStandings)", async () => {
    mocked.standings.mockResolvedValue([
      row({
        participantId: "p1",
        teamId: "t1",
        teamName: "First",
        ownerId: "u1",
        played: 3,
        wins: 3,
      }),
      row({
        participantId: "p2",
        teamId: "t2",
        teamName: "Second",
        ownerId: "u2",
        played: 3,
        wins: 1,
      }),
    ]);
    const recap = await computeSeasonRecap("season-1");
    expect(recap.championUserId).toBe("u1");
    expect(recap.championTeamId).toBe("t1");
    expect(recap.championLabel).toBe("Coach");
  });

  it("computes topScorer / basher / mostWins (ties listed)", async () => {
    mocked.standings.mockResolvedValue([
      row({
        teamId: "tA",
        teamName: "Alpha",
        ownerId: "u1",
        played: 3,
        wins: 3,
        touchdownsFor: 10,
        casualtiesFor: 4,
      }),
      row({
        teamId: "tB",
        teamName: "Beta",
        ownerId: "u2",
        played: 3,
        wins: 3,
        touchdownsFor: 10, // tie with Alpha
        casualtiesFor: 1,
      }),
      row({
        teamId: "tC",
        teamName: "Gamma",
        ownerId: "u3",
        played: 3,
        wins: 2,
        touchdownsFor: 6,
        casualtiesFor: 4, // tie with Alpha
      }),
    ]);

    const recap = await computeSeasonRecap("season-1");

    // topScorer : Alpha + Beta (10 TD chacun, ties).
    expect(recap.awards.topScorer).toHaveLength(2);
    expect(recap.awards.topScorer.map((e) => e.teamId).sort()).toEqual([
      "tA",
      "tB",
    ]);
    expect(recap.awards.topScorer[0].value).toBe(10);

    // basher : Alpha + Gamma (4 sorties chacun).
    expect(recap.awards.basher).toHaveLength(2);
    expect(recap.awards.basher.map((e) => e.teamId).sort()).toEqual([
      "tA",
      "tC",
    ]);

    // mostWins : Alpha + Beta (3 wins chacun).
    expect(recap.awards.mostWins).toHaveLength(2);
  });

  it("computes bestDefense and cleanestSheet using minimum (reverse=true)", async () => {
    mocked.standings.mockResolvedValue([
      row({
        teamId: "tA",
        teamName: "Alpha",
        ownerId: "u1",
        played: 3,
        touchdownsAgainst: 1,
        casualtiesAgainst: 0,
      }),
      row({
        teamId: "tB",
        teamName: "Beta",
        ownerId: "u2",
        played: 3,
        touchdownsAgainst: 5,
        casualtiesAgainst: 5,
      }),
    ]);

    const recap = await computeSeasonRecap("season-1");
    // bestDefense = min TD encaisses = Alpha (1).
    expect(recap.awards.bestDefense).toHaveLength(1);
    expect(recap.awards.bestDefense[0].teamId).toBe("tA");
    expect(recap.awards.bestDefense[0].value).toBe(1);
    // cleanestSheet = min cas encaisses = Alpha (0).
    expect(recap.awards.cleanestSheet).toHaveLength(1);
    expect(recap.awards.cleanestSheet[0].value).toBe(0);
  });

  it("does not award topScorer/basher when leader value is 0", async () => {
    mocked.standings.mockResolvedValue([
      row({
        teamId: "tA",
        played: 3,
        touchdownsFor: 0,
        casualtiesFor: 0,
      }),
    ]);
    const recap = await computeSeasonRecap("season-1");
    expect(recap.awards.topScorer).toHaveLength(0);
    expect(recap.awards.basher).toHaveLength(0);
  });

  it("excludes withdrawn participants when excludeWithdrawn=true", async () => {
    mocked.standings.mockResolvedValue([
      row({
        teamId: "tA",
        played: 3,
        wins: 3,
        touchdownsFor: 5,
        status: "withdrawn",
      }),
      row({
        teamId: "tB",
        played: 3,
        wins: 1,
        touchdownsFor: 4,
        status: "active",
      }),
    ]);
    const recap = await computeSeasonRecap("season-1", {
      excludeWithdrawn: true,
    });
    expect(recap.championTeamId).toBe("tB");
    expect(recap.awards.topScorer[0].teamId).toBe("tB");
  });
});

describe("persistSeasonAwards", () => {
  it("returns existing award when row exists (idempotent)", async () => {
    mocked.standings.mockResolvedValue([
      row({ teamId: "tA", played: 3, wins: 3, touchdownsFor: 5 }),
    ]);
    mocked.awardFind.mockResolvedValue({ id: "award-existing" });

    const out = await persistSeasonAwards("season-1");

    expect(out.created).toBe(false);
    expect(out.awardId).toBe("award-existing");
    expect(mocked.awardCreate).not.toHaveBeenCalled();
  });

  it("creates a new award row when none exists", async () => {
    mocked.standings.mockResolvedValue([
      row({
        teamId: "tA",
        teamName: "Alpha",
        ownerId: "u1",
        played: 3,
        wins: 3,
        touchdownsFor: 7,
      }),
    ]);
    mocked.awardFind.mockResolvedValue(null);
    mocked.awardCreate.mockResolvedValue({ id: "award-new" });

    const out = await persistSeasonAwards("season-1");

    expect(out.created).toBe(true);
    expect(out.awardId).toBe("award-new");
    const args = mocked.awardCreate.mock.calls[0][0];
    expect(args.data.seasonId).toBe("season-1");
    expect(args.data.championUserId).toBe("u1");
    expect(args.data.championTeamId).toBe("tA");
    const parsed = JSON.parse(args.data.awards);
    expect(parsed.topScorer[0].teamId).toBe("tA");
  });

  it("does not create a row when there is no champion (empty season)", async () => {
    mocked.standings.mockResolvedValue([]);
    mocked.awardFind.mockResolvedValue(null);

    const out = await persistSeasonAwards("season-1");

    expect(out.created).toBe(false);
    expect(out.awardId).toBeNull();
    expect(mocked.awardCreate).not.toHaveBeenCalled();
  });
});

describe("getPersistedSeasonAward", () => {
  it("returns null when no award row exists", async () => {
    mocked.awardFind.mockResolvedValue(null);
    const out = await getPersistedSeasonAward("season-1");
    expect(out).toBeNull();
  });

  it("parses the JSON awards correctly", async () => {
    mocked.awardFind.mockResolvedValue({
      id: "award-1",
      seasonId: "season-1",
      championUserId: "u1",
      championTeamId: "tA",
      awards: JSON.stringify({
        topScorer: [
          {
            teamId: "tA",
            teamName: "Alpha",
            roster: "skaven",
            ownerId: "u1",
            coachName: "Alice",
            value: 7,
          },
        ],
        bestDefense: [],
        basher: [],
        martyrs: [],
        cleanestSheet: [],
        mostWins: [],
      }),
      createdAt: new Date("2026-05-01"),
    });

    const out = await getPersistedSeasonAward("season-1");
    expect(out?.championUserId).toBe("u1");
    expect(out?.awards.topScorer).toHaveLength(1);
    expect(out?.awards.topScorer[0].teamName).toBe("Alpha");
  });

  it("falls back to empty awards when JSON is corrupted", async () => {
    mocked.awardFind.mockResolvedValue({
      id: "award-1",
      seasonId: "season-1",
      championUserId: "u1",
      championTeamId: "tA",
      awards: "{not-json",
      createdAt: new Date(),
    });
    const out = await getPersistedSeasonAward("season-1");
    expect(out?.awards.topScorer).toEqual([]);
    expect(out?.championUserId).toBe("u1");
  });

  it("falls back to empty array when topScorer field is missing", async () => {
    mocked.awardFind.mockResolvedValue({
      id: "award-1",
      seasonId: "season-1",
      championUserId: "u1",
      championTeamId: "tA",
      awards: JSON.stringify({}),
      createdAt: new Date(),
    });
    const out = await getPersistedSeasonAward("season-1");
    expect(out?.awards.topScorer).toEqual([]);
    expect(out?.awards.basher).toEqual([]);
  });
});
