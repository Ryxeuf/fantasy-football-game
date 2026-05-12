/**
 * Sprint P — Lot P.B.2 : tests du service tournament-entry.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => {
  const tx = {
    proWallet: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    proTransaction: {
      create: vi.fn(),
    },
    proTournamentEntry: {
      create: vi.fn(),
    },
  };
  return {
    prisma: {
      proTournament: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      proTournamentEntry: {
        findUnique: vi.fn(),
        count: vi.fn(),
      },
      proWallet: { findUnique: vi.fn() },
      $transaction: vi.fn(async (cb: (tx: typeof tx) => unknown) => cb(tx)),
      __tx: tx,
    },
  };
});

vi.mock("./pro-wallet", async () => {
  const actual = await vi.importActual<typeof import("./pro-wallet")>(
    "./pro-wallet",
  );
  return {
    ...actual,
    getOrCreateWallet: vi.fn(async () => ({ userId: "u_1", crowns: 1000 })),
  };
});

import { prisma } from "../prisma";
import { InsufficientFundsError } from "./pro-wallet";
import {
  TournamentError,
  enterTournament,
  listOpenTournaments,
} from "./pro-tournament-entry";

const mocked = prisma as unknown as {
  proTournament: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  proTournamentEntry: {
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    findMany?: never;
  };
  proWallet: { findUnique: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
  __tx: {
    proWallet: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    proTransaction: { create: ReturnType<typeof vi.fn> };
    proTournamentEntry: { create: ReturnType<typeof vi.fn> };
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("enterTournament", () => {
  it("debit le wallet + cree entry si tout OK", async () => {
    mocked.proTournament.findUnique.mockResolvedValue({
      id: "t_1",
      entryFeeCrowns: 100,
      maxEntries: null,
      status: "open",
    } as never);
    mocked.proTournamentEntry.findUnique.mockResolvedValue(null as never);
    mocked.__tx.proWallet.findUnique.mockResolvedValue({ crowns: 500 } as never);
    mocked.__tx.proWallet.update.mockResolvedValue({ crowns: 400 } as never);
    mocked.__tx.proTransaction.create.mockResolvedValue({} as never);
    const now = new Date();
    mocked.__tx.proTournamentEntry.create.mockResolvedValue({
      id: "e_1",
      createdAt: now,
    } as never);

    const out = await enterTournament("u_1", "t_1");

    expect(out.granted).toBe(true);
    expect(out.paidCrowns).toBe(100);
    expect(out.balance).toBe(400);
    expect(out.tournamentId).toBe("t_1");
    expect(mocked.__tx.proWallet.update).toHaveBeenCalledWith({
      where: { userId: "u_1" },
      data: { crowns: 400 },
      select: { crowns: true },
    });
    expect(mocked.__tx.proTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        walletId: "u_1",
        type: "SINK",
        amount: -100,
        ref: "tournament-entry:t_1",
      }),
    });
  });

  it("est idempotent : 2eme call ne re-debit pas (granted=false)", async () => {
    mocked.proTournament.findUnique.mockResolvedValue({
      id: "t_1",
      entryFeeCrowns: 100,
      maxEntries: null,
      status: "open",
    } as never);
    const now = new Date();
    mocked.proTournamentEntry.findUnique.mockResolvedValue({
      id: "e_1",
      paidCrowns: 100,
      createdAt: now,
    } as never);

    const out = await enterTournament("u_1", "t_1");

    expect(out.granted).toBe(false);
    expect(out.entryId).toBe("e_1");
    expect(out.paidCrowns).toBe(100);
    expect(mocked.__tx.proWallet.update).not.toHaveBeenCalled();
  });

  it("throw TOURNAMENT_NOT_FOUND si l'id n'existe pas", async () => {
    mocked.proTournament.findUnique.mockResolvedValue(null as never);
    await expect(enterTournament("u_1", "missing")).rejects.toMatchObject({
      name: "TournamentError",
      code: "TOURNAMENT_NOT_FOUND",
    });
  });

  it("throw TOURNAMENT_CLOSED si status != open", async () => {
    mocked.proTournament.findUnique.mockResolvedValue({
      id: "t_1",
      entryFeeCrowns: 100,
      maxEntries: null,
      status: "closed",
    } as never);
    await expect(enterTournament("u_1", "t_1")).rejects.toMatchObject({
      code: "TOURNAMENT_CLOSED",
    });
  });

  it("throw TOURNAMENT_FULL si maxEntries atteint", async () => {
    mocked.proTournament.findUnique.mockResolvedValue({
      id: "t_1",
      entryFeeCrowns: 100,
      maxEntries: 10,
      status: "open",
    } as never);
    mocked.proTournamentEntry.findUnique.mockResolvedValue(null as never);
    mocked.proTournamentEntry.count.mockResolvedValue(10 as never);

    await expect(enterTournament("u_1", "t_1")).rejects.toMatchObject({
      code: "TOURNAMENT_FULL",
    });
  });

  it("throw InsufficientFunds si solde < fee", async () => {
    mocked.proTournament.findUnique.mockResolvedValue({
      id: "t_1",
      entryFeeCrowns: 100,
      maxEntries: null,
      status: "open",
    } as never);
    mocked.proTournamentEntry.findUnique.mockResolvedValue(null as never);
    mocked.__tx.proWallet.findUnique.mockResolvedValue({ crowns: 50 } as never);

    await expect(enterTournament("u_1", "t_1")).rejects.toBeInstanceOf(
      InsufficientFundsError,
    );
  });

  it("instanceof TournamentError pour les erreurs typees", async () => {
    mocked.proTournament.findUnique.mockResolvedValue(null as never);
    try {
      await enterTournament("u_1", "missing");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TournamentError);
    }
  });
});

describe("listOpenTournaments", () => {
  it("retourne les tournois open avec entries count", async () => {
    const mock = mocked.proTournament as unknown as {
      findMany: ReturnType<typeof vi.fn>;
    };
    mock.findMany = vi.fn().mockResolvedValue([
      {
        id: "t_1",
        slug: "winter-cup",
        name: "Winter Cup",
        description: null,
        entryFeeCrowns: 100,
        maxEntries: null,
        status: "open",
        startsAt: null,
        endsAt: null,
        createdAt: new Date("2026-05-12T10:00:00Z"),
        _count: { entries: 3 },
      },
    ]);
    // Sous-cle a la fois proTournament (via prisma.proTournament.findMany)
    // pour le path d'execution reel.
    (prisma as unknown as { proTournament: { findMany: typeof mock.findMany } })
      .proTournament.findMany = mock.findMany;

    const result = await listOpenTournaments();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "t_1",
      slug: "winter-cup",
      entriesCount: 3,
      status: "open",
    });
  });
});
