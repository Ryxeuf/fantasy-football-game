/**
 * Tests pour `dedicateHallOfFame` + `listDedications` (Sprint P — Lot P.B.2).
 *
 * Couvre :
 *   - 404 HOF_NOT_FOUND.
 *   - INVALID_MESSAGE (vide / trim).
 *   - MESSAGE_TOO_LONG (>280 chars).
 *   - InsufficientFundsError (<500 Crowns).
 *   - Happy path : granted=true, balance debite, ref correct.
 *   - Idempotence : 2eme call meme user/hof → granted=false, pas de nouveau debit.
 *   - listDedications : tri desc, limit cap.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proHallOfFame: { findUnique: vi.fn() },
    proHallOfFameDedication: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    proWallet: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
    },
    proTransaction: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("./pro-wallet", async () => {
  const actual =
    await vi.importActual<typeof import("./pro-wallet")>("./pro-wallet");
  return {
    ...actual,
    getOrCreateWallet: vi.fn(),
  };
});

import { prisma } from "../prisma";
import { getOrCreateWallet, InsufficientFundsError } from "./pro-wallet";
import {
  DEDICATE_COST_CROWNS,
  DedicateError,
  dedicateHallOfFame,
  listDedications,
} from "./pro-hall-of-fame-dedicate";

interface MockedPrisma {
  proHallOfFame: { findUnique: ReturnType<typeof vi.fn> };
  proHallOfFameDedication: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  proWallet: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  proTransaction: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
}

const mocked = prisma as unknown as MockedPrisma;
const mockedGetWallet = vi.mocked(getOrCreateWallet);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetWallet.mockResolvedValue({ userId: "u1", crowns: 1000 });
  mocked.proHallOfFame.findUnique.mockResolvedValue({ id: "hof_1" });
});

describe("dedicateHallOfFame — Lot P.B.2", () => {
  it("404 HOF_NOT_FOUND si l'entree n'existe pas", async () => {
    mocked.proHallOfFame.findUnique.mockResolvedValueOnce(null);
    await expect(
      dedicateHallOfFame("u1", "missing", "Hello"),
    ).rejects.toThrow(DedicateError);
  });

  it("INVALID_MESSAGE si message vide / whitespace", async () => {
    for (const empty of ["", "   ", "\n\t"]) {
      await expect(
        dedicateHallOfFame("u1", "hof_1", empty),
      ).rejects.toThrow(/vide/i);
    }
  });

  it("MESSAGE_TOO_LONG si > 280 chars", async () => {
    const long = "a".repeat(281);
    await expect(
      dedicateHallOfFame("u1", "hof_1", long),
    ).rejects.toMatchObject({ code: "MESSAGE_TOO_LONG" });
  });

  it("InsufficientFundsError si solde < 500", async () => {
    mocked.proHallOfFameDedication.findUnique.mockResolvedValueOnce(null);
    mocked.$transaction.mockImplementationOnce(async (cb) => {
      const tx = {
        proWallet: {
          findUnique: vi.fn().mockResolvedValue({ crowns: 100 }), // insufficient
          update: vi.fn(),
        },
        proTransaction: { create: vi.fn() },
        proHallOfFameDedication: { create: vi.fn() },
      };
      return cb(tx);
    });
    await expect(
      dedicateHallOfFame("u1", "hof_1", "Hello"),
    ).rejects.toThrow(InsufficientFundsError);
  });

  it("happy path : granted=true + debit + ref + dedication cree", async () => {
    mocked.proHallOfFameDedication.findUnique.mockResolvedValueOnce(null);
    const txCreate = vi.fn().mockResolvedValue({ id: "tx_1" });
    const dedCreate = vi.fn().mockResolvedValue({
      id: "ded_1",
      createdAt: new Date("2026-05-11T08:00:00Z"),
    });
    const walletUpdate = vi.fn().mockResolvedValue({ crowns: 500 });
    mocked.$transaction.mockImplementationOnce(async (cb) => {
      const tx = {
        proWallet: {
          findUnique: vi.fn().mockResolvedValue({ crowns: 1000 }),
          update: walletUpdate,
        },
        proTransaction: { create: txCreate },
        proHallOfFameDedication: { create: dedCreate },
      };
      return cb(tx);
    });

    const out = await dedicateHallOfFame("u1", "hof_1", "Pour Grom, le meilleur");
    expect(out.granted).toBe(true);
    expect(out.dedicationId).toBe("ded_1");
    expect(out.message).toBe("Pour Grom, le meilleur");
    expect(out.costCrowns).toBe(DEDICATE_COST_CROWNS);
    expect(out.balance).toBe(500);
    expect(walletUpdate).toHaveBeenCalledWith({
      where: { userId: "u1" },
      data: { crowns: 500 },
      select: { crowns: true },
    });
    expect(txCreate).toHaveBeenCalledWith({
      data: {
        walletId: "u1",
        type: "SINK",
        amount: -500,
        ref: "hof-dedicate:hof_1",
      },
    });
    expect(dedCreate).toHaveBeenCalledWith({
      data: {
        hallOfFameId: "hof_1",
        userId: "u1",
        message: "Pour Grom, le meilleur",
        costCrowns: 500,
      },
      select: { id: true, createdAt: true },
    });
  });

  it("idempotent : 2eme call meme user/hof → granted=false, pas de nouveau debit", async () => {
    mocked.proHallOfFameDedication.findUnique.mockResolvedValueOnce({
      id: "ded_existing",
      message: "Already there",
      costCrowns: 500,
      createdAt: new Date("2026-05-10T12:00:00Z"),
    });
    const out = await dedicateHallOfFame("u1", "hof_1", "New message");
    expect(out.granted).toBe(false);
    expect(out.dedicationId).toBe("ded_existing");
    expect(out.message).toBe("Already there"); // ancien message preserve, pas update gratuit
    expect(mocked.$transaction).not.toHaveBeenCalled();
  });

  it("trim le message avant validation et insert", async () => {
    mocked.proHallOfFameDedication.findUnique.mockResolvedValueOnce(null);
    const dedCreate = vi.fn().mockResolvedValue({
      id: "ded_x",
      createdAt: new Date(),
    });
    mocked.$transaction.mockImplementationOnce(async (cb) => {
      const tx = {
        proWallet: {
          findUnique: vi.fn().mockResolvedValue({ crowns: 1000 }),
          update: vi.fn().mockResolvedValue({ crowns: 500 }),
        },
        proTransaction: { create: vi.fn() },
        proHallOfFameDedication: { create: dedCreate },
      };
      return cb(tx);
    });
    await dedicateHallOfFame("u1", "hof_1", "  Hello world  ");
    expect(dedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ message: "Hello world" }),
      }),
    );
  });
});

describe("listDedications — Lot P.B.2", () => {
  it("retourne les dedications triees desc par createdAt", async () => {
    mocked.proHallOfFameDedication.findMany.mockResolvedValueOnce([
      {
        id: "d1",
        userId: "u1",
        message: "Hommage",
        costCrowns: 500,
        createdAt: new Date("2026-05-11T08:00:00Z"),
        user: { coachName: "Alice" },
      },
      {
        id: "d2",
        userId: "u2",
        message: "Legend",
        costCrowns: 500,
        createdAt: new Date("2026-05-10T12:00:00Z"),
        user: { coachName: "Bob" },
      },
    ]);
    const out = await listDedications("hof_1");
    expect(out).toHaveLength(2);
    expect(out[0]!.coachName).toBe("Alice");
    expect(out[0]!.message).toBe("Hommage");
    expect(out[1]!.coachName).toBe("Bob");
    expect(mocked.proHallOfFameDedication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { hallOfFameId: "hof_1" },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  });

  it("clamp limit entre 1 et 200", async () => {
    mocked.proHallOfFameDedication.findMany.mockResolvedValue([]);
    await listDedications("hof_1", 9999);
    expect(mocked.proHallOfFameDedication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
    await listDedications("hof_1", 0);
    expect(mocked.proHallOfFameDedication.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 1 }),
    );
  });
});
