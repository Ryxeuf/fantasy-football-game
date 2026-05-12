/**
 * Tests unitaires du service pro-mvp-vote.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: { findUnique: vi.fn() },
    proTeamRoster: { findMany: vi.fn() },
    proPlayerOfMatchVote: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      groupBy: vi.fn(),
    },
    replay: { findUnique: vi.fn() },
  },
}));

vi.mock("@bb/sim-engine", () => ({
  decompressEvents: vi.fn(),
}));

vi.mock("./pro-roster-spp", () => ({
  attributeSpp: vi.fn(),
}));

import { prisma } from "../prisma";
import { decompressEvents } from "@bb/sim-engine";
import { attributeSpp } from "./pro-roster-spp";
import {
  MvpError,
  getMvpCandidates,
  submitVote,
  getVoteTally,
  getWeeklyMvpLeaderboard,
  VOTE_WINDOW_MS,
} from "./pro-mvp-vote";

const mockedPrisma = prisma as unknown as {
  proLeagueMatch: { findUnique: ReturnType<typeof vi.fn> };
  proTeamRoster: { findMany: ReturnType<typeof vi.fn> };
  proPlayerOfMatchVote: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
  replay: { findUnique: ReturnType<typeof vi.fn> };
};
const mockedDecompress = vi.mocked(decompressEvents);
const mockedAttribute = vi.mocked(attributeSpp);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getMvpCandidates", () => {
  it("throws si match introuvable", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce(null);
    await expect(getMvpCandidates("ghost")).rejects.toMatchObject({
      code: "MATCH_NOT_FOUND",
    });
  });

  it("retourne [] si match pas completed", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "in_progress",
      completedAt: null,
      homeTeamId: "tA",
      awayTeamId: "tB",
      seed: 1,
    });
    expect(await getMvpCandidates("m1")).toEqual([]);
  });

  it("retourne [] si pas de replay", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "completed",
      completedAt: new Date(),
      homeTeamId: "tA",
      awayTeamId: "tB",
      seed: 1,
    });
    mockedPrisma.replay.findUnique.mockResolvedValueOnce(null);
    expect(await getMvpCandidates("m1")).toEqual([]);
  });

  it("retourne [] si decompression echoue", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "completed",
      completedAt: new Date(),
      homeTeamId: "tA",
      awayTeamId: "tB",
      seed: 1,
    });
    mockedPrisma.replay.findUnique.mockResolvedValueOnce({
      payload: Buffer.from("x"),
    });
    mockedDecompress.mockRejectedValueOnce(new Error("bad"));
    expect(await getMvpCandidates("m1")).toEqual([]);
  });

  it("retourne top 5 par totalSpp desc avec details roster", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "completed",
      completedAt: new Date(),
      homeTeamId: "tA",
      awayTeamId: "tB",
      seed: 42,
    });
    mockedPrisma.replay.findUnique.mockResolvedValueOnce({
      payload: Buffer.from("x"),
    });
    mockedDecompress.mockResolvedValueOnce([]);
    mockedPrisma.proTeamRoster.findMany
      .mockResolvedValueOnce([{ id: "p1" }, { id: "p2" }])
      .mockResolvedValueOnce([{ id: "p3" }])
      // Hydrate finale
      .mockResolvedValueOnce([
        {
          id: "p1",
          name: "Grott",
          position: "Lineman",
          team: { slug: "tA", name: "Athletics" },
        },
        {
          id: "p3",
          name: "Sven",
          position: "Blitzer",
          team: { slug: "tB", name: "Beasts" },
        },
      ]);
    mockedAttribute.mockReturnValueOnce({
      rewards: [
        { rosterId: "p1", totalSpp: 9, tdCount: 1, casCount: 2, compCount: 0, mvpCount: 1 },
        { rosterId: "p3", totalSpp: 4, tdCount: 1, casCount: 0, compCount: 1, mvpCount: 0 },
        { rosterId: "p2", totalSpp: 0, tdCount: 0, casCount: 0, compCount: 0, mvpCount: 0 },
      ],
    } as any);

    const out = await getMvpCandidates("m1");

    expect(out).toHaveLength(2);
    expect(out[0].rosterId).toBe("p1");
    expect(out[0].sppGained).toBe(9);
    expect(out[1].rosterId).toBe("p3");
  });

  it("cap a 5 candidats", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "completed",
      completedAt: new Date(),
      homeTeamId: "tA",
      awayTeamId: "tB",
      seed: 1,
    });
    mockedPrisma.replay.findUnique.mockResolvedValueOnce({
      payload: Buffer.from("x"),
    });
    mockedDecompress.mockResolvedValueOnce([]);
    mockedPrisma.proTeamRoster.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(
        Array.from({ length: 7 }, (_, i) => ({
          id: `p${i}`,
          name: `Player ${i}`,
          position: "Lineman",
          team: { slug: "x", name: "X" },
        })),
      );
    mockedAttribute.mockReturnValueOnce({
      rewards: Array.from({ length: 7 }, (_, i) => ({
        rosterId: `p${i}`,
        totalSpp: 10 - i,
        tdCount: 0,
        casCount: 0,
        compCount: 0,
        mvpCount: 0,
      })),
    } as any);

    const out = await getMvpCandidates("m1");
    expect(out).toHaveLength(5);
    expect(out[0].rosterId).toBe("p0"); // top SPP
  });
});

describe("submitVote", () => {
  const NOW = new Date("2026-05-19T12:00:00Z");
  const RECENT = new Date(NOW.getTime() - 60_000); // 1 minute apres
  const TOO_OLD = new Date(NOW.getTime() - VOTE_WINDOW_MS - 60_000);

  it("404 si match introuvable", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce(null);
    await expect(
      submitVote({ userId: "u1", matchId: "x", votedRosterId: "p1" }),
    ).rejects.toMatchObject({ code: "MATCH_NOT_FOUND" });
  });

  it("MATCH_NOT_COMPLETED si pas completed", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "in_progress",
      completedAt: null,
    });
    await expect(
      submitVote({ userId: "u1", matchId: "m1", votedRosterId: "p1" }),
    ).rejects.toMatchObject({ code: "MATCH_NOT_COMPLETED" });
  });

  it("VOTE_WINDOW_CLOSED si > 24h", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "completed",
      completedAt: TOO_OLD,
    });
    await expect(
      submitVote({ userId: "u1", matchId: "m1", votedRosterId: "p1" }),
    ).rejects.toMatchObject({ code: "VOTE_WINDOW_CLOSED" });
    vi.useRealTimers();
  });

  it("INVALID_CANDIDATE si rosterId pas dans candidates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    // 1er findUnique : submitVote.match
    mockedPrisma.proLeagueMatch.findUnique
      .mockResolvedValueOnce({
        id: "m1",
        status: "completed",
        completedAt: RECENT,
      })
      // 2eme findUnique : getMvpCandidates.match
      .mockResolvedValueOnce({
        id: "m1",
        status: "completed",
        completedAt: RECENT,
        homeTeamId: "tA",
        awayTeamId: "tB",
        seed: 1,
      });
    mockedPrisma.replay.findUnique.mockResolvedValueOnce({
      payload: Buffer.from("x"),
    });
    mockedDecompress.mockResolvedValueOnce([]);
    mockedPrisma.proTeamRoster.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "p1",
          name: "X",
          position: "Lineman",
          team: { slug: "x", name: "X" },
        },
      ]);
    mockedAttribute.mockReturnValueOnce({
      rewards: [
        { rosterId: "p1", totalSpp: 5, tdCount: 1, casCount: 0, compCount: 0, mvpCount: 0 },
      ],
    } as any);

    await expect(
      submitVote({ userId: "u1", matchId: "m1", votedRosterId: "wrong" }),
    ).rejects.toMatchObject({ code: "INVALID_CANDIDATE" });
    vi.useRealTimers();
  });

  it("NO_CANDIDATES si pas de candidats du tout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockedPrisma.proLeagueMatch.findUnique
      .mockResolvedValueOnce({
        id: "m1",
        status: "completed",
        completedAt: RECENT,
      })
      .mockResolvedValueOnce({
        id: "m1",
        status: "completed",
        completedAt: RECENT,
        homeTeamId: "tA",
        awayTeamId: "tB",
        seed: 1,
      });
    mockedPrisma.replay.findUnique.mockResolvedValueOnce(null);

    await expect(
      submitVote({ userId: "u1", matchId: "m1", votedRosterId: "p1" }),
    ).rejects.toMatchObject({ code: "NO_CANDIDATES" });
    vi.useRealTimers();
  });

  it("upsert + isUpdate=false si premier vote", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockedPrisma.proLeagueMatch.findUnique
      .mockResolvedValueOnce({
        id: "m1",
        status: "completed",
        completedAt: RECENT,
      })
      .mockResolvedValueOnce({
        id: "m1",
        status: "completed",
        completedAt: RECENT,
        homeTeamId: "tA",
        awayTeamId: "tB",
        seed: 1,
      });
    mockedPrisma.replay.findUnique.mockResolvedValueOnce({
      payload: Buffer.from("x"),
    });
    mockedDecompress.mockResolvedValueOnce([]);
    mockedPrisma.proTeamRoster.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "p1", name: "X", position: "Lineman", team: { slug: "x", name: "X" } },
      ]);
    mockedAttribute.mockReturnValueOnce({
      rewards: [{ rosterId: "p1", totalSpp: 5, tdCount: 0, casCount: 0, compCount: 0, mvpCount: 0 }],
    } as any);
    mockedPrisma.proPlayerOfMatchVote.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.proPlayerOfMatchVote.upsert.mockResolvedValueOnce({
      id: "v1",
      votedRosterId: "p1",
    });

    const out = await submitVote({
      userId: "u1",
      matchId: "m1",
      votedRosterId: "p1",
    });
    expect(out).toEqual({
      voteId: "v1",
      matchId: "m1",
      votedRosterId: "p1",
      isUpdate: false,
    });
    vi.useRealTimers();
  });
});

describe("getVoteTally", () => {
  it("404 si match introuvable", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce(null);
    await expect(getVoteTally("x")).rejects.toMatchObject({
      code: "MATCH_NOT_FOUND",
    });
  });

  it("renvoie tally trie desc + winner", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      completedAt: new Date("2026-05-19T10:00:00Z"),
    });
    mockedPrisma.proPlayerOfMatchVote.groupBy.mockResolvedValueOnce([
      { votedRosterId: "p1", _count: { _all: 5 } },
      { votedRosterId: "p2", _count: { _all: 3 } },
      { votedRosterId: "p3", _count: { _all: 8 } },
    ]);

    const out = await getVoteTally("m1");
    expect(out.entries[0].rosterId).toBe("p3"); // winner
    expect(out.entries[0].count).toBe(8);
    expect(out.totalVotes).toBe(16);
    expect(out.winnerRosterId).toBe("p3");
    expect(out.windowClosesAt).toBe("2026-05-20T10:00:00.000Z");
  });

  it("winnerRosterId=null si 0 votes", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      completedAt: new Date(),
    });
    mockedPrisma.proPlayerOfMatchVote.groupBy.mockResolvedValueOnce([]);

    const out = await getVoteTally("m1");
    expect(out.winnerRosterId).toBeNull();
    expect(out.totalVotes).toBe(0);
  });

  it("tie-break par rosterId asc sur egalite count", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      completedAt: new Date(),
    });
    mockedPrisma.proPlayerOfMatchVote.groupBy.mockResolvedValueOnce([
      { votedRosterId: "p-z", _count: { _all: 3 } },
      { votedRosterId: "p-a", _count: { _all: 3 } },
    ]);

    const out = await getVoteTally("m1");
    expect(out.entries[0].rosterId).toBe("p-a");
    expect(out.winnerRosterId).toBe("p-a");
  });
});

describe("getWeeklyMvpLeaderboard", () => {
  it("retourne [] si aucun vote", async () => {
    mockedPrisma.proPlayerOfMatchVote.groupBy.mockResolvedValueOnce([]);
    expect(await getWeeklyMvpLeaderboard()).toEqual([]);
  });

  it("trie par voteCount desc + hydrate details", async () => {
    mockedPrisma.proPlayerOfMatchVote.groupBy.mockResolvedValueOnce([
      { votedRosterId: "p1", _count: { _all: 4 } },
      { votedRosterId: "p2", _count: { _all: 7 } },
    ]);
    mockedPrisma.proTeamRoster.findMany.mockResolvedValueOnce([
      { id: "p1", name: "A", position: "L", team: { slug: "tA", name: "TA" } },
      { id: "p2", name: "B", position: "B", team: { slug: "tB", name: "TB" } },
    ]);

    const out = await getWeeklyMvpLeaderboard(10);
    expect(out[0].rosterId).toBe("p2");
    expect(out[0].voteCount).toBe(7);
    expect(out[1].rosterId).toBe("p1");
  });

  it("cap a limit", async () => {
    mockedPrisma.proPlayerOfMatchVote.groupBy.mockResolvedValueOnce([
      { votedRosterId: "p1", _count: { _all: 5 } },
      { votedRosterId: "p2", _count: { _all: 4 } },
      { votedRosterId: "p3", _count: { _all: 3 } },
    ]);
    mockedPrisma.proTeamRoster.findMany.mockResolvedValueOnce([
      { id: "p1", name: "A", position: "L", team: { slug: "tA", name: "TA" } },
      { id: "p2", name: "B", position: "L", team: { slug: "tB", name: "TB" } },
    ]);

    const out = await getWeeklyMvpLeaderboard(2);
    expect(out).toHaveLength(2);
  });
});
