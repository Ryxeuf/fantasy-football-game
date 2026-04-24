import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    kofiTransaction: { findMany: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../prisma";
import {
  claimOrphanKofiTransactions,
  ensureKofiLinkCode,
} from "./kofi-claim";

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  kofiTransaction: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe("Rule: kofi claim service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
  });

  describe("ensureKofiLinkCode", () => {
    it("returns the existing code when user already has one", async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        kofiLinkCode: "KFI-AB12CD",
      });

      const result = await ensureKofiLinkCode("user-1");

      expect(result).toBe("KFI-AB12CD");
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("generates and persists a new code when none exists", async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ kofiLinkCode: null }) // initial check
        .mockResolvedValueOnce(null); // clash check
      mockPrisma.user.update.mockResolvedValue({});

      const result = await ensureKofiLinkCode("user-1");

      expect(result).toMatch(/^KFI-[0-9A-HJKMNP-TV-Z]{6}$/);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { kofiLinkCode: result },
      });
    });
  });

  describe("claimOrphanKofiTransactions", () => {
    it("does nothing when email is empty", async () => {
      const result = await claimOrphanKofiTransactions("user-1", "");
      expect(result).toEqual({ claimed: 0 });
      expect(mockPrisma.kofiTransaction.findMany).not.toHaveBeenCalled();
    });

    it("returns 0 when no orphan transactions match the email", async () => {
      mockPrisma.kofiTransaction.findMany.mockResolvedValueOnce([]);

      const result = await claimOrphanKofiTransactions(
        "user-1",
        "jane@example.com",
      );

      expect(result).toEqual({ claimed: 0 });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("attaches orphans and recomputes the supporter aggregate by currency", async () => {
      mockPrisma.kofiTransaction.findMany
        .mockResolvedValueOnce([{ id: "tx-1" }, { id: "tx-2" }])
        .mockResolvedValueOnce([
          {
            isSubscriptionPayment: true,
            tierName: "Gold Member",
            amountCents: 1000,
            currency: "USD",
            receivedAt: new Date(),
          },
          {
            isSubscriptionPayment: false,
            tierName: null,
            amountCents: 300,
            currency: "EUR",
            receivedAt: new Date(),
          },
        ]);
      mockPrisma.kofiTransaction.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await claimOrphanKofiTransactions(
        "user-1",
        "jane@example.com",
      );

      expect(result).toEqual({ claimed: 2 });
      expect(mockPrisma.kofiTransaction.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["tx-1", "tx-2"] } },
        data: { userId: "user-1", matchedVia: "email" },
      });

      const updateArg = mockPrisma.user.update.mock.calls[0]?.[0] as {
        data: {
          supporterTier: string | null;
          supporterActiveUntil: Date | null;
          totalDonatedCentsByCurrency: Record<string, number>;
        };
      };
      expect(updateArg.data.supporterTier).toBe("Gold Member");
      expect(updateArg.data.supporterActiveUntil).toBeInstanceOf(Date);
      expect(updateArg.data.totalDonatedCentsByCurrency).toEqual({
        USD: 1000,
        EUR: 300,
      });
    });

    it("lowercases the email for orphan lookup", async () => {
      mockPrisma.kofiTransaction.findMany.mockResolvedValueOnce([]);

      await claimOrphanKofiTransactions("user-1", "  Jane@Example.COM  ");

      expect(mockPrisma.kofiTransaction.findMany).toHaveBeenCalledWith({
        where: { userId: null, email: "jane@example.com" },
        select: { id: true },
      });
    });
  });
});
