import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    kofiTransaction: { findUnique: vi.fn(), create: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import type { Request, Response } from "express";
import { prisma } from "../prisma";
import { handleKofiWebhook, mergeCurrencyTotals } from "./kofi";
import { KOFI_VERIFICATION_TOKEN } from "../config";

const mockPrisma = prisma as unknown as {
  kofiTransaction: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  user: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

function createRes() {
  const res: Partial<Response> & {
    statusCode?: number;
    payload?: unknown;
  } = {};
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = vi.fn().mockImplementation((body: unknown) => {
    res.payload = body;
    return res as Response;
  });
  return res as Response & { statusCode?: number; payload?: unknown };
}

const validPayload = {
  verification_token: KOFI_VERIFICATION_TOKEN,
  message_id: "msg-1",
  timestamp: "2026-04-22T10:00:00Z",
  type: "Donation",
  is_public: true,
  from_name: "Jane",
  message: "Thanks!",
  amount: "5.00",
  url: "https://ko-fi.com/tx/1",
  email: "jane@example.com",
  currency: "EUR",
  is_subscription_payment: false,
  is_first_subscription_payment: false,
  kofi_transaction_id: "tx-1",
};

function makeReq(body: unknown): Request {
  return { body } as Request;
}

describe("Rule: POST /webhooks/kofi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    );
  });

  it("rejects a payload with a bad verification token", async () => {
    const req = makeReq({ ...validPayload, verification_token: "wrong" });
    const res = createRes();
    await handleKofiWebhook(req, res);
    expect(res.statusCode).toBe(401);
    expect(mockPrisma.kofiTransaction.create).not.toHaveBeenCalled();
  });

  it("rejects a payload that fails zod validation", async () => {
    const req = makeReq({ nothing: "here" });
    const res = createRes();
    await handleKofiWebhook(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("accepts a payload wrapped in a `data` form field (string JSON)", async () => {
    mockPrisma.kofiTransaction.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.kofiTransaction.create.mockResolvedValue({});

    const req = makeReq({ data: JSON.stringify(validPayload) });
    const res = createRes();
    await handleKofiWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.kofiTransaction.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("is idempotent on duplicate kofi_transaction_id", async () => {
    mockPrisma.kofiTransaction.findUnique.mockResolvedValue({ id: "existing" });

    const req = makeReq(validPayload);
    const res = createRes();
    await handleKofiWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ status: "duplicate" });
    expect(mockPrisma.kofiTransaction.create).not.toHaveBeenCalled();
  });

  it("stores a donation as orphan when no user matches", async () => {
    mockPrisma.kofiTransaction.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.kofiTransaction.create.mockResolvedValue({});

    const req = makeReq(validPayload);
    const res = createRes();
    await handleKofiWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ matched: false });
    const createCall = mockPrisma.kofiTransaction.create.mock.calls[0]?.[0] as {
      data: { userId: string | null; matchedVia: string | null };
    };
    expect(createCall.data.userId).toBeNull();
    expect(createCall.data.matchedVia).toBeNull();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("matches by email and adds amount to per-currency map", async () => {
    mockPrisma.kofiTransaction.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        email: "jane@example.com",
        kofiLinkCode: null,
        discordUserId: null,
      },
    ]);
    mockPrisma.user.findUnique.mockResolvedValue({
      totalDonatedCentsByCurrency: { EUR: 200 },
    });
    mockPrisma.kofiTransaction.create.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    const req = makeReq(validPayload);
    const res = createRes();
    await handleKofiWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      matched: true,
      matchedVia: "email",
    });

    const createArg = mockPrisma.kofiTransaction.create.mock.calls[0]?.[0] as {
      data: {
        userId: string;
        matchedVia: string;
        amountCents: number;
        kofiTimestamp: Date | null;
      };
    };
    expect(createArg.data.userId).toBe("user-1");
    expect(createArg.data.matchedVia).toBe("email");
    expect(createArg.data.amountCents).toBe(500);
    expect(createArg.data.kofiTimestamp).toBeInstanceOf(Date);

    const updateArg = mockPrisma.user.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { totalDonatedCentsByCurrency: Record<string, number> };
    };
    expect(updateArg.where.id).toBe("user-1");
    // Devise EUR existante (200) + nouveau don EUR (500) = 700.
    expect(updateArg.data.totalDonatedCentsByCurrency).toEqual({ EUR: 700 });
  });

  it("keeps currencies separate when a USD donation arrives on top of EUR", async () => {
    mockPrisma.kofiTransaction.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        email: "jane@example.com",
        kofiLinkCode: null,
        discordUserId: null,
      },
    ]);
    mockPrisma.user.findUnique.mockResolvedValue({
      totalDonatedCentsByCurrency: { EUR: 1000 },
    });
    mockPrisma.kofiTransaction.create.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    const req = makeReq({ ...validPayload, currency: "USD", amount: "3.00" });
    const res = createRes();
    await handleKofiWebhook(req, res);

    const updateArg = mockPrisma.user.update.mock.calls[0]?.[0] as {
      data: { totalDonatedCentsByCurrency: Record<string, number> };
    };
    expect(updateArg.data.totalDonatedCentsByCurrency).toEqual({
      EUR: 1000,
      USD: 300,
    });
  });

  it("matches by discord_userid as third strategy", async () => {
    mockPrisma.kofiTransaction.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "user-9",
        email: "other@example.com",
        kofiLinkCode: null,
        discordUserId: "012345678901234567",
      },
    ]);
    mockPrisma.user.findUnique.mockResolvedValue({
      totalDonatedCentsByCurrency: null,
    });
    mockPrisma.kofiTransaction.create.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    const req = makeReq({
      ...validPayload,
      message: "thanks!",
      email: "stranger@example.com",
      discord_userid: "012345678901234567",
      discord_username: "Jo#4105",
    });
    const res = createRes();
    await handleKofiWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      matched: true,
      matchedVia: "discord",
    });

    const createArg = mockPrisma.kofiTransaction.create.mock.calls[0]?.[0] as {
      data: { discordUserId: string | null };
    };
    expect(createArg.data.discordUserId).toBe("012345678901234567");
  });

  it("matches by code even when email does not match any user", async () => {
    mockPrisma.kofiTransaction.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "user-7",
        email: "other@example.com",
        kofiLinkCode: "KFI-AB12CD",
        discordUserId: null,
      },
    ]);
    mockPrisma.user.findUnique.mockResolvedValue({
      totalDonatedCentsByCurrency: {},
    });
    mockPrisma.kofiTransaction.create.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    const req = makeReq({
      ...validPayload,
      message: "cheers KFI-AB12CD",
      email: "paypal-alias@example.com",
    });
    const res = createRes();
    await handleKofiWebhook(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      matched: true,
      matchedVia: "code",
    });
    const updateArg = mockPrisma.user.update.mock.calls[0]?.[0] as {
      where: { id: string };
    };
    expect(updateArg.where.id).toBe("user-7");
  });

  it("sets supporterTier and supporterActiveUntil on a subscription payment", async () => {
    mockPrisma.kofiTransaction.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        email: "jane@example.com",
        kofiLinkCode: null,
        discordUserId: null,
      },
    ]);
    mockPrisma.user.findUnique.mockResolvedValue({
      totalDonatedCentsByCurrency: {},
    });
    mockPrisma.kofiTransaction.create.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});

    const req = makeReq({
      ...validPayload,
      type: "Subscription",
      is_subscription_payment: true,
      is_first_subscription_payment: true,
      tier_name: "Gold Member",
      amount: "10.00",
    });
    const res = createRes();
    await handleKofiWebhook(req, res);

    expect(res.statusCode).toBe(200);
    const updateArg = mockPrisma.user.update.mock.calls[0]?.[0] as {
      data: {
        supporterTier?: string;
        supporterActiveUntil?: Date;
        totalDonatedCentsByCurrency: Record<string, number>;
      };
    };
    expect(updateArg.data.supporterTier).toBe("Gold Member");
    expect(updateArg.data.supporterActiveUntil).toBeInstanceOf(Date);
    expect(updateArg.data.totalDonatedCentsByCurrency).toEqual({ EUR: 1000 });
  });

  describe("mergeCurrencyTotals", () => {
    it("creates a new entry when currency was absent", () => {
      const result = mergeCurrencyTotals({ EUR: 100 }, "USD", 250, false);
      expect(result).toEqual({ EUR: 100, USD: 250 });
    });

    it("increments an existing entry", () => {
      const result = mergeCurrencyTotals({ EUR: 100 }, "EUR", 250, false);
      expect(result).toEqual({ EUR: 350 });
    });

    it("treats null/undefined as empty map", () => {
      expect(mergeCurrencyTotals(null, "USD", 100, false)).toEqual({ USD: 100 });
      expect(mergeCurrencyTotals(undefined, "USD", 100, false)).toEqual({
        USD: 100,
      });
    });

    it("parses a JSON string when sqlite mode stored it stringified", () => {
      const result = mergeCurrencyTotals(
        JSON.stringify({ EUR: 50 }),
        "EUR",
        25,
        true,
      );
      expect(result).toBe(JSON.stringify({ EUR: 75 }));
    });

    it("treats malformed JSON string as empty map (no crash)", () => {
      const result = mergeCurrencyTotals("not-json", "USD", 100, false);
      expect(result).toEqual({ USD: 100 });
    });
  });
});
