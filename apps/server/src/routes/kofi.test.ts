import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    kofiTransaction: { findUnique: vi.fn(), create: vi.fn() },
    user: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import type { Request, Response } from "express";
import { prisma } from "../prisma";
import { handleKofiWebhook } from "./kofi";
import { KOFI_VERIFICATION_TOKEN } from "../config";

const mockPrisma = prisma as unknown as {
  kofiTransaction: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  user: {
    findMany: ReturnType<typeof vi.fn>;
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

  it("matches by email and increments total donated cents", async () => {
    mockPrisma.kofiTransaction.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user-1", email: "jane@example.com", kofiLinkCode: null },
    ]);
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
      data: { userId: string; matchedVia: string; amountCents: number };
    };
    expect(createArg.data.userId).toBe("user-1");
    expect(createArg.data.matchedVia).toBe("email");
    expect(createArg.data.amountCents).toBe(500);

    const updateArg = mockPrisma.user.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { totalDonatedCents: { increment: number } };
    };
    expect(updateArg.where.id).toBe("user-1");
    expect(updateArg.data.totalDonatedCents).toEqual({ increment: 500 });
  });

  it("matches by code even when email does not match any user", async () => {
    mockPrisma.kofiTransaction.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user-7", email: "other@example.com", kofiLinkCode: "KFI-AB12CD" },
    ]);
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
      { id: "user-1", email: "jane@example.com", kofiLinkCode: null },
    ]);
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
        totalDonatedCents: { increment: number };
      };
    };
    expect(updateArg.data.supporterTier).toBe("Gold Member");
    expect(updateArg.data.supporterActiveUntil).toBeInstanceOf(Date);
    expect(updateArg.data.totalDonatedCents).toEqual({ increment: 1000 });
  });
});
