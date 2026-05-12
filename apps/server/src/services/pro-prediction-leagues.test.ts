/**
 * Tests unitaires du service pro-prediction-leagues.
 *
 * Couvre : helpers purs (joinCode, isValidSelection, computeMatchResult)
 * + comportement metier avec prisma mocke (createLeague, joinLeague,
 * submitPick, settlePicks, leaderboard).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proPredictionLeague: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    proPredictionLeagueMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
    proPredictionPick: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    proLeagueMatch: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  PredictionLeagueError,
  generateJoinCode,
  isValidSelection,
  computeMatchResult,
  createLeague,
  joinLeagueByCode,
  submitPick,
  getLeagueLeaderboard,
  settlePicksForMatch,
} from "./pro-prediction-leagues";

const mockedPrisma = prisma as unknown as {
  proPredictionLeague: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  proPredictionLeagueMember: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  proPredictionPick: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  proLeagueMatch: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  // resetAllMocks vide aussi la queue mockResolvedValueOnce (vs clearAllMocks).
  vi.resetAllMocks();
});

describe("generateJoinCode", () => {
  it("genere un code de 8 caracteres", () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(8);
  });

  it("utilise uniquement l'alphabet safe (sans 0/O/1/I)", () => {
    for (let i = 0; i < 100; i += 1) {
      const code = generateJoinCode();
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });

  it("est deterministe avec un rng seedé", () => {
    let n = 0;
    const rng = () => {
      n += 0.1;
      return (n - Math.floor(n));
    };
    const code1 = generateJoinCode(rng);
    n = 0;
    const code2 = generateJoinCode(rng);
    expect(code1).toBe(code2);
  });
});

describe("isValidSelection", () => {
  it("accepte home/draw/away", () => {
    expect(isValidSelection("home")).toBe(true);
    expect(isValidSelection("draw")).toBe(true);
    expect(isValidSelection("away")).toBe(true);
  });
  it("rejette autres valeurs", () => {
    expect(isValidSelection("HOME")).toBe(false);
    expect(isValidSelection("")).toBe(false);
    expect(isValidSelection("tie")).toBe(false);
  });
});

describe("computeMatchResult", () => {
  it("home si scoreHome > scoreAway", () => {
    expect(computeMatchResult(3, 1)).toBe("home");
  });
  it("away si scoreAway > scoreHome", () => {
    expect(computeMatchResult(0, 2)).toBe("away");
  });
  it("draw si egalite", () => {
    expect(computeMatchResult(1, 1)).toBe("draw");
    expect(computeMatchResult(0, 0)).toBe("draw");
  });
});

describe("createLeague", () => {
  it("rejette nom trop court", async () => {
    await expect(
      createLeague({ name: "ab", ownerId: "u1" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejette nom trop long", async () => {
    await expect(
      createLeague({ name: "a".repeat(51), ownerId: "u1" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("trim le nom avant validation", async () => {
    // "  ab  " trimme = "ab" → INVALID
    await expect(
      createLeague({ name: "  ab  ", ownerId: "u1" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("cree la ligue et ajoute le owner comme membre", async () => {
    mockedPrisma.proPredictionLeague.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.proPredictionLeague.create.mockResolvedValueOnce({
      id: "l1",
      joinCode: "ABCDEFGH",
    });

    const result = await createLeague({ name: "Mon Bureau", ownerId: "u1" });

    expect(result).toEqual({ leagueId: "l1", joinCode: "ABCDEFGH" });
    expect(mockedPrisma.proPredictionLeague.create).toHaveBeenCalledTimes(1);
    const createArg = mockedPrisma.proPredictionLeague.create.mock.calls[0][0];
    expect(createArg.data.ownerId).toBe("u1");
    expect(createArg.data.members.create).toEqual({ userId: "u1" });
  });

  it("retry si joinCode existe deja", async () => {
    mockedPrisma.proPredictionLeague.findUnique
      .mockResolvedValueOnce({ id: "existing" })
      .mockResolvedValueOnce(null);
    mockedPrisma.proPredictionLeague.create.mockResolvedValueOnce({
      id: "l2",
      joinCode: "XYZ12345",
    });

    const result = await createLeague({ name: "Test", ownerId: "u1" });

    expect(result.leagueId).toBe("l2");
    expect(mockedPrisma.proPredictionLeague.findUnique).toHaveBeenCalledTimes(2);
  });

  it("isPrivate default = true", async () => {
    mockedPrisma.proPredictionLeague.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.proPredictionLeague.create.mockResolvedValueOnce({
      id: "l1",
      joinCode: "X",
    });
    await createLeague({ name: "Test", ownerId: "u1" });
    const arg = mockedPrisma.proPredictionLeague.create.mock.calls[0][0];
    expect(arg.data.isPrivate).toBe(true);
  });

  it("isPrivate=false respecte", async () => {
    mockedPrisma.proPredictionLeague.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.proPredictionLeague.create.mockResolvedValueOnce({
      id: "l1",
      joinCode: "X",
    });
    await createLeague({ name: "Test", ownerId: "u1", isPrivate: false });
    const arg = mockedPrisma.proPredictionLeague.create.mock.calls[0][0];
    expect(arg.data.isPrivate).toBe(false);
  });
});

describe("joinLeagueByCode", () => {
  it("rejette code de mauvaise longueur", async () => {
    await expect(joinLeagueByCode("ABC", "u1")).rejects.toMatchObject({
      code: "JOIN_CODE_INVALID",
    });
  });

  it("rejette code introuvable", async () => {
    mockedPrisma.proPredictionLeague.findUnique.mockResolvedValueOnce(null);
    await expect(
      joinLeagueByCode("NOTAREAL1", "u1"),
    ).rejects.toMatchObject({ code: "JOIN_CODE_INVALID" });
  });

  it("normalise le code (uppercase + trim)", async () => {
    mockedPrisma.proPredictionLeague.findUnique.mockResolvedValueOnce({
      id: "l1",
      name: "Test",
    });
    mockedPrisma.proPredictionLeagueMember.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.proPredictionLeagueMember.create.mockResolvedValueOnce({});

    await joinLeagueByCode("  abc123fg  ", "u1");

    expect(
      mockedPrisma.proPredictionLeague.findUnique,
    ).toHaveBeenCalledWith({
      where: { joinCode: "ABC123FG" },
      select: { id: true, name: true },
    });
  });

  it("idempotent si deja membre (no-op create)", async () => {
    mockedPrisma.proPredictionLeague.findUnique.mockResolvedValueOnce({
      id: "l1",
      name: "Test",
    });
    mockedPrisma.proPredictionLeagueMember.findUnique.mockResolvedValueOnce({
      id: "m1",
    });

    const result = await joinLeagueByCode("ABCDEFGH", "u1");

    expect(result).toEqual({ leagueId: "l1", leagueName: "Test" });
    expect(
      mockedPrisma.proPredictionLeagueMember.create,
    ).not.toHaveBeenCalled();
  });

  it("ajoute le membre si pas encore", async () => {
    mockedPrisma.proPredictionLeague.findUnique.mockResolvedValueOnce({
      id: "l1",
      name: "Test",
    });
    mockedPrisma.proPredictionLeagueMember.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.proPredictionLeagueMember.create.mockResolvedValueOnce({});

    await joinLeagueByCode("ABCDEFGH", "u1");

    expect(mockedPrisma.proPredictionLeagueMember.create).toHaveBeenCalledWith({
      data: { leagueId: "l1", userId: "u1" },
    });
  });
});

describe("submitPick", () => {
  it("rejette selection invalide", async () => {
    await expect(
      submitPick({
        leagueId: "l1",
        userId: "u1",
        matchId: "m1",
        selection: "tie",
      }),
    ).rejects.toMatchObject({ code: "INVALID_SELECTION" });
  });

  it("rejette si user pas membre", async () => {
    mockedPrisma.proPredictionLeagueMember.findUnique.mockResolvedValueOnce(null);

    await expect(
      submitPick({
        leagueId: "l1",
        userId: "u1",
        matchId: "m1",
        selection: "home",
      }),
    ).rejects.toMatchObject({ code: "NOT_MEMBER" });
  });

  it("rejette si match introuvable", async () => {
    mockedPrisma.proPredictionLeagueMember.findUnique.mockResolvedValueOnce({
      id: "m1",
    });
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce(null);

    await expect(
      submitPick({
        leagueId: "l1",
        userId: "u1",
        matchId: "missing",
        selection: "home",
      }),
    ).rejects.toMatchObject({ code: "MATCH_NOT_FOUND" });
  });

  it("rejette si match deja commence", async () => {
    mockedPrisma.proPredictionLeagueMember.findUnique.mockResolvedValueOnce({
      id: "m1",
    });
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "in_progress",
    });

    await expect(
      submitPick({
        leagueId: "l1",
        userId: "u1",
        matchId: "m1",
        selection: "home",
      }),
    ).rejects.toMatchObject({ code: "MATCH_LOCKED" });
  });

  it("upsert pick avec isUpdate=false si premier pick", async () => {
    mockedPrisma.proPredictionLeagueMember.findUnique.mockResolvedValueOnce({
      id: "m1",
    });
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "scheduled",
    });
    mockedPrisma.proPredictionPick.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.proPredictionPick.upsert.mockResolvedValueOnce({
      id: "pick1",
      selection: "home",
    });

    const result = await submitPick({
      leagueId: "l1",
      userId: "u1",
      matchId: "m1",
      selection: "home",
    });

    expect(result).toEqual({
      pickId: "pick1",
      selection: "home",
      isUpdate: false,
    });
  });

  it("upsert pick avec isUpdate=true si pick existe deja", async () => {
    mockedPrisma.proPredictionLeagueMember.findUnique.mockResolvedValueOnce({
      id: "m1",
    });
    mockedPrisma.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "scheduled",
    });
    mockedPrisma.proPredictionPick.findUnique.mockResolvedValueOnce({
      id: "pick1",
    });
    mockedPrisma.proPredictionPick.upsert.mockResolvedValueOnce({
      id: "pick1",
      selection: "away",
    });

    const result = await submitPick({
      leagueId: "l1",
      userId: "u1",
      matchId: "m1",
      selection: "away",
    });

    expect(result.isUpdate).toBe(true);
  });
});

describe("getLeagueLeaderboard", () => {
  it("retourne [] si aucun membre", async () => {
    mockedPrisma.proPredictionLeagueMember.findMany.mockResolvedValueOnce([]);
    const lb = await getLeagueLeaderboard("l1");
    expect(lb).toEqual([]);
  });

  it("calcule stats par membre", async () => {
    mockedPrisma.proPredictionLeagueMember.findMany.mockResolvedValueOnce([
      { userId: "u1", user: { name: "Alice", email: "a@x.com" } },
      { userId: "u2", user: { name: "Bob", email: "b@x.com" } },
    ]);
    mockedPrisma.proPredictionPick.findMany.mockResolvedValueOnce([
      { userId: "u1", correct: true },
      { userId: "u1", correct: true },
      { userId: "u1", correct: false },
      { userId: "u2", correct: true },
    ]);

    const lb = await getLeagueLeaderboard("l1");

    expect(lb).toHaveLength(2);
    expect(lb[0]).toMatchObject({
      userId: "u1",
      correctPicks: 2,
      totalPicks: 3,
    });
    expect(lb[0].accuracy).toBeCloseTo(2 / 3, 5);
    expect(lb[1]).toMatchObject({
      userId: "u2",
      correctPicks: 1,
      totalPicks: 1,
    });
  });

  it("trie par correctPicks desc puis accuracy desc puis nom", async () => {
    mockedPrisma.proPredictionLeagueMember.findMany.mockResolvedValueOnce([
      { userId: "u1", user: { name: "Alice", email: "a@x.com" } },
      { userId: "u2", user: { name: "Bob", email: "b@x.com" } },
      { userId: "u3", user: { name: "Charlie", email: "c@x.com" } },
    ]);
    // u1: 2/2 (100%), u2: 3/5 (60%), u3: 2/3 (66%)
    mockedPrisma.proPredictionPick.findMany.mockResolvedValueOnce([
      { userId: "u1", correct: true },
      { userId: "u1", correct: true },
      { userId: "u2", correct: true },
      { userId: "u2", correct: true },
      { userId: "u2", correct: true },
      { userId: "u2", correct: false },
      { userId: "u2", correct: false },
      { userId: "u3", correct: true },
      { userId: "u3", correct: true },
      { userId: "u3", correct: false },
    ]);

    const lb = await getLeagueLeaderboard("l1");

    // u2 a 3 correct → 1er. u3 et u1 a 2 correct, mais u1 a meilleur accuracy.
    expect(lb.map((e) => e.userId)).toEqual(["u2", "u1", "u3"]);
  });

  it("inclus members sans picks avec stats 0/0", async () => {
    mockedPrisma.proPredictionLeagueMember.findMany.mockResolvedValueOnce([
      { userId: "u1", user: { name: "Alice", email: "a@x.com" } },
    ]);
    mockedPrisma.proPredictionPick.findMany.mockResolvedValueOnce([]);

    const lb = await getLeagueLeaderboard("l1");

    expect(lb).toEqual([
      {
        userId: "u1",
        userName: "Alice",
        userEmail: "a@x.com",
        totalPicks: 0,
        correctPicks: 0,
        accuracy: 0,
      },
    ]);
  });
});

describe("settlePicksForMatch", () => {
  it("set result + correct sur chaque pick", async () => {
    mockedPrisma.proPredictionPick.findMany.mockResolvedValueOnce([
      { id: "p1", selection: "home" },
      { id: "p2", selection: "away" },
      { id: "p3", selection: "draw" },
    ]);
    mockedPrisma.proPredictionPick.update.mockResolvedValue({});

    const result = await settlePicksForMatch({
      matchId: "m1",
      result: "home",
    });

    expect(result).toEqual({
      matchId: "m1",
      result: "home",
      picksSettled: 3,
      correctPicks: 1,
    });
    expect(mockedPrisma.proPredictionPick.update).toHaveBeenCalledTimes(3);
    const firstUpdate = mockedPrisma.proPredictionPick.update.mock.calls[0][0];
    expect(firstUpdate.data).toEqual({ result: "home", correct: true });
    const secondUpdate = mockedPrisma.proPredictionPick.update.mock.calls[1][0];
    expect(secondUpdate.data).toEqual({ result: "home", correct: false });
  });

  it("draw → tous les pickers draw sont corrects", async () => {
    mockedPrisma.proPredictionPick.findMany.mockResolvedValueOnce([
      { id: "p1", selection: "home" },
      { id: "p2", selection: "draw" },
    ]);
    mockedPrisma.proPredictionPick.update.mockResolvedValue({});

    const result = await settlePicksForMatch({
      matchId: "m1",
      result: "draw",
    });

    expect(result.correctPicks).toBe(1);
  });

  it("aucun pick → picksSettled=0", async () => {
    mockedPrisma.proPredictionPick.findMany.mockResolvedValueOnce([]);

    const result = await settlePicksForMatch({
      matchId: "m1",
      result: "home",
    });

    expect(result).toEqual({
      matchId: "m1",
      result: "home",
      picksSettled: 0,
      correctPicks: 0,
    });
    expect(mockedPrisma.proPredictionPick.update).not.toHaveBeenCalled();
  });
});
