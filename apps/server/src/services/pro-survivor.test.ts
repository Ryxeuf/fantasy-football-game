/**
 * Tests unitaires du service pro-survivor.
 *
 * Couvre : submitSurvivorPick (validation, contraintes), computeTeamResult
 * (helper pur), settleSurvivorRound (alive/eliminated), getMySurvivorStatus,
 * getSurvivorStandings (tri).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueRound: { findUnique: vi.fn() },
    proLeagueMatch: { findFirst: vi.fn(), findMany: vi.fn() },
    proSurvivorEntry: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  SurvivorError,
  computeTeamResult,
  submitSurvivorPick,
  settleSurvivorRound,
  getMySurvivorStatus,
  getSurvivorStandings,
} from "./pro-survivor";

const mockedPrisma = prisma as unknown as {
  proLeagueRound: { findUnique: ReturnType<typeof vi.fn> };
  proLeagueMatch: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  proSurvivorEntry: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("computeTeamResult", () => {
  it("draw → draw quelque soit isHome", () => {
    expect(computeTeamResult("draw", true)).toBe("draw");
    expect(computeTeamResult("draw", false)).toBe("draw");
  });
  it("home + isHome=true → win", () => {
    expect(computeTeamResult("home", true)).toBe("win");
  });
  it("home + isHome=false → loss", () => {
    expect(computeTeamResult("home", false)).toBe("loss");
  });
  it("away + isHome=true → loss", () => {
    expect(computeTeamResult("away", true)).toBe("loss");
  });
  it("away + isHome=false → win", () => {
    expect(computeTeamResult("away", false)).toBe("win");
  });
  it("outcome inconnu → draw fallback", () => {
    expect(computeTeamResult("unknown", true)).toBe("draw");
  });
});

describe("submitSurvivorPick", () => {
  const baseInput = {
    seasonId: "s1",
    userId: "u1",
    roundId: "r1",
    teamId: "team-A",
  };

  it("rejette si round introuvable", async () => {
    mockedPrisma.proLeagueRound.findUnique.mockResolvedValueOnce(null);

    await expect(submitSurvivorPick(baseInput)).rejects.toMatchObject({
      code: "ROUND_NOT_FOUND",
    });
  });

  it("rejette si round != saison fournie", async () => {
    mockedPrisma.proLeagueRound.findUnique.mockResolvedValueOnce({
      id: "r1",
      seasonId: "other-season",
      roundNumber: 1,
      status: "pending",
    });

    await expect(submitSurvivorPick(baseInput)).rejects.toMatchObject({
      code: "ROUND_NOT_FOUND",
    });
  });

  it("rejette si round verrouille (in_progress)", async () => {
    mockedPrisma.proLeagueRound.findUnique.mockResolvedValueOnce({
      id: "r1",
      seasonId: "s1",
      roundNumber: 1,
      status: "in_progress",
    });

    await expect(submitSurvivorPick(baseInput)).rejects.toMatchObject({
      code: "ROUND_LOCKED",
    });
  });

  it("rejette si team ne joue pas dans ce round", async () => {
    mockedPrisma.proLeagueRound.findUnique.mockResolvedValueOnce({
      id: "r1",
      seasonId: "s1",
      roundNumber: 1,
      status: "pending",
    });
    mockedPrisma.proLeagueMatch.findFirst.mockResolvedValueOnce(null);

    await expect(submitSurvivorPick(baseInput)).rejects.toMatchObject({
      code: "TEAM_NOT_IN_ROUND",
    });
  });

  it("rejette si team deja piquee dans cette saison", async () => {
    mockedPrisma.proLeagueRound.findUnique.mockResolvedValueOnce({
      id: "r1",
      seasonId: "s1",
      roundNumber: 1,
      status: "pending",
    });
    mockedPrisma.proLeagueMatch.findFirst.mockResolvedValueOnce({
      id: "m1",
    });
    mockedPrisma.proSurvivorEntry.findUnique.mockResolvedValueOnce({
      id: "e1",
      weekN: 1,
    });

    await expect(submitSurvivorPick(baseInput)).rejects.toMatchObject({
      code: "TEAM_ALREADY_PICKED",
    });
  });

  it("rejette si user deja elimine", async () => {
    mockedPrisma.proLeagueRound.findUnique.mockResolvedValueOnce({
      id: "r1",
      seasonId: "s1",
      roundNumber: 2,
      status: "pending",
    });
    mockedPrisma.proLeagueMatch.findFirst.mockResolvedValueOnce({ id: "m1" });
    mockedPrisma.proSurvivorEntry.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.proSurvivorEntry.findFirst.mockResolvedValueOnce({
      id: "e0",
    });

    await expect(submitSurvivorPick(baseInput)).rejects.toMatchObject({
      code: "ALREADY_ELIMINATED",
    });
  });

  it("rejette si user a deja pick pour cette semaine", async () => {
    mockedPrisma.proLeagueRound.findUnique.mockResolvedValueOnce({
      id: "r1",
      seasonId: "s1",
      roundNumber: 2,
      status: "pending",
    });
    mockedPrisma.proLeagueMatch.findFirst.mockResolvedValueOnce({ id: "m1" });
    // 1er findUnique : pas piquee deja
    // 2eme findUnique (existingForRound) : trouve une entry
    mockedPrisma.proSurvivorEntry.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing" });
    mockedPrisma.proSurvivorEntry.findFirst.mockResolvedValueOnce(null);

    await expect(submitSurvivorPick(baseInput)).rejects.toMatchObject({
      code: "ALREADY_PICKED_THIS_WEEK",
    });
  });

  it("cree l'entry et retourne le statut pending", async () => {
    mockedPrisma.proLeagueRound.findUnique.mockResolvedValueOnce({
      id: "r1",
      seasonId: "s1",
      roundNumber: 3,
      status: "pending",
    });
    mockedPrisma.proLeagueMatch.findFirst.mockResolvedValueOnce({ id: "m1" });
    mockedPrisma.proSurvivorEntry.findUnique
      .mockResolvedValueOnce(null) // pas piquee
      .mockResolvedValueOnce(null); // pas de pick semaine
    mockedPrisma.proSurvivorEntry.findFirst.mockResolvedValueOnce(null);
    mockedPrisma.proSurvivorEntry.create.mockResolvedValueOnce({
      id: "new-e",
      seasonId: "s1",
      userId: "u1",
      roundId: "r1",
      weekN: 3,
      pickedTeamId: "team-A",
      status: "pending",
    });

    const result = await submitSurvivorPick(baseInput);

    expect(result).toEqual({
      entryId: "new-e",
      seasonId: "s1",
      userId: "u1",
      roundId: "r1",
      weekN: 3,
      pickedTeamId: "team-A",
      status: "pending",
    });
    const createArg = mockedPrisma.proSurvivorEntry.create.mock.calls[0][0];
    expect(createArg.data.weekN).toBe(3);
    expect(createArg.data.status).toBe("pending");
  });
});

describe("settleSurvivorRound", () => {
  it("no-op si aucune entry pending", async () => {
    mockedPrisma.proSurvivorEntry.findMany.mockResolvedValueOnce([]);

    const result = await settleSurvivorRound({ roundId: "r1" });

    expect(result).toEqual({
      roundId: "r1",
      entriesSettled: 0,
      alive: 0,
      eliminated: 0,
    });
    expect(mockedPrisma.proLeagueMatch.findMany).not.toHaveBeenCalled();
  });

  it("alive si team gagne (home win pour pickedTeam=home)", async () => {
    mockedPrisma.proSurvivorEntry.findMany.mockResolvedValueOnce([
      { id: "e1", pickedTeamId: "team-A" },
    ]);
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([
      { id: "m1", homeTeamId: "team-A", awayTeamId: "team-B", outcome: "home" },
    ]);
    mockedPrisma.proSurvivorEntry.update.mockResolvedValue({});

    const result = await settleSurvivorRound({ roundId: "r1" });

    expect(result).toEqual({
      roundId: "r1",
      entriesSettled: 1,
      alive: 1,
      eliminated: 0,
    });
    const updateArg = mockedPrisma.proSurvivorEntry.update.mock.calls[0][0];
    expect(updateArg.data).toEqual({
      status: "alive",
      result: "win",
      matchId: "m1",
    });
  });

  it("eliminated si team perd", async () => {
    mockedPrisma.proSurvivorEntry.findMany.mockResolvedValueOnce([
      { id: "e1", pickedTeamId: "team-A" },
    ]);
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([
      { id: "m1", homeTeamId: "team-A", awayTeamId: "team-B", outcome: "away" },
    ]);
    mockedPrisma.proSurvivorEntry.update.mockResolvedValue({});

    const result = await settleSurvivorRound({ roundId: "r1" });

    expect(result.eliminated).toBe(1);
    expect(result.alive).toBe(0);
    const updateArg = mockedPrisma.proSurvivorEntry.update.mock.calls[0][0];
    expect(updateArg.data.status).toBe("eliminated");
    expect(updateArg.data.result).toBe("loss");
  });

  it("eliminated sur draw (regle survivor classique)", async () => {
    mockedPrisma.proSurvivorEntry.findMany.mockResolvedValueOnce([
      { id: "e1", pickedTeamId: "team-A" },
    ]);
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([
      { id: "m1", homeTeamId: "team-A", awayTeamId: "team-B", outcome: "draw" },
    ]);
    mockedPrisma.proSurvivorEntry.update.mockResolvedValue({});

    const result = await settleSurvivorRound({ roundId: "r1" });

    expect(result.eliminated).toBe(1);
    expect(mockedPrisma.proSurvivorEntry.update.mock.calls[0][0].data.result).toBe(
      "draw",
    );
  });

  it("skip une entry dont le match n'a pas d'outcome", async () => {
    mockedPrisma.proSurvivorEntry.findMany.mockResolvedValueOnce([
      { id: "e1", pickedTeamId: "team-A" },
    ]);
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        homeTeamId: "team-A",
        awayTeamId: "team-B",
        outcome: null,
      },
    ]);

    const result = await settleSurvivorRound({ roundId: "r1" });

    expect(result).toEqual({
      roundId: "r1",
      entriesSettled: 0,
      alive: 0,
      eliminated: 0,
    });
    expect(mockedPrisma.proSurvivorEntry.update).not.toHaveBeenCalled();
  });

  it("traite plusieurs entries dans le meme round", async () => {
    mockedPrisma.proSurvivorEntry.findMany.mockResolvedValueOnce([
      { id: "e1", pickedTeamId: "team-A" },
      { id: "e2", pickedTeamId: "team-B" },
      { id: "e3", pickedTeamId: "team-C" },
    ]);
    mockedPrisma.proLeagueMatch.findMany.mockResolvedValueOnce([
      { id: "m1", homeTeamId: "team-A", awayTeamId: "team-X", outcome: "home" },
      { id: "m2", homeTeamId: "team-Y", awayTeamId: "team-B", outcome: "home" },
      { id: "m3", homeTeamId: "team-C", awayTeamId: "team-Z", outcome: "draw" },
    ]);
    mockedPrisma.proSurvivorEntry.update.mockResolvedValue({});

    const result = await settleSurvivorRound({ roundId: "r1" });

    expect(result.alive).toBe(1); // team-A
    expect(result.eliminated).toBe(2); // team-B (away loss) + team-C (draw)
  });
});

describe("getMySurvivorStatus", () => {
  it("isAlive=true si aucune entry", async () => {
    mockedPrisma.proSurvivorEntry.findMany.mockResolvedValueOnce([]);

    const status = await getMySurvivorStatus("s1", "u1");

    expect(status).toEqual({
      seasonId: "s1",
      isAlive: true,
      entries: [],
      pickedTeamIds: [],
    });
  });

  it("isAlive=true si toutes les entries sont alive/pending", async () => {
    mockedPrisma.proSurvivorEntry.findMany.mockResolvedValueOnce([
      {
        id: "e1",
        roundId: "r1",
        weekN: 1,
        pickedTeamId: "team-A",
        status: "alive",
        result: "win",
      },
      {
        id: "e2",
        roundId: "r2",
        weekN: 2,
        pickedTeamId: "team-B",
        status: "pending",
        result: null,
      },
    ]);

    const status = await getMySurvivorStatus("s1", "u1");

    expect(status.isAlive).toBe(true);
    expect(status.pickedTeamIds).toEqual(["team-A", "team-B"]);
  });

  it("isAlive=false si au moins une entry eliminated", async () => {
    mockedPrisma.proSurvivorEntry.findMany.mockResolvedValueOnce([
      {
        id: "e1",
        roundId: "r1",
        weekN: 1,
        pickedTeamId: "team-A",
        status: "alive",
        result: "win",
      },
      {
        id: "e2",
        roundId: "r2",
        weekN: 2,
        pickedTeamId: "team-B",
        status: "eliminated",
        result: "loss",
      },
    ]);

    const status = await getMySurvivorStatus("s1", "u1");

    expect(status.isAlive).toBe(false);
  });
});

describe("getSurvivorStandings", () => {
  it("retourne [] si aucune entry", async () => {
    mockedPrisma.proSurvivorEntry.findMany.mockResolvedValueOnce([]);
    const standings = await getSurvivorStandings("s1");
    expect(standings).toEqual([]);
  });

  it("compte weeksSurvived par user", async () => {
    mockedPrisma.proSurvivorEntry.findMany.mockResolvedValueOnce([
      { userId: "u1", status: "alive", user: { name: "Alice", email: "a@x.com" } },
      { userId: "u1", status: "alive", user: { name: "Alice", email: "a@x.com" } },
      { userId: "u2", status: "alive", user: { name: "Bob", email: "b@x.com" } },
      { userId: "u2", status: "eliminated", user: { name: "Bob", email: "b@x.com" } },
    ]);

    const standings = await getSurvivorStandings("s1");

    expect(standings).toHaveLength(2);
    const alice = standings.find((s) => s.userId === "u1")!;
    const bob = standings.find((s) => s.userId === "u2")!;
    expect(alice.weeksSurvived).toBe(2);
    expect(alice.isAlive).toBe(true);
    expect(bob.weeksSurvived).toBe(1);
    expect(bob.isAlive).toBe(false);
  });

  it("tri par weeksSurvived desc, isAlive desc, nom asc", async () => {
    mockedPrisma.proSurvivorEntry.findMany.mockResolvedValueOnce([
      // u1 : 3 alive, isAlive=true
      { userId: "u1", status: "alive", user: { name: "Alice", email: "a@x.com" } },
      { userId: "u1", status: "alive", user: { name: "Alice", email: "a@x.com" } },
      { userId: "u1", status: "alive", user: { name: "Alice", email: "a@x.com" } },
      // u2 : 3 alive mais 1 eliminated → isAlive=false
      { userId: "u2", status: "alive", user: { name: "Bob", email: "b@x.com" } },
      { userId: "u2", status: "alive", user: { name: "Bob", email: "b@x.com" } },
      { userId: "u2", status: "alive", user: { name: "Bob", email: "b@x.com" } },
      { userId: "u2", status: "eliminated", user: { name: "Bob", email: "b@x.com" } },
      // u3 : 2 alive, isAlive=true
      { userId: "u3", status: "alive", user: { name: "Charlie", email: "c@x.com" } },
      { userId: "u3", status: "alive", user: { name: "Charlie", email: "c@x.com" } },
    ]);

    const standings = await getSurvivorStandings("s1");

    expect(standings.map((s) => s.userId)).toEqual(["u1", "u2", "u3"]);
  });
});
