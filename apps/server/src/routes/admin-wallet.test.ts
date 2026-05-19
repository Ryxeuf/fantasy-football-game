/**
 * Lot P.B.1 — Tests d'integration des endpoints admin wallet.
 *
 * Couvre :
 *  - GET    /admin/wallets/:userId           : snapshot + paginations
 *  - PATCH  /admin/wallets/:userId/balance   : adjust delta>0 / delta<0,
 *    insufficient funds 422, self-adjust 400, audit log
 *  - POST   /admin/bets/:betId/refund        : refund pending + post-settlement,
 *    void 409, 404, audit log
 *
 * Mock prisma + service pro-wallet pour isoler la logique du router.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Audit round 7 : admin refund utilise maintenant `updateMany` avec
// WHERE conditionnel + creditInTx dans la $transaction. Mock retourne
// `count: 1` par defaut pour simuler le happy path.
vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    proWallet: { findUnique: vi.fn() },
    proTransaction: { findMany: vi.fn(), count: vi.fn() },
    proBet: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    $transaction: vi.fn(async (fn: any) =>
      fn({
        proBet: {
          update: vi.fn(async () => ({ id: "bet-1", status: "void" })),
          updateMany: vi.fn(async () => ({ count: 1 })),
        },
      }),
    ),
  },
}));

vi.mock("../middleware/authUser", () => ({
  authUser: (req: any, _res: any, next: any) => {
    req.user = { id: "admin-1", role: "admin", roles: ["admin"] };
    return next();
  },
}));

vi.mock("../middleware/adminOnly", () => ({
  adminOnly: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../services/audit-log", () => ({
  safeRecordAdminActionFromRequest: vi.fn(async () => {}),
}));

vi.mock("../services/pro-wallet", () => {
  class InsufficientFundsError extends Error {
    readonly code = "WALLET_INSUFFICIENT_FUNDS";
    constructor(
      public readonly available: number,
      public readonly requested: number,
    ) {
      super(`Solde insuffisant : ${available} < ${requested}`);
      this.name = "InsufficientFundsError";
    }
  }
  return {
    credit: vi.fn(async () => 1000),
    creditInTx: vi.fn(async () => 1000),
    debit: vi.fn(async () => 500),
    ensureWalletExists: vi.fn(async () => undefined),
    InsufficientFundsError,
  };
});

import express from "express";
import http from "http";
import walletRouter from "./admin-wallet";
import { prisma } from "../prisma";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import {
  credit as creditMock,
  debit as debitMock,
  InsufficientFundsError,
} from "../services/pro-wallet";

const credit = vi.mocked(creditMock);
const debit = vi.mocked(debitMock);

interface MockedPrisma {
  user: { findUnique: ReturnType<typeof vi.fn> };
  proWallet: { findUnique: ReturnType<typeof vi.fn> };
  proTransaction: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  proBet: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}

const mockedPrisma = prisma as unknown as MockedPrisma;
const mockedAudit = vi.mocked(safeRecordAdminActionFromRequest);

async function request(
  method: "GET" | "PATCH" | "POST",
  path: string,
  body: Record<string, unknown> | null = null,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/admin", walletRouter);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const data = body ? JSON.stringify(body) : "";
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: `/admin${path}`,
          method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data).toString(),
            Authorization: "Bearer dummy",
          },
        },
        (res) => {
          let buf = "";
          res.on("data", (c) => (buf += c));
          res.on("end", () => {
            server.close();
            try {
              resolve({
                status: res.statusCode ?? 0,
                body: buf ? JSON.parse(buf) : {},
              });
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on("error", (e) => {
        server.close();
        reject(e);
      });
      if (data) req.write(data);
      req.end();
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /admin/wallets/:userId", () => {
  it("retourne snapshot + transactions paginees + pending bets", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u-1",
      email: "u@u",
      coachName: "Coach",
    });
    mockedPrisma.proWallet.findUnique.mockResolvedValueOnce({
      crowns: 1234,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-05-01"),
    });
    mockedPrisma.proTransaction.findMany.mockResolvedValueOnce([
      {
        id: "tx-1",
        type: "WIN",
        amount: 500,
        ref: "bet-x",
        createdAt: new Date("2026-05-01"),
      },
    ]);
    mockedPrisma.proTransaction.count.mockResolvedValueOnce(42);
    mockedPrisma.proBet.findMany.mockResolvedValueOnce([
      {
        id: "bet-pending-1",
        marketId: "m-1",
        selection: "home",
        stake: 100,
        oddsAtPlace: 2.0,
        status: "pending",
        createdAt: new Date("2026-05-01"),
      },
    ]);

    const res = await request("GET", "/wallets/u-1");

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: "u-1", email: "u@u", coachName: "Coach" });
    expect(res.body.wallet.crowns).toBe(1234);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0].type).toBe("WIN");
    expect(res.body.pagination.total).toBe(42);
    expect(res.body.pagination.totalPages).toBe(1); // limit defaut 50, 42/50 ⇒ 1 page
    expect(res.body.pendingBets).toHaveLength(1);
  });

  it("404 si user inexistant", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await request("GET", "/wallets/ghost");
    expect(res.status).toBe(404);
  });

  it("cap la limit a 100 et la page a 1 min", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u",
      email: "x",
      coachName: "x",
    });
    mockedPrisma.proWallet.findUnique.mockResolvedValueOnce({
      crowns: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockedPrisma.proTransaction.findMany.mockResolvedValueOnce([]);
    mockedPrisma.proTransaction.count.mockResolvedValueOnce(0);
    mockedPrisma.proBet.findMany.mockResolvedValueOnce([]);

    await request("GET", "/wallets/u?limit=9999&page=-5");

    const findManyCall = mockedPrisma.proTransaction.findMany.mock.calls[0]![0];
    expect(findManyCall.take).toBe(100);
    expect(findManyCall.skip).toBe(0); // page=1 (clampe), skip=(1-1)*100
  });

  it("solde 0 si pas de wallet", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: "u",
      email: "x",
      coachName: "x",
    });
    mockedPrisma.proWallet.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.proTransaction.findMany.mockResolvedValueOnce([]);
    mockedPrisma.proTransaction.count.mockResolvedValueOnce(0);
    mockedPrisma.proBet.findMany.mockResolvedValueOnce([]);

    const res = await request("GET", "/wallets/u");
    expect(res.status).toBe(200);
    expect(res.body.wallet.crowns).toBe(0);
  });
});

describe("PATCH /admin/wallets/:userId/balance", () => {
  beforeEach(() => {
    mockedPrisma.user.findUnique.mockResolvedValue({ id: "u-99" });
    mockedPrisma.proWallet.findUnique.mockResolvedValue({ crowns: 500 });
  });

  it("delta > 0 ⇒ credit, retourne nouveau solde + audit", async () => {
    credit.mockResolvedValueOnce(700);

    const res = await request("PATCH", "/wallets/u-99/balance", {
      delta: 200,
      reason: "Compensation bug spectator",
    });

    expect(res.status).toBe(200);
    expect(res.body.wallet.crowns).toBe(700);
    expect(res.body.previousBalance).toBe(500);
    expect(credit).toHaveBeenCalledWith(
      "u-99",
      200,
      "ADMIN_ADJUST",
      "Compensation bug spectator",
    );
    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({
        action: "wallet.adjust",
        entity: "ProWallet",
        entityId: "u-99",
        oldValue: { crowns: 500 },
        newValue: expect.objectContaining({ crowns: 700, delta: 200 }),
      }),
    );
  });

  it("delta < 0 ⇒ debit, retourne nouveau solde", async () => {
    debit.mockResolvedValueOnce(300);

    const res = await request("PATCH", "/wallets/u-99/balance", {
      delta: -200,
      reason: "Correction farming bot",
    });

    expect(res.status).toBe(200);
    expect(res.body.wallet.crowns).toBe(300);
    expect(debit).toHaveBeenCalledWith("u-99", 200, "ADMIN_ADJUST", "Correction farming bot");
  });

  it("delta = 0 refuse 400 (Zod)", async () => {
    const res = await request("PATCH", "/wallets/u-99/balance", {
      delta: 0,
      reason: "test zero",
    });
    expect(res.status).toBe(400);
    expect(credit).not.toHaveBeenCalled();
    expect(debit).not.toHaveBeenCalled();
  });

  it("delta hors bornes (|delta| > 10M) refuse 400", async () => {
    const res = await request("PATCH", "/wallets/u-99/balance", {
      delta: 20_000_000,
      reason: "test out of bounds",
    });
    expect(res.status).toBe(400);
  });

  it("debit avec solde insuffisant ⇒ 422", async () => {
    debit.mockRejectedValueOnce(new InsufficientFundsError(50, 200));

    const res = await request("PATCH", "/wallets/u-99/balance", {
      delta: -200,
      reason: "trop",
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/insuffisant/i);
  });

  it("refuse de s'ajuster soi-meme (400)", async () => {
    const res = await request("PATCH", "/wallets/admin-1/balance", {
      delta: 100,
      reason: "auto-credit",
    });
    expect(res.status).toBe(400);
    expect(credit).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("404 si user inexistant", async () => {
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    const res = await request("PATCH", "/wallets/ghost/balance", {
      delta: 100,
      reason: "ghost ?",
    });
    expect(res.status).toBe(404);
  });

  it("raison trop courte refuse 400", async () => {
    const res = await request("PATCH", "/wallets/u-99/balance", {
      delta: 50,
      reason: "ok",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /admin/bets/:betId/refund", () => {
  it("refund un bet pending : void + credit + audit", async () => {
    mockedPrisma.proBet.findUnique.mockResolvedValueOnce({
      id: "bet-pending",
      userId: "u-1",
      stake: 100,
      status: "pending",
      marketId: "m-1",
    });
    // Audit round 7 : creditInTx remplace credit dans la $transaction.
    const { creditInTx: creditInTxMock } = await import("../services/pro-wallet");
    vi.mocked(creditInTxMock).mockResolvedValueOnce(1100);

    const res = await request("POST", "/bets/bet-pending/refund", {
      reason: "double-event-bug",
    });

    expect(res.status).toBe(200);
    expect(res.body.bet.status).toBe("void");
    expect(res.body.refundedStake).toBe(100);
    expect(res.body.newBalance).toBe(1100);
    expect(res.body.wasPostSettlement).toBe(false);
    expect(creditInTxMock).toHaveBeenCalledWith(
      expect.anything(),
      "u-1",
      100,
      "ADMIN_REFUND",
      "bet-pending",
    );
    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({
        action: "bet.refund",
        entity: "ProBet",
        entityId: "bet-pending",
        newValue: expect.objectContaining({
          status: "void",
          refundedStake: 100,
          wasPostSettlement: false,
        }),
      }),
    );
  });

  it("refund un bet `won` post-settlement : flag wasPostSettlement=true", async () => {
    mockedPrisma.proBet.findUnique.mockResolvedValueOnce({
      id: "bet-won",
      userId: "u-2",
      stake: 50,
      status: "won",
      marketId: "m-2",
    });
    credit.mockResolvedValueOnce(2050);

    const res = await request("POST", "/bets/bet-won/refund", {
      reason: "settlement bug detected post-fact",
    });

    expect(res.status).toBe(200);
    expect(res.body.wasPostSettlement).toBe(true);
  });

  it("refuse refund d'un bet deja void (409)", async () => {
    mockedPrisma.proBet.findUnique.mockResolvedValueOnce({
      id: "bet-void",
      userId: "u-3",
      stake: 100,
      status: "void",
      marketId: "m-3",
    });

    const res = await request("POST", "/bets/bet-void/refund", {
      reason: "double-refund attempt",
    });

    expect(res.status).toBe(409);
    expect(credit).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("404 si bet inexistant", async () => {
    mockedPrisma.proBet.findUnique.mockResolvedValueOnce(null);
    const res = await request("POST", "/bets/ghost/refund", {
      reason: "any reason here",
    });
    expect(res.status).toBe(404);
  });

  it("raison trop courte refuse 400", async () => {
    const res = await request("POST", "/bets/b/refund", { reason: "ab" });
    expect(res.status).toBe(400);
  });
});
