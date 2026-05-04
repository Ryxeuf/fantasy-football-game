/**
 * L2.A.4 — Tests du service `league-match-from-pairing.ts`.
 *
 * Verifie :
 *  - 404 pairing introuvable
 *  - idempotent : retourne already-materialized si match existe deja
 *  - refuse si pairing pas en `scheduled`
 *  - refuse si appelant ne possede aucune des 2 equipes
 *  - refuse si meme coach des 2 cotes
 *  - cree Match + TeamSelection + bascule pairing en `in_progress`
 *    dans une transaction
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const txCalls: { match: any; teamSelection: any; leaguePairing: any } = {
  match: { create: vi.fn() },
  teamSelection: { createMany: vi.fn() },
  leaguePairing: { update: vi.fn() },
};

vi.mock("../prisma", () => ({
  prisma: {
    leaguePairing: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: typeof txCalls) => unknown) =>
      cb(txCalls),
    ),
  },
}));

import { prisma } from "../prisma";
import { createMatchFromPairing } from "./league-match-from-pairing";

type MockFn = ReturnType<typeof vi.fn>;
const findUniqueMock = prisma.leaguePairing.findUnique as MockFn;
const transactionMock = prisma.$transaction as MockFn;

beforeEach(() => {
  vi.clearAllMocks();
  txCalls.match.create.mockReset();
  txCalls.teamSelection.createMany.mockReset();
  txCalls.leaguePairing.update.mockReset();
  // Re-bind the transaction callback after reset.
  transactionMock.mockImplementation(async (cb: (tx: typeof txCalls) => unknown) =>
    cb(txCalls),
  );
});

function buildPairing(overrides: Record<string, unknown> = {}) {
  return {
    id: "pair1",
    status: "scheduled",
    match: null,
    round: { id: "r1", seasonId: "s1" },
    homeParticipant: {
      id: "lp-home",
      teamId: "t-home",
      team: { id: "t-home", ownerId: "u-home", name: "Skaven Squad" },
    },
    awayParticipant: {
      id: "lp-away",
      teamId: "t-away",
      team: { id: "t-away", ownerId: "u-away", name: "Wood Elves" },
    },
    ...overrides,
  };
}

describe("createMatchFromPairing", () => {
  it("throws when pairing does not exist", async () => {
    findUniqueMock.mockResolvedValue(null);
    await expect(
      createMatchFromPairing({ pairingId: "missing", userId: "u1" }),
    ).rejects.toThrow(/Pairing introuvable/);
  });

  it("returns already-materialized when match is already linked", async () => {
    findUniqueMock.mockResolvedValue(
      buildPairing({ match: { id: "m-existing" } }),
    );
    const result = await createMatchFromPairing({
      pairingId: "pair1",
      userId: "u-home",
    });
    expect(result).toEqual({
      created: false,
      reason: "already-materialized",
      matchId: "m-existing",
      pairingId: "pair1",
    });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejects pairings not in scheduled status", async () => {
    findUniqueMock.mockResolvedValue(buildPairing({ status: "cancelled" }));
    await expect(
      createMatchFromPairing({ pairingId: "pair1", userId: "u-home" }),
    ).rejects.toThrow(/status incompatible/);
  });

  it("rejects callers that do not own either team", async () => {
    findUniqueMock.mockResolvedValue(buildPairing());
    await expect(
      createMatchFromPairing({ pairingId: "pair1", userId: "u-other" }),
    ).rejects.toThrow(/un des deux coachs/);
  });

  it("rejects when both teams belong to the same coach", async () => {
    const same = buildPairing({
      awayParticipant: {
        id: "lp-away",
        teamId: "t-away",
        team: { id: "t-away", ownerId: "u-home", name: "Skaven 2" },
      },
    });
    findUniqueMock.mockResolvedValue(same);
    await expect(
      createMatchFromPairing({ pairingId: "pair1", userId: "u-home" }),
    ).rejects.toThrow(/meme coach/);
  });

  it("creates Match + TeamSelections + flips pairing to in_progress", async () => {
    findUniqueMock.mockResolvedValue(buildPairing());
    txCalls.match.create.mockResolvedValue({ id: "m-new" });
    txCalls.teamSelection.createMany.mockResolvedValue({ count: 2 });
    txCalls.leaguePairing.update.mockResolvedValue({});

    const result = await createMatchFromPairing({
      pairingId: "pair1",
      userId: "u-home",
      seed: "test-seed-123",
    });

    expect(result).toEqual({
      created: true,
      matchId: "m-new",
      pairingId: "pair1",
      seasonId: "s1",
      roundId: "r1",
    });

    const matchCreateArgs = txCalls.match.create.mock.calls[0][0];
    expect(matchCreateArgs.data.seed).toBe("test-seed-123");
    expect(matchCreateArgs.data.leagueSeasonId).toBe("s1");
    expect(matchCreateArgs.data.leagueRoundId).toBe("r1");
    expect(matchCreateArgs.data.leaguePairingId).toBe("pair1");
    expect(matchCreateArgs.data.players.connect).toEqual([
      { id: "u-home" },
      { id: "u-away" },
    ]);

    const tsArgs = txCalls.teamSelection.createMany.mock.calls[0][0];
    expect(tsArgs.data).toHaveLength(2);
    expect(tsArgs.data[0]).toMatchObject({
      matchId: "m-new",
      userId: "u-home",
      teamId: "t-home",
      team: "Skaven Squad",
    });

    const updateArgs = txCalls.leaguePairing.update.mock.calls[0][0];
    expect(updateArgs).toEqual({
      where: { id: "pair1" },
      data: { status: "in_progress" },
    });
  });

  it("auto-generates a seed when none is provided", async () => {
    findUniqueMock.mockResolvedValue(buildPairing());
    txCalls.match.create.mockResolvedValue({ id: "m-new" });
    txCalls.teamSelection.createMany.mockResolvedValue({ count: 2 });
    txCalls.leaguePairing.update.mockResolvedValue({});

    await createMatchFromPairing({ pairingId: "pair1", userId: "u-away" });

    const seed = txCalls.match.create.mock.calls[0][0].data.seed as string;
    expect(seed).toMatch(/^league-match-/);
  });
});
