/**
 * Tests pour `getAnalyticsSnapshot` (Sprint P — Lot P.C.3).
 *
 * Strategy : mock prisma counts/aggregates et verifie la composition
 * des 4 metriques (DAU, MAU, signupFunnel, crowns) + le calcul du
 * delta% / conversion%.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: { count: vi.fn() },
    proTransaction: { aggregate: vi.fn() },
    proWallet: { aggregate: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import { getAnalyticsSnapshot } from "./admin-analytics";

interface MockedPrisma {
  user: { count: ReturnType<typeof vi.fn> };
  proTransaction: { aggregate: ReturnType<typeof vi.fn> };
  proWallet: { aggregate: ReturnType<typeof vi.fn> };
}

const mocked = prisma as unknown as MockedPrisma;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAnalyticsSnapshot — Lot P.C.3", () => {
  it("compose DAU/MAU/funnel/crowns avec deltas %", async () => {
    // 7 user.count calls in order : dau, dauPrev, mau, mauPrev,
    // signups, signupsWithTeam, signupsWithMatch
    mocked.user.count
      .mockResolvedValueOnce(150) // DAU
      .mockResolvedValueOnce(120) // DAU prev
      .mockResolvedValueOnce(800) // MAU
      .mockResolvedValueOnce(600) // MAU prev
      .mockResolvedValueOnce(200) // signups 30j
      .mockResolvedValueOnce(140) // withTeam
      .mockResolvedValueOnce(80); // withMatch
    mocked.proTransaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 50000 } }) // credits in
      .mockResolvedValueOnce({ _sum: { amount: -30000 } }); // debits out (signed neg)
    mocked.proWallet.aggregate.mockResolvedValueOnce({
      _sum: { crowns: 250000 },
    });

    const out = await getAnalyticsSnapshot(
      new Date("2026-05-11T10:00:00Z"),
    );

    expect(out.dau.count).toBe(150);
    expect(out.dau.prevCount).toBe(120);
    expect(out.dau.deltaPct).toBe(25.0); // (150-120)/120 = 25%

    expect(out.mau.count).toBe(800);
    expect(out.mau.deltaPct).toBeCloseTo(33.3, 1);

    expect(out.signupFunnel.signups).toBe(200);
    expect(out.signupFunnel.withTeam).toBe(140);
    expect(out.signupFunnel.withMatch).toBe(80);
    expect(out.signupFunnel.conversionTeam).toBe(70); // 140/200 = 70%
    expect(out.signupFunnel.conversionFirstMatch).toBe(40); // 80/200 = 40%

    expect(out.crowns.totalIn).toBe(50000);
    expect(out.crowns.totalOut).toBe(30000); // abs(-30000)
    expect(out.crowns.netInflation).toBe(20000);
    expect(out.crowns.currentSupply).toBe(250000);
  });

  it("gere 0 prev pour eviter division par zero", async () => {
    mocked.user.count
      .mockResolvedValueOnce(50) // DAU
      .mockResolvedValueOnce(0) // DAU prev = 0
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0) // signups = 0
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mocked.proTransaction.aggregate
      .mockResolvedValue({ _sum: { amount: 0 } });
    mocked.proWallet.aggregate.mockResolvedValue({ _sum: { crowns: 0 } });

    const out = await getAnalyticsSnapshot();
    expect(out.dau.deltaPct).toBe(100); // prev=0, current>0 → 100% growth
    expect(out.mau.deltaPct).toBe(100);
    expect(out.signupFunnel.conversionTeam).toBe(0); // signups=0 → 0%
    expect(out.signupFunnel.conversionFirstMatch).toBe(0);
  });

  it("gere null des sums (DB vide)", async () => {
    mocked.user.count.mockResolvedValue(0);
    mocked.proTransaction.aggregate
      .mockResolvedValue({ _sum: { amount: null } });
    mocked.proWallet.aggregate.mockResolvedValue({ _sum: { crowns: null } });

    const out = await getAnalyticsSnapshot();
    expect(out.crowns.totalIn).toBe(0);
    expect(out.crowns.totalOut).toBe(0);
    expect(out.crowns.netInflation).toBe(0);
    expect(out.crowns.currentSupply).toBe(0);
  });

  it("expose computedAt en ISO 8601", async () => {
    mocked.user.count.mockResolvedValue(0);
    mocked.proTransaction.aggregate.mockResolvedValue({
      _sum: { amount: 0 },
    });
    mocked.proWallet.aggregate.mockResolvedValue({ _sum: { crowns: 0 } });

    const at = new Date("2026-05-11T10:30:00Z");
    const out = await getAnalyticsSnapshot(at);
    expect(out.computedAt).toBe("2026-05-11T10:30:00.000Z");
  });

  it("appelle user.count avec lastLoginAt range pour DAU", async () => {
    mocked.user.count.mockResolvedValue(0);
    mocked.proTransaction.aggregate.mockResolvedValue({
      _sum: { amount: 0 },
    });
    mocked.proWallet.aggregate.mockResolvedValue({ _sum: { crowns: 0 } });

    const at = new Date("2026-05-11T10:00:00Z");
    await getAnalyticsSnapshot(at);

    const firstCall = mocked.user.count.mock.calls[0]![0];
    expect(firstCall.where.lastLoginAt).toBeDefined();
    expect(firstCall.where.lastLoginAt.gte).toBeInstanceOf(Date);
    // gte = 24h avant `at`
    const diff = at.getTime() - firstCall.where.lastLoginAt.gte.getTime();
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });

  it("filtre signups par createdAt + relations teams/matches", async () => {
    mocked.user.count.mockResolvedValue(0);
    mocked.proTransaction.aggregate.mockResolvedValue({
      _sum: { amount: 0 },
    });
    mocked.proWallet.aggregate.mockResolvedValue({ _sum: { crowns: 0 } });

    await getAnalyticsSnapshot();

    const signupCall = mocked.user.count.mock.calls[4]![0];
    expect(signupCall.where.createdAt.gte).toBeInstanceOf(Date);

    const teamCall = mocked.user.count.mock.calls[5]![0];
    expect(teamCall.where.teams).toEqual({ some: {} });

    const matchCall = mocked.user.count.mock.calls[6]![0];
    expect(matchCall.where.matches).toEqual({ some: {} });
  });
});
