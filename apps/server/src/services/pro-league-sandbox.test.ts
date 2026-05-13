/**
 * Tests pour le service sandbox / test match (Lot 2.C.2).
 *
 * Couvre :
 *  - createTestMatch : validation des teams (distinctes, existantes),
 *    saison active requise, upsert round sandbox, persist isTest=true,
 *    appel simulateProMatch.
 *  - listTestMatches : filtre isTest, ordre décroissant, limite clampée.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueSeason: { findFirst: vi.fn() },
    proLeagueRound: { findUnique: vi.fn(), create: vi.fn() },
    proLeagueMatch: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    proTeam: { findMany: vi.fn() },
    replay: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("./pro-league-sim-runner", () => ({
  simulateProMatch: vi.fn(),
}));

import { prisma } from "../prisma";
import { simulateProMatch } from "./pro-league-sim-runner";
import {
  createTestMatch,
  listTestMatches,
  resimulateTestMatch,
} from "./pro-league-sandbox";

interface MockedPrisma {
  proLeagueSeason: { findFirst: ReturnType<typeof vi.fn> };
  proLeagueRound: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  proLeagueMatch: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  proTeam: { findMany: ReturnType<typeof vi.fn> };
  replay: { deleteMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
}

const mocked = prisma as unknown as MockedPrisma;
const mockedSim = simulateProMatch as ReturnType<typeof vi.fn>;

describe("createTestMatch — Lot 2.C.2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejette homeTeamId === awayTeamId", async () => {
    await expect(
      createTestMatch({ homeTeamId: "t1", awayTeamId: "t1" }),
    ).rejects.toThrow(/distincts/);
  });

  it("rejette si une team n'existe pas", async () => {
    mocked.proTeam.findMany.mockResolvedValue([{ id: "t1", slug: "a" }]);
    await expect(
      createTestMatch({ homeTeamId: "t1", awayTeamId: "t2" }),
    ).rejects.toThrow(/introuvables.*t2/);
  });

  it("rejette si aucune saison active", async () => {
    mocked.proTeam.findMany.mockResolvedValue([
      { id: "team-cuid-1", slug: "t1" },
      { id: "team-cuid-2", slug: "t2" },
    ]);
    mocked.proLeagueSeason.findFirst.mockResolvedValue(null);
    await expect(
      createTestMatch({ homeTeamId: "t1", awayTeamId: "t2" }),
    ).rejects.toThrow(/saison.*active/);
  });

  it("crée le match avec isTest=true et appelle simulateProMatch", async () => {
    mocked.proTeam.findMany.mockResolvedValue([
      { id: "team-cuid-1", slug: "t1" },
      { id: "team-cuid-2", slug: "t2" },
    ]);
    mocked.proLeagueSeason.findFirst.mockResolvedValue({
      id: "season-2026",
      engineVer: "0.16.0",
    });
    mocked.proLeagueRound.findUnique.mockResolvedValue({ id: "round-sandbox" });
    mocked.proLeagueMatch.create.mockResolvedValue({ id: "match-abc" });

    const result = await createTestMatch({
      homeTeamId: "t1",
      awayTeamId: "t2",
    });

    expect(mocked.proLeagueMatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          seasonId: "season-2026",
          roundId: "round-sandbox",
          // L'input passe le slug ("t1"), mais le create stocke l'id
          // Prisma (cuid) resolu via la lookup proTeam.findMany.
          homeTeamId: "team-cuid-1",
          awayTeamId: "team-cuid-2",
          isTest: true,
          status: "scheduled",
        }),
      }),
    );
    expect(mockedSim).toHaveBeenCalledWith("match-abc");
    expect(result).toEqual({
      matchId: "match-abc",
      seasonId: "season-2026",
      engineVer: "0.16.0",
    });
  });

  it("Lot 3.B.1 — driverKindOverride par défaut null (= inherit saison)", async () => {
    mocked.proTeam.findMany.mockResolvedValue([
      { id: "team-cuid-1", slug: "t1" },
      { id: "team-cuid-2", slug: "t2" },
    ]);
    mocked.proLeagueSeason.findFirst.mockResolvedValue({
      id: "season-2026",
      engineVer: "0.16.0",
    });
    mocked.proLeagueRound.findUnique.mockResolvedValue({ id: "r1" });
    mocked.proLeagueMatch.create.mockResolvedValue({ id: "m1" });

    await createTestMatch({ homeTeamId: "t1", awayTeamId: "t2" });

    expect(mocked.proLeagueMatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ driverKindOverride: null }),
      }),
    );
  });

  it("Lot 3.B.1 — propage driverKind='full' dans driverKindOverride", async () => {
    mocked.proTeam.findMany.mockResolvedValue([
      { id: "team-cuid-1", slug: "t1" },
      { id: "team-cuid-2", slug: "t2" },
    ]);
    mocked.proLeagueSeason.findFirst.mockResolvedValue({
      id: "season-2026",
      engineVer: "0.16.0",
    });
    mocked.proLeagueRound.findUnique.mockResolvedValue({ id: "r1" });
    mocked.proLeagueMatch.create.mockResolvedValue({ id: "m1" });

    await createTestMatch({
      homeTeamId: "t1",
      awayTeamId: "t2",
      driverKind: "full",
    });

    expect(mocked.proLeagueMatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ driverKindOverride: "full" }),
      }),
    );
  });

  it("Lot 3.B.1 — driverKind invalide (defense-in-depth) → null", async () => {
    mocked.proTeam.findMany.mockResolvedValue([
      { id: "team-cuid-1", slug: "t1" },
      { id: "team-cuid-2", slug: "t2" },
    ]);
    mocked.proLeagueSeason.findFirst.mockResolvedValue({
      id: "season-2026",
      engineVer: "0.16.0",
    });
    mocked.proLeagueRound.findUnique.mockResolvedValue({ id: "r1" });
    mocked.proLeagueMatch.create.mockResolvedValue({ id: "m1" });

    await createTestMatch({
      homeTeamId: "t1",
      awayTeamId: "t2",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      driverKind: "garbage" as any,
    });

    expect(mocked.proLeagueMatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ driverKindOverride: null }),
      }),
    );
  });

  it("upsert le round sandbox (roundNumber=0) si absent", async () => {
    mocked.proTeam.findMany.mockResolvedValue([
      { id: "team-cuid-1", slug: "t1" },
      { id: "team-cuid-2", slug: "t2" },
    ]);
    mocked.proLeagueSeason.findFirst.mockResolvedValue({
      id: "season-2026",
      engineVer: "0.16.0",
    });
    mocked.proLeagueRound.findUnique.mockResolvedValue(null);
    mocked.proLeagueRound.create.mockResolvedValue({ id: "round-fresh" });
    mocked.proLeagueMatch.create.mockResolvedValue({ id: "m1" });

    await createTestMatch({ homeTeamId: "t1", awayTeamId: "t2" });

    expect(mocked.proLeagueRound.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          seasonId: "season-2026",
          roundNumber: 0,
          status: "completed",
        }),
      }),
    );
  });
});

describe("listTestMatches — Lot 2.C.2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtre isTest=true, ordre décroissant sur createdAt, limite 20 par défaut", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    await listTestMatches();
    expect(mocked.proLeagueMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isTest: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    );
  });

  it("clamp la limite à [1, 100]", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    await listTestMatches(0);
    expect(mocked.proLeagueMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
    await listTestMatches(99999);
    expect(mocked.proLeagueMatch.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("formatte les rows en TestMatchSummary", async () => {
    const now = new Date("2026-05-07T12:00:00Z");
    mocked.proLeagueMatch.findMany.mockResolvedValue([
      {
        id: "m1",
        homeTeamId: "t1",
        awayTeamId: "t2",
        status: "ready",
        scoreHome: 2,
        scoreAway: 1,
        outcome: "home",
        engineVer: "0.16.0",
        createdAt: now,
        simulatedAt: now,
        homeTeam: { name: "Smashers" },
        awayTeam: { name: "Hawks" },
      },
    ]);
    const out = await listTestMatches();
    expect(out).toEqual([
      {
        id: "m1",
        homeTeamId: "t1",
        awayTeamId: "t2",
        homeTeamName: "Smashers",
        awayTeamName: "Hawks",
        status: "ready",
        scoreHome: 2,
        scoreAway: 1,
        outcome: "home",
        engineVer: "0.16.0",
        createdAt: now.toISOString(),
        simulatedAt: now.toISOString(),
      },
    ]);
  });
});

describe("resimulateTestMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );
  });

  it("refuse si le match n'existe pas", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(null);
    await expect(
      resimulateTestMatch({ matchId: "missing" }),
    ).rejects.toThrow(/introuvable/);
    expect(mockedSim).not.toHaveBeenCalled();
  });

  it("refuse de re-simuler un match de prod (isTest=false)", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      isTest: false,
      season: { engineVer: "0.18.0" },
    });
    await expect(
      resimulateTestMatch({ matchId: "m1" }),
    ).rejects.toThrow(/pas un test match/);
    expect(mockedSim).not.toHaveBeenCalled();
    expect(mocked.replay.deleteMany).not.toHaveBeenCalled();
  });

  it("wipe le replay + reset le match + relance la sim", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      isTest: true,
      season: { engineVer: "0.18.0" },
    });

    await resimulateTestMatch({ matchId: "m1", driverKind: "hybrid" });

    expect(mocked.replay.deleteMany).toHaveBeenCalledWith({
      where: { matchId: "m1" },
    });
    expect(mocked.proLeagueMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "m1" },
        data: expect.objectContaining({
          status: "scheduled",
          simulatedAt: null,
          completedAt: null,
          replayId: null,
          scoreHome: null,
          scoreAway: null,
          outcome: null,
          engineVer: null,
          driverKindOverride: "hybrid",
        }),
      }),
    );
    expect(mockedSim).toHaveBeenCalledWith("m1");
  });

  it("driverKind invalide → driverKindOverride: null (inherit saison)", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      isTest: true,
      season: { engineVer: "0.18.0" },
    });

    await resimulateTestMatch({
      matchId: "m1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      driverKind: "garbage" as any,
    });

    expect(mocked.proLeagueMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ driverKindOverride: null }),
      }),
    );
  });
});
