/**
 * Tests unitaires du service pro-player-career-stats.
 *
 * Couvre :
 *  - Helpers purs (outcomeForPlayerTeam, computeCurrentStreak, topOpponent,
 *    aggregateContributions)
 *  - getCareerSnapshot avec mock prisma (stale path → recompute)
 *  - recomputeCareerSnapshot avec mock prisma (cas simple)
 *  - PlayerCareerNotFoundError
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proTeamRoster: { findUnique: vi.fn(), findMany: vi.fn() },
    proLeagueMatch: { findMany: vi.fn() },
    proPlayerCareerSnapshot: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
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

import type { MatchContribution } from "./pro-player-career-stats";
import {
  PlayerCareerNotFoundError,
  outcomeForPlayerTeam,
  computeCurrentStreak,
  topOpponent,
  topOpponents,
  topMatchesBySpp,
  parseStringArrayJson,
  parseTopMatchesJson,
  aggregateContributions,
  recomputeCareerSnapshot,
  getCareerSnapshot,
  STALE_WINDOW_MS,
} from "./pro-player-career-stats";

const mockedPrisma = prisma as unknown as {
  proTeamRoster: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  proLeagueMatch: { findMany: ReturnType<typeof vi.fn> };
  proPlayerCareerSnapshot: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  replay: { findUnique: ReturnType<typeof vi.fn> };
};

const mockedDecompress = vi.mocked(decompressEvents);
const mockedAttributeSpp = vi.mocked(attributeSpp);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("outcomeForPlayerTeam", () => {
  it("null si match outcome null", () => {
    expect(outcomeForPlayerTeam(null, true)).toBeNull();
  });
  it("draw → draw quel que soit isHome", () => {
    expect(outcomeForPlayerTeam("draw", true)).toBe("draw");
    expect(outcomeForPlayerTeam("draw", false)).toBe("draw");
  });
  it("home + isHome=true → win", () => {
    expect(outcomeForPlayerTeam("home", true)).toBe("win");
  });
  it("home + isHome=false → loss", () => {
    expect(outcomeForPlayerTeam("home", false)).toBe("loss");
  });
  it("away + isHome=true → loss", () => {
    expect(outcomeForPlayerTeam("away", true)).toBe("loss");
  });
  it("away + isHome=false → win", () => {
    expect(outcomeForPlayerTeam("away", false)).toBe("win");
  });
});

describe("computeCurrentStreak", () => {
  it("none/0 si tableau vide", () => {
    expect(computeCurrentStreak([])).toEqual({ kind: "none", length: 0 });
  });
  it("compte les wins consecutifs depuis le plus recent", () => {
    expect(
      computeCurrentStreak([
        { outcome: "win" },
        { outcome: "win" },
        { outcome: "win" },
        { outcome: "loss" },
      ]),
    ).toEqual({ kind: "win", length: 3 });
  });
  it("stoppe au premier changement", () => {
    expect(
      computeCurrentStreak([
        { outcome: "loss" },
        { outcome: "win" },
        { outcome: "win" },
      ]),
    ).toEqual({ kind: "loss", length: 1 });
  });
  it("draw streak gere", () => {
    expect(
      computeCurrentStreak([{ outcome: "draw" }, { outcome: "draw" }]),
    ).toEqual({ kind: "draw", length: 2 });
  });
});

function fakeContribution(
  partial: Partial<MatchContribution>,
): MatchContribution {
  return {
    matchId: partial.matchId ?? "m1",
    opponentTeamId: partial.opponentTeamId ?? "team-X",
    outcome: partial.outcome ?? "win",
    totalSpp: partial.totalSpp ?? 0,
    td: partial.td ?? 0,
    cas: partial.cas ?? 0,
    comp: partial.comp ?? 0,
    mvp: partial.mvp ?? 0,
    casReceived: partial.casReceived ?? 0,
    casDealt: partial.casDealt ?? 0,
  };
}

describe("topOpponent", () => {
  it("null si aucune contribution", () => {
    expect(topOpponent([], "loss")).toBeNull();
  });

  it("retourne le top opponent par filter='loss'", () => {
    expect(
      topOpponent(
        [
          fakeContribution({ outcome: "loss", opponentTeamId: "A" }),
          fakeContribution({ outcome: "loss", opponentTeamId: "A" }),
          fakeContribution({ outcome: "loss", opponentTeamId: "B" }),
          fakeContribution({ outcome: "win", opponentTeamId: "C" }),
        ],
        "loss",
      ),
    ).toBe("A");
  });

  it("ignore les outcomes != filter", () => {
    expect(
      topOpponent(
        [
          fakeContribution({ outcome: "win", opponentTeamId: "A" }),
          fakeContribution({ outcome: "win", opponentTeamId: "A" }),
        ],
        "loss",
      ),
    ).toBeNull();
  });
});

describe("aggregateContributions", () => {
  it("tout zero si vide", () => {
    const agg = aggregateContributions([]);
    expect(agg.matchesPlayed).toBe(0);
    expect(agg.sppTotal).toBe(0);
    expect(agg.bestMatchId).toBeNull();
    expect(agg.streakKind).toBe("none");
  });

  it("totalise correctement td/cas/comp/mvp/spp", () => {
    const agg = aggregateContributions([
      fakeContribution({ matchId: "m1", totalSpp: 9, td: 1, cas: 1, comp: 1 }),
      fakeContribution({ matchId: "m2", totalSpp: 4, td: 0, cas: 1, mvp: 1 }),
    ]);
    expect(agg.matchesPlayed).toBe(2);
    expect(agg.sppTotal).toBe(13);
    expect(agg.tdTotal).toBe(1);
    expect(agg.casTotal).toBe(2);
    expect(agg.compTotal).toBe(1);
    expect(agg.mvpTotal).toBe(1);
  });

  it("detecte best/worst match par totalSpp", () => {
    const agg = aggregateContributions([
      fakeContribution({ matchId: "m1", totalSpp: 5 }),
      fakeContribution({ matchId: "m2", totalSpp: 12 }),
      fakeContribution({ matchId: "m3", totalSpp: 0 }),
    ]);
    expect(agg.bestMatchId).toBe("m2");
    expect(agg.bestMatchSpp).toBe(12);
    expect(agg.worstMatchId).toBe("m3");
    expect(agg.worstMatchSpp).toBe(0);
  });

  it("calcule nemesis et victory en parallele", () => {
    const agg = aggregateContributions([
      fakeContribution({ outcome: "loss", opponentTeamId: "nemesis" }),
      fakeContribution({ outcome: "loss", opponentTeamId: "nemesis" }),
      fakeContribution({ outcome: "win", opponentTeamId: "easy" }),
      fakeContribution({ outcome: "win", opponentTeamId: "easy" }),
      fakeContribution({ outcome: "win", opponentTeamId: "easy" }),
    ]);
    expect(agg.topNemesisTeamId).toBe("nemesis");
    expect(agg.topVictoryTeamId).toBe("easy");
  });

  it("streak reflete contributions ordonnees newest-first", () => {
    const agg = aggregateContributions([
      fakeContribution({ outcome: "win" }),
      fakeContribution({ outcome: "win" }),
      fakeContribution({ outcome: "loss" }),
    ]);
    expect(agg.streakKind).toBe("win");
    expect(agg.streakLength).toBe(2);
  });
});

describe("recomputeCareerSnapshot", () => {
  it("rejette si joueur introuvable", async () => {
    mockedPrisma.proTeamRoster.findUnique.mockResolvedValueOnce(null);
    await expect(recomputeCareerSnapshot("ghost")).rejects.toBeInstanceOf(
      PlayerCareerNotFoundError,
    );
  });

  it("snapshot vide si player sans matchs", async () => {
    mockedPrisma.proTeamRoster.findUnique.mockResolvedValueOnce({
      teamId: "team-A",
    });
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([]);
    mockedPrisma.proPlayerCareerSnapshot.upsert.mockResolvedValueOnce({});

    const snap = await recomputeCareerSnapshot("p1");

    expect(snap.matchesPlayed).toBe(0);
    expect(snap.sppTotal).toBe(0);
    expect(snap.streakKind).toBe("none");
    expect(mockedPrisma.proPlayerCareerSnapshot.upsert).toHaveBeenCalledTimes(1);
  });

  it("aggregate 2 matchs (home win + away loss)", async () => {
    mockedPrisma.proTeamRoster.findUnique.mockResolvedValueOnce({
      teamId: "team-A",
    });
    // newest first
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        status: "completed",
        scheduledAt: new Date("2026-05-10"),
        homeTeamId: "team-A",
        awayTeamId: "team-B",
        outcome: "home",
        seed: 42,
      },
      {
        id: "m2",
        status: "completed",
        scheduledAt: new Date("2026-05-03"),
        homeTeamId: "team-C",
        awayTeamId: "team-A",
        outcome: "home",
        seed: 43,
      },
    ]);

    // Replay stubs
    mockedPrisma.replay.findUnique
      .mockResolvedValueOnce({ payload: Buffer.from("any") })
      .mockResolvedValueOnce({ payload: Buffer.from("any") });
    mockedDecompress
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    // Rosters home/away pour les 2 matchs (4 findMany)
    mockedPrisma.proTeamRoster.findMany
      .mockResolvedValueOnce([{ id: "p1" }])
      .mockResolvedValueOnce([{ id: "px" }])
      .mockResolvedValueOnce([{ id: "py" }])
      .mockResolvedValueOnce([{ id: "p1" }]);

    // attributeSpp returns rewards pour p1
    mockedAttributeSpp
      .mockReturnValueOnce({
        rewards: [
          { rosterId: "p1", tdCount: 2, casCount: 1, compCount: 0, mvpCount: 1, totalSpp: 11 },
        ],
      } as any)
      .mockReturnValueOnce({
        rewards: [
          { rosterId: "p1", tdCount: 0, casCount: 0, compCount: 0, mvpCount: 0, totalSpp: 0 },
        ],
      } as any);

    mockedPrisma.proPlayerCareerSnapshot.upsert.mockResolvedValueOnce({});

    const snap = await recomputeCareerSnapshot("p1");

    expect(snap.matchesPlayed).toBe(2);
    expect(snap.sppTotal).toBe(11);
    expect(snap.tdTotal).toBe(2);
    expect(snap.bestMatchId).toBe("m1");
    expect(snap.worstMatchId).toBe("m2");
    // m1 (newest) = home win → win, m2 (older) = home win pour team-C → loss pour team-A
    expect(snap.streakKind).toBe("win");
    expect(snap.streakLength).toBe(1);
    expect(snap.topNemesisTeamId).toBe("team-C");
    expect(snap.topVictoryTeamId).toBe("team-B");
  });

  it("skip matchs sans replay", async () => {
    mockedPrisma.proTeamRoster.findUnique.mockResolvedValueOnce({
      teamId: "team-A",
    });
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        status: "completed",
        scheduledAt: new Date(),
        homeTeamId: "team-A",
        awayTeamId: "team-B",
        outcome: "home",
        seed: 1,
      },
    ]);
    mockedPrisma.replay.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.proPlayerCareerSnapshot.upsert.mockResolvedValueOnce({});

    const snap = await recomputeCareerSnapshot("p1");

    expect(snap.matchesPlayed).toBe(0);
    expect(mockedAttributeSpp).not.toHaveBeenCalled();
  });

  it("skip matchs sans outcome", async () => {
    mockedPrisma.proTeamRoster.findUnique.mockResolvedValueOnce({
      teamId: "team-A",
    });
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        status: "completed",
        scheduledAt: new Date(),
        homeTeamId: "team-A",
        awayTeamId: "team-B",
        outcome: null,
        seed: 1,
      },
    ]);
    mockedPrisma.proPlayerCareerSnapshot.upsert.mockResolvedValueOnce({});

    const snap = await recomputeCareerSnapshot("p1");

    expect(snap.matchesPlayed).toBe(0);
    expect(mockedPrisma.replay.findUnique).not.toHaveBeenCalled();
  });

  it("skip matchs avec replay decompress failure", async () => {
    mockedPrisma.proTeamRoster.findUnique.mockResolvedValueOnce({
      teamId: "team-A",
    });
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        status: "completed",
        scheduledAt: new Date(),
        homeTeamId: "team-A",
        awayTeamId: "team-B",
        outcome: "home",
        seed: 1,
      },
    ]);
    mockedPrisma.replay.findUnique.mockResolvedValueOnce({
      payload: Buffer.from("x"),
    });
    mockedDecompress.mockRejectedValueOnce(new Error("decompress fail"));
    mockedPrisma.proPlayerCareerSnapshot.upsert.mockResolvedValueOnce({});

    const snap = await recomputeCareerSnapshot("p1");

    expect(snap.matchesPlayed).toBe(0);
  });
});

describe("getCareerSnapshot", () => {
  it("recompute si pas de snapshot existant", async () => {
    mockedPrisma.proPlayerCareerSnapshot.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.proTeamRoster.findUnique.mockResolvedValueOnce({
      teamId: "team-A",
    });
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([]);
    mockedPrisma.proPlayerCareerSnapshot.upsert.mockResolvedValueOnce({});

    const snap = await getCareerSnapshot("p1");

    expect(snap.playerId).toBe("p1");
    expect(mockedPrisma.proPlayerCareerSnapshot.upsert).toHaveBeenCalledTimes(1);
  });

  it("recompute si stale (recomputedAt > STALE_WINDOW_MS)", async () => {
    const staleDate = new Date(Date.now() - STALE_WINDOW_MS - 60_000);
    mockedPrisma.proPlayerCareerSnapshot.findUnique.mockResolvedValueOnce({
      playerId: "p1",
      matchesPlayed: 0,
      tdTotal: 0,
      casTotal: 0,
      compTotal: 0,
      mvpTotal: 0,
      sppTotal: 0,
      bestMatchId: null,
      bestMatchSpp: null,
      worstMatchId: null,
      worstMatchSpp: null,
      topNemesisTeamId: null,
      topVictoryTeamId: null,
      streakKind: "none",
      streakLength: 0,
      recomputedAt: staleDate,
    });
    mockedPrisma.proTeamRoster.findUnique.mockResolvedValueOnce({
      teamId: "team-A",
    });
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([]);
    mockedPrisma.proPlayerCareerSnapshot.upsert.mockResolvedValueOnce({});

    await getCareerSnapshot("p1");

    expect(mockedPrisma.proPlayerCareerSnapshot.upsert).toHaveBeenCalledTimes(1);
  });

  it("retourne le snapshot existant si frais", async () => {
    const freshDate = new Date(Date.now() - 60_000);
    mockedPrisma.proPlayerCareerSnapshot.findUnique.mockResolvedValueOnce({
      playerId: "p1",
      matchesPlayed: 10,
      tdTotal: 5,
      casTotal: 3,
      compTotal: 2,
      mvpTotal: 1,
      sppTotal: 50,
      bestMatchId: "m1",
      bestMatchSpp: 11,
      worstMatchId: "m2",
      worstMatchSpp: 0,
      topNemesisTeamId: "n1",
      topVictoryTeamId: "v1",
      streakKind: "win",
      streakLength: 4,
      recomputedAt: freshDate,
    });

    const snap = await getCareerSnapshot("p1");

    expect(snap.matchesPlayed).toBe(10);
    expect(snap.streakKind).toBe("win");
    expect(snap.streakLength).toBe(4);
    expect(mockedPrisma.proPlayerCareerSnapshot.upsert).not.toHaveBeenCalled();
  });

  it("relit topMatches/topNemesisIds/topVictoryIds depuis JSON existant", async () => {
    const freshDate = new Date(Date.now() - 60_000);
    mockedPrisma.proPlayerCareerSnapshot.findUnique.mockResolvedValueOnce({
      playerId: "p1",
      matchesPlayed: 5,
      tdTotal: 1,
      casTotal: 0,
      compTotal: 0,
      mvpTotal: 0,
      sppTotal: 8,
      bestMatchId: "m-best",
      bestMatchSpp: 8,
      worstMatchId: "m-worst",
      worstMatchSpp: 0,
      topNemesisTeamId: "n1",
      topVictoryTeamId: "v1",
      topMatchesJson: [
        { matchId: "m-best", sppTotal: 8 },
        { matchId: "m2", sppTotal: 5 },
      ],
      topNemesisIdsJson: ["n1", "n2"],
      topVictoryIdsJson: ["v1", "v2", "v3"],
      casualtiesReceived: 1,
      casualtiesDealt: 2,
      streakKind: "win",
      streakLength: 2,
      recomputedAt: freshDate,
    });

    const snap = await getCareerSnapshot("p1");

    expect(snap.topMatches).toEqual([
      { matchId: "m-best", sppTotal: 8 },
      { matchId: "m2", sppTotal: 5 },
    ]);
    expect(snap.topNemesisIds).toEqual(["n1", "n2"]);
    expect(snap.topVictoryIds).toEqual(["v1", "v2", "v3"]);
    expect(snap.casualtiesReceived).toBe(1);
    expect(snap.casualtiesDealt).toBe(2);
  });

  it("tolere snapshot ou les JSONs sont des strings sqlite", async () => {
    const freshDate = new Date(Date.now() - 60_000);
    mockedPrisma.proPlayerCareerSnapshot.findUnique.mockResolvedValueOnce({
      playerId: "p1",
      matchesPlayed: 1,
      tdTotal: 0,
      casTotal: 0,
      compTotal: 0,
      mvpTotal: 0,
      sppTotal: 0,
      bestMatchId: null,
      bestMatchSpp: null,
      worstMatchId: null,
      worstMatchSpp: null,
      topNemesisTeamId: null,
      topVictoryTeamId: null,
      topMatchesJson: JSON.stringify([{ matchId: "m1", sppTotal: 3 }]),
      topNemesisIdsJson: JSON.stringify(["n1"]),
      topVictoryIdsJson: JSON.stringify(["v1"]),
      casualtiesReceived: 0,
      casualtiesDealt: 0,
      streakKind: "win",
      streakLength: 1,
      recomputedAt: freshDate,
    });

    const snap = await getCareerSnapshot("p1");

    expect(snap.topMatches).toEqual([{ matchId: "m1", sppTotal: 3 }]);
    expect(snap.topNemesisIds).toEqual(["n1"]);
    expect(snap.topVictoryIds).toEqual(["v1"]);
  });

  // Audit round 9 (HIGH/perf) : single-flight lock contre la thunder-herd.
  it("partage la promesse de recompute entre N appels concurrents pour le meme playerId", async () => {
    // Snapshot stale ou absent → 2 appels concurrents devraient partager
    // le meme recompute (un seul upsert, pas N).
    mockedPrisma.proPlayerCareerSnapshot.findUnique.mockResolvedValue(null);
    mockedPrisma.proTeamRoster.findUnique.mockResolvedValue({
      teamId: "team-A",
    });
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValue([]);
    mockedPrisma.proPlayerCareerSnapshot.upsert.mockResolvedValue({});

    const [s1, s2, s3] = await Promise.all([
      getCareerSnapshot("p-thunder"),
      getCareerSnapshot("p-thunder"),
      getCareerSnapshot("p-thunder"),
    ]);

    expect(s1.playerId).toBe("p-thunder");
    expect(s2.playerId).toBe("p-thunder");
    expect(s3.playerId).toBe("p-thunder");
    // 3 appels concurrents → 1 seul recompute partage.
    expect(mockedPrisma.proPlayerCareerSnapshot.upsert).toHaveBeenCalledTimes(1);
  });

  it("re-cree un recompute apres completion (lock libere en .finally)", async () => {
    mockedPrisma.proPlayerCareerSnapshot.findUnique.mockResolvedValue(null);
    mockedPrisma.proTeamRoster.findUnique.mockResolvedValue({
      teamId: "team-A",
    });
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValue([]);
    mockedPrisma.proPlayerCareerSnapshot.upsert.mockResolvedValue({});

    await getCareerSnapshot("p-seq");
    await getCareerSnapshot("p-seq");

    // 2 appels sequentiels (pas concurrents) → lock libere apres le 1er
    // → 2 recomputes distincts.
    expect(mockedPrisma.proPlayerCareerSnapshot.upsert).toHaveBeenCalledTimes(2);
  });
});

describe("topOpponents", () => {
  it("retourne [] si aucune contribution", () => {
    expect(topOpponents([], "loss", 3)).toEqual([]);
  });

  it("retourne les top N opponents trie par count desc", () => {
    expect(
      topOpponents(
        [
          fakeContribution({ outcome: "loss", opponentTeamId: "A" }),
          fakeContribution({ outcome: "loss", opponentTeamId: "A" }),
          fakeContribution({ outcome: "loss", opponentTeamId: "B" }),
          fakeContribution({ outcome: "loss", opponentTeamId: "C" }),
          fakeContribution({ outcome: "loss", opponentTeamId: "C" }),
          fakeContribution({ outcome: "win", opponentTeamId: "D" }),
        ],
        "loss",
        2,
      ),
    ).toEqual(["A", "C"]);
  });

  it("limit=0 → []", () => {
    expect(
      topOpponents(
        [fakeContribution({ outcome: "loss", opponentTeamId: "A" })],
        "loss",
        0,
      ),
    ).toEqual([]);
  });

  it("tie-break par id alphabetique asc quand egalite", () => {
    const result = topOpponents(
      [
        fakeContribution({ outcome: "loss", opponentTeamId: "C" }),
        fakeContribution({ outcome: "loss", opponentTeamId: "A" }),
        fakeContribution({ outcome: "loss", opponentTeamId: "B" }),
      ],
      "loss",
      3,
    );
    expect(result).toEqual(["A", "B", "C"]);
  });
});

describe("topMatchesBySpp", () => {
  it("retourne [] si aucune contribution", () => {
    expect(topMatchesBySpp([], 5)).toEqual([]);
  });

  it("trie par totalSpp desc, prend les top N", () => {
    const result = topMatchesBySpp(
      [
        fakeContribution({ matchId: "m1", totalSpp: 3 }),
        fakeContribution({ matchId: "m2", totalSpp: 10 }),
        fakeContribution({ matchId: "m3", totalSpp: 5 }),
        fakeContribution({ matchId: "m4", totalSpp: 8 }),
      ],
      2,
    );
    expect(result).toEqual([
      { matchId: "m2", sppTotal: 10 },
      { matchId: "m4", sppTotal: 8 },
    ]);
  });

  it("tie-break par matchId asc quand egalite SPP", () => {
    const result = topMatchesBySpp(
      [
        fakeContribution({ matchId: "m-z", totalSpp: 5 }),
        fakeContribution({ matchId: "m-a", totalSpp: 5 }),
      ],
      2,
    );
    expect(result[0].matchId).toBe("m-a");
    expect(result[1].matchId).toBe("m-z");
  });
});

describe("aggregateContributions — Q.A.2 extension", () => {
  it("expose topMatches (top 5)", () => {
    const contributions = Array.from({ length: 8 }, (_, i) =>
      fakeContribution({ matchId: `m${i}`, totalSpp: i }),
    );
    const agg = aggregateContributions(contributions);
    expect(agg.topMatches).toHaveLength(5);
    expect(agg.topMatches[0].sppTotal).toBe(7);
  });

  it("expose topNemesisIds (top 3) et topVictoryIds (top 3)", () => {
    const agg = aggregateContributions([
      fakeContribution({ outcome: "loss", opponentTeamId: "N1" }),
      fakeContribution({ outcome: "loss", opponentTeamId: "N1" }),
      fakeContribution({ outcome: "loss", opponentTeamId: "N2" }),
      fakeContribution({ outcome: "loss", opponentTeamId: "N3" }),
      fakeContribution({ outcome: "loss", opponentTeamId: "N4" }),
      fakeContribution({ outcome: "win", opponentTeamId: "V1" }),
      fakeContribution({ outcome: "win", opponentTeamId: "V1" }),
      fakeContribution({ outcome: "win", opponentTeamId: "V2" }),
    ]);
    expect(agg.topNemesisIds).toHaveLength(3);
    expect(agg.topNemesisIds[0]).toBe("N1");
    expect(agg.topVictoryIds[0]).toBe("V1");
  });

  it("expose casualtiesReceived et casualtiesDealt", () => {
    const agg = aggregateContributions([
      fakeContribution({ casReceived: 1, casDealt: 2 }),
      fakeContribution({ casReceived: 0, casDealt: 3 }),
    ]);
    expect(agg.casualtiesReceived).toBe(1);
    expect(agg.casualtiesDealt).toBe(5);
  });

  it("topNemesisTeamId = premier element de topNemesisIds (back-compat)", () => {
    const agg = aggregateContributions([
      fakeContribution({ outcome: "loss", opponentTeamId: "N1" }),
      fakeContribution({ outcome: "loss", opponentTeamId: "N1" }),
      fakeContribution({ outcome: "loss", opponentTeamId: "N2" }),
    ]);
    expect(agg.topNemesisTeamId).toBe("N1");
    expect(agg.topNemesisIds[0]).toBe("N1");
  });
});

describe("parseStringArrayJson", () => {
  it("retourne [] pour null/undefined", () => {
    expect(parseStringArrayJson(null)).toEqual([]);
    expect(parseStringArrayJson(undefined)).toEqual([]);
  });
  it("retourne array natif PG", () => {
    expect(parseStringArrayJson(["a", "b"])).toEqual(["a", "b"]);
  });
  it("parse string JSON sqlite", () => {
    expect(parseStringArrayJson('["x","y"]')).toEqual(["x", "y"]);
  });
  it("filtre les non-strings", () => {
    expect(parseStringArrayJson(["a", 42, null, "b"])).toEqual(["a", "b"]);
  });
  it("retourne [] pour JSON invalide", () => {
    expect(parseStringArrayJson("{not json")).toEqual([]);
  });
});

describe("parseTopMatchesJson", () => {
  it("retourne [] pour null", () => {
    expect(parseTopMatchesJson(null)).toEqual([]);
  });
  it("parse array natif PG", () => {
    expect(
      parseTopMatchesJson([
        { matchId: "m1", sppTotal: 5 },
        { matchId: "m2", sppTotal: 3 },
      ]),
    ).toEqual([
      { matchId: "m1", sppTotal: 5 },
      { matchId: "m2", sppTotal: 3 },
    ]);
  });
  it("parse string JSON sqlite", () => {
    expect(
      parseTopMatchesJson(JSON.stringify([{ matchId: "x", sppTotal: 7 }])),
    ).toEqual([{ matchId: "x", sppTotal: 7 }]);
  });
  it("filtre les items mal formes", () => {
    expect(
      parseTopMatchesJson([
        { matchId: "ok", sppTotal: 1 },
        { matchId: "missing-spp" }, // pas de sppTotal
        { sppTotal: 2 }, // pas de matchId
        "string",
        null,
      ]),
    ).toEqual([{ matchId: "ok", sppTotal: 1 }]);
  });
  it("retourne [] pour JSON invalide", () => {
    expect(parseTopMatchesJson("{not json")).toEqual([]);
  });
});
