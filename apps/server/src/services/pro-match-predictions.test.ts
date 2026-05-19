/**
 * Tests unitaires du service pro-match-predictions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: { findUnique: vi.fn() },
    proMatchPrediction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      groupBy: vi.fn(),
    },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../prisma";
import {
  PredictionError,
  MAX_BODY_LENGTH,
  parseScoreFromBody,
  scorePrediction,
  createOrUpdatePrediction,
  listPredictions,
  settlePredictions,
  getSeerLeaderboard,
  deletePrediction,
  type PredictionContext,
} from "./pro-match-predictions";

const mockedPrisma = prisma as unknown as {
  proLeagueMatch: { findUnique: ReturnType<typeof vi.fn> };
  proMatchPrediction: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
  user: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.resetAllMocks();
});

const userBrief = { name: "Alice", email: "a@x.com" };

function predictionRow(over: Partial<any> = {}) {
  return {
    id: over.id ?? "p1",
    matchId: over.matchId ?? "m1",
    userId: over.userId ?? "u1",
    body: over.body ?? "Buf gagne 3-1",
    score: over.score ?? null,
    scoredAt: over.scoredAt ?? null,
    createdAt: over.createdAt ?? new Date("2026-05-21T10:00:00Z"),
    user: over.user ?? userBrief,
  };
}

const ctxBufWin: PredictionContext = {
  homeTeamSlug: "buf",
  homeTeamName: "Buffalo Snow Ogres",
  awayTeamSlug: "gb",
  awayTeamName: "Green Bay Halflings",
  scoreHome: 3,
  scoreAway: 1,
  outcome: "home",
};

describe("parseScoreFromBody", () => {
  it("parse X-Y", () => {
    expect(parseScoreFromBody("Buf 3-1")).toEqual({ first: 3, second: 1 });
  });
  it("parse X to Y", () => {
    expect(parseScoreFromBody("buffalo 4 to 2")).toEqual({
      first: 4,
      second: 2,
    });
  });
  it("parse X vs Y", () => {
    expect(parseScoreFromBody("score 2 vs 1")).toEqual({
      first: 2,
      second: 1,
    });
  });
  it("parse X tds Y", () => {
    expect(parseScoreFromBody("5 tds 0")).toEqual({ first: 5, second: 0 });
  });
  it("rejette scores > 20", () => {
    expect(parseScoreFromBody("100-50")).toBeNull();
  });
  it("null si pas de pattern", () => {
    expect(parseScoreFromBody("blowout incoming")).toBeNull();
  });
});

describe("scorePrediction", () => {
  it("perfect : winner mentionne + score exact", () => {
    expect(scorePrediction("Buf gagne 3-1", ctxBufWin)).toBe("perfect");
  });

  it("perfect : winner par nom + score exact", () => {
    expect(
      scorePrediction("Buffalo Snow Ogres win 3-1", ctxBufWin),
    ).toBe("perfect");
  });

  it("perfect : score inverse accepte (away-home)", () => {
    expect(scorePrediction("Buf 1-3", ctxBufWin)).toBe("perfect");
  });

  it("winner : equipe mentionnee mais score off", () => {
    expect(scorePrediction("Buf prend ca facile, 5-0", ctxBufWin)).toBe(
      "winner",
    );
  });

  it("winner : equipe seule (pas de score)", () => {
    expect(scorePrediction("Buf gagne", ctxBufWin)).toBe("winner");
  });

  it("wrong : ne mentionne pas le winner", () => {
    expect(scorePrediction("GB takes it 4-3", ctxBufWin)).toBe("wrong");
  });

  it("wrong : score correct mais wrong team", () => {
    expect(scorePrediction("gb 3-1", ctxBufWin)).toBe("wrong");
  });

  it("draw : 'draw' mentionne + outcome=draw", () => {
    const drawCtx: PredictionContext = {
      ...ctxBufWin,
      scoreHome: 2,
      scoreAway: 2,
      outcome: "draw",
    };
    expect(scorePrediction("it's a draw 2-2", drawCtx)).toBe("perfect");
  });

  it("draw : 'nul' francais accepte", () => {
    const drawCtx: PredictionContext = {
      ...ctxBufWin,
      scoreHome: 1,
      scoreAway: 1,
      outcome: "draw",
    };
    expect(scorePrediction("match nul 1-1", drawCtx)).toBe("perfect");
  });

  it("case-insensitive sur les noms d'equipes", () => {
    expect(scorePrediction("BUF takes it", ctxBufWin)).toBe("winner");
  });
});

describe("createOrUpdatePrediction", () => {
  it("BODY_EMPTY si trop court", async () => {
    await expect(
      createOrUpdatePrediction({
        matchId: "m1",
        userId: "u1",
        body: "ok",
      }),
    ).rejects.toMatchObject({ code: "BODY_EMPTY" });
  });

  it("BODY_TOO_LONG si > 200", async () => {
    await expect(
      createOrUpdatePrediction({
        matchId: "m1",
        userId: "u1",
        body: "a".repeat(MAX_BODY_LENGTH + 1),
      }),
    ).rejects.toMatchObject({ code: "BODY_TOO_LONG" });
  });

  it("MATCH_NOT_FOUND", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce(null);
    await expect(
      createOrUpdatePrediction({
        matchId: "x",
        userId: "u1",
        body: "Buf wins",
      }),
    ).rejects.toMatchObject({ code: "MATCH_NOT_FOUND" });
  });

  it("MATCH_LOCKED si pas scheduled", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "in_progress",
    });
    await expect(
      createOrUpdatePrediction({
        matchId: "m1",
        userId: "u1",
        body: "Buf wins",
      }),
    ).rejects.toMatchObject({ code: "MATCH_LOCKED" });
  });

  it("isUpdate=false si premier post", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "scheduled",
    });
    mockedPrisma.proMatchPrediction.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.proMatchPrediction.upsert.mockResolvedValueOnce(
      predictionRow({ body: "Buf gagne 3-1" }),
    );

    const out = await createOrUpdatePrediction({
      matchId: "m1",
      userId: "u1",
      body: "Buf gagne 3-1",
    });
    expect(out.isUpdate).toBe(false);
    expect(out.prediction.body).toBe("Buf gagne 3-1");
  });

  it("isUpdate=true si remplace", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "scheduled",
    });
    mockedPrisma.proMatchPrediction.findUnique.mockResolvedValueOnce({
      id: "p1",
    });
    mockedPrisma.proMatchPrediction.upsert.mockResolvedValueOnce(
      predictionRow({ id: "p1", body: "updated" }),
    );

    const out = await createOrUpdatePrediction({
      matchId: "m1",
      userId: "u1",
      body: "updated",
    });
    expect(out.isUpdate).toBe(true);
  });

  it("trim le body avant validation", async () => {
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "scheduled",
    });
    mockedPrisma.proMatchPrediction.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.proMatchPrediction.upsert.mockResolvedValueOnce(
      predictionRow({ body: "Buf wins" }),
    );
    await createOrUpdatePrediction({
      matchId: "m1",
      userId: "u1",
      body: "   Buf wins   ",
    });
    const arg = mockedPrisma.proMatchPrediction.upsert.mock.calls[0][0];
    expect(arg.create.body).toBe("Buf wins");
  });
});

describe("listPredictions", () => {
  it("retourne les predictions ordre asc", async () => {
    mockedPrisma.proMatchPrediction.findMany.mockResolvedValueOnce([
      predictionRow({ id: "p1" }),
      predictionRow({ id: "p2" }),
    ]);
    const out = await listPredictions("m1");
    expect(out).toHaveLength(2);
    const arg = mockedPrisma.proMatchPrediction.findMany.mock.calls[0][0];
    expect(arg.orderBy).toEqual({ createdAt: "asc" });
  });

  it("cap a 200", async () => {
    mockedPrisma.proMatchPrediction.findMany.mockResolvedValueOnce([]);
    await listPredictions("m1", 99999);
    const arg = mockedPrisma.proMatchPrediction.findMany.mock.calls[0][0];
    expect(arg.take).toBe(200);
  });
});

describe("settlePredictions", () => {
  it("no-op si rien a settle", async () => {
    mockedPrisma.proMatchPrediction.findMany.mockResolvedValueOnce([]);
    const out = await settlePredictions({
      matchId: "m1",
      ctx: ctxBufWin,
    });
    expect(out).toEqual({
      matchId: "m1",
      settled: 0,
      perfect: 0,
      winner: 0,
      wrong: 0,
    });
  });

  it("settle 3 predictions avec score correspondant", async () => {
    mockedPrisma.proMatchPrediction.findMany.mockResolvedValueOnce([
      { id: "p1", body: "Buf gagne 3-1" }, // perfect
      { id: "p2", body: "Buf wins easy" }, // winner
      { id: "p3", body: "GB by 4" }, // wrong
    ]);
    mockedPrisma.proMatchPrediction.updateMany.mockResolvedValue({ count: 1 });
    mockedPrisma.$transaction.mockResolvedValue([
      { count: 1 },
      { count: 1 },
      { count: 1 },
    ]);

    const out = await settlePredictions({
      matchId: "m1",
      ctx: ctxBufWin,
    });
    expect(out).toEqual({
      matchId: "m1",
      settled: 3,
      perfect: 1,
      winner: 1,
      wrong: 1,
    });
    // Round 9 (HIGH) : settle bulk via 3 updateMany dans $transaction.
    expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.proMatchPrediction.updateMany).toHaveBeenCalledTimes(3);
    const calls = mockedPrisma.proMatchPrediction.updateMany.mock.calls.map(
      (c: unknown[]) => c[0] as { where: { id: { in: string[] } }; data: { score: string } },
    );
    const perfectCall = calls.find((c) => c.data.score === "perfect");
    const winnerCall = calls.find((c) => c.data.score === "winner");
    const wrongCall = calls.find((c) => c.data.score === "wrong");
    expect(perfectCall?.where.id.in).toEqual(["p1"]);
    expect(winnerCall?.where.id.in).toEqual(["p2"]);
    expect(wrongCall?.where.id.in).toEqual(["p3"]);
  });
});

describe("getSeerLeaderboard", () => {
  it("retourne [] si aucune prediction", async () => {
    mockedPrisma.proMatchPrediction.groupBy.mockResolvedValueOnce([]);
    expect(await getSeerLeaderboard()).toEqual([]);
  });

  it("trie par perfect desc, winner desc, nom asc", async () => {
    // Round 10 (HIGH/perf) : agregation pousse cote DB via groupBy.
    // u1 : 2 perfect, 1 winner ; u2 : 2 perfect, 2 winner ; u3 : 3 perfect.
    mockedPrisma.proMatchPrediction.groupBy.mockResolvedValueOnce([
      { userId: "u1", score: "perfect", _count: { _all: 2 } },
      { userId: "u1", score: "winner", _count: { _all: 1 } },
      { userId: "u2", score: "perfect", _count: { _all: 2 } },
      { userId: "u2", score: "winner", _count: { _all: 2 } },
      { userId: "u3", score: "perfect", _count: { _all: 3 } },
    ]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      { id: "u1", name: "Alice" },
      { id: "u2", name: "Bob" },
      { id: "u3", name: "Charlie" },
    ]);

    const out = await getSeerLeaderboard(10);
    expect(out.map((e) => e.userId)).toEqual(["u3", "u2", "u1"]);
    expect(out[0].perfectCount).toBe(3);
    expect(out[1].winnerCount).toBe(2);
  });

  it("respecte limit", async () => {
    mockedPrisma.proMatchPrediction.groupBy.mockResolvedValueOnce([
      { userId: "u1", score: "perfect", _count: { _all: 1 } },
      { userId: "u2", score: "perfect", _count: { _all: 1 } },
    ]);
    mockedPrisma.user.findMany.mockResolvedValueOnce([
      { id: "u1", name: "Alice" },
      { id: "u2", name: "Bob" },
    ]);
    const out = await getSeerLeaderboard(1);
    expect(out).toHaveLength(1);
  });
});

describe("deletePrediction", () => {
  it("PREDICTION_NOT_FOUND si rien a supprimer", async () => {
    mockedPrisma.proMatchPrediction.findUnique.mockResolvedValueOnce(null);
    await expect(deletePrediction("m1", "u1")).rejects.toMatchObject({
      code: "PREDICTION_NOT_FOUND",
    });
  });

  it("supprime quand trouve", async () => {
    mockedPrisma.proMatchPrediction.findUnique.mockResolvedValueOnce({
      id: "p1",
    });
    mockedPrisma.proMatchPrediction.delete.mockResolvedValueOnce({});
    await deletePrediction("m1", "u1");
    expect(mockedPrisma.proMatchPrediction.delete).toHaveBeenCalledWith({
      where: { id: "p1" },
    });
  });
});
