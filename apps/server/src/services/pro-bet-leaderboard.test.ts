import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueSeason: { findFirst: vi.fn() },
    proBet: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  LeaderboardError,
  getBetLeaderboard,
} from "./pro-bet-leaderboard";

interface MockedPrisma {
  proLeagueSeason: { findFirst: ReturnType<typeof vi.fn> };
  proBet: { findMany: ReturnType<typeof vi.fn> };
  user: { findMany: ReturnType<typeof vi.fn> };
}
const mocked = prisma as unknown as MockedPrisma;

beforeEach(() => {
  vi.clearAllMocks();
  mocked.proLeagueSeason.findFirst.mockResolvedValue(null);
});

function bet(
  userId: string,
  status: "won" | "lost" | "pending",
  stake: number,
  payout: number | null,
  createdAt: Date,
) {
  return {
    id: `b_${userId}_${createdAt.getTime()}`,
    userId,
    stake,
    payoutAmount: payout,
    status,
    createdAt,
  };
}

describe("getBetLeaderboard — sprint 1.D.8", () => {
  it("rejette period invalide", async () => {
    await expect(
      // @ts-expect-error volontaire
      getBetLeaderboard({ period: "monthly" }),
    ).rejects.toThrow(LeaderboardError);
  });

  it("rejette limit/offset invalides", async () => {
    async function expectCode(p: Promise<unknown>, code: string) {
      try {
        await p;
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(LeaderboardError);
        expect((err as LeaderboardError).code).toBe(code);
      }
    }
    await expectCode(
      getBetLeaderboard({ period: "all-time", limit: 0 }),
      "INVALID_LIMIT",
    );
    await expectCode(
      getBetLeaderboard({ period: "all-time", limit: 1000 }),
      "INVALID_LIMIT",
    );
    await expectCode(
      getBetLeaderboard({ period: "all-time", offset: -1 }),
      "INVALID_OFFSET",
    );
  });

  it("renvoie [] si aucun bet", async () => {
    mocked.proBet.findMany.mockResolvedValue([]);
    const out = await getBetLeaderboard({ period: "all-time" });
    expect(out.entries).toEqual([]);
    expect(out.fromAt).toBeNull();
  });

  it("agrège profit + accuracy + streak + biggestWin", async () => {
    const t0 = new Date("2026-09-01T10:00:00Z");
    const t1 = new Date("2026-09-01T11:00:00Z");
    const t2 = new Date("2026-09-01T12:00:00Z");
    const t3 = new Date("2026-09-01T13:00:00Z");
    mocked.proBet.findMany.mockResolvedValue([
      // userA : won (100→250) → won (50→150) → lost 100 → won (200→500)
      // streak max = 2 (avant le lost), biggestWin = 300 (500-200)
      // profit = (250-100) + (150-50) - 100 + (500-200) = 150+100-100+300 = 450
      bet("userA", "won", 100, 250, t0),
      bet("userA", "won", 50, 150, t1),
      bet("userA", "lost", 100, 0, t2),
      bet("userA", "won", 200, 500, t3),
      // userB : lost 50 + won 100→150 → profit = -50 + 50 = 0, streak 1
      bet("userB", "lost", 50, 0, t0),
      bet("userB", "won", 100, 150, t1),
    ]);
    mocked.user.findMany.mockResolvedValue([
      { id: "userA", coachName: "Alice" },
      { id: "userB", coachName: "Bob" },
    ]);

    const out = await getBetLeaderboard({ period: "all-time" });
    expect(out.entries).toHaveLength(2);
    const a = out.entries.find((e) => e.userId === "userA");
    const b = out.entries.find((e) => e.userId === "userB");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a!.profit).toBe(450);
    expect(a!.wonCount).toBe(3);
    expect(a!.settledCount).toBe(4);
    expect(a!.accuracy).toBe(75); // 3/4 = 75%
    expect(a!.longestStreak).toBe(2);
    expect(a!.biggestWin).toBe(300);
    expect(a!.coachName).toBe("Alice");
    expect(a!.rank).toBe(1);

    expect(b!.profit).toBe(0);
    expect(b!.accuracy).toBe(50);
    expect(b!.rank).toBe(2);
  });

  it("trie par profit desc, accuracy desc, betsCount desc", async () => {
    mocked.proBet.findMany.mockResolvedValue([
      bet("u1", "won", 100, 200, new Date()),  // profit +100
      bet("u2", "won", 50, 200, new Date()),   // profit +150 ← top
      bet("u3", "lost", 50, 0, new Date()),    // profit -50
    ]);
    mocked.user.findMany.mockResolvedValue([
      { id: "u1", coachName: "U1" },
      { id: "u2", coachName: "U2" },
      { id: "u3", coachName: "U3" },
    ]);
    const out = await getBetLeaderboard({ period: "all-time" });
    expect(out.entries[0].userId).toBe("u2");
    expect(out.entries[1].userId).toBe("u1");
    expect(out.entries[2].userId).toBe("u3");
  });

  it("weekly filtre les bets > 7j", async () => {
    const now = new Date("2026-09-15T12:00:00Z");
    mocked.proBet.findMany.mockResolvedValue([]);
    await getBetLeaderboard({ period: "weekly", now });

    const where = mocked.proBet.findMany.mock.calls[0][0].where;
    const expectedFrom = new Date("2026-09-08T12:00:00Z");
    expect(where.createdAt.gte).toEqual(expectedFrom);
  });

  it("season utilise startsAt de la saison in_progress", async () => {
    const seasonStart = new Date("2026-09-01T00:00:00Z");
    mocked.proLeagueSeason.findFirst.mockResolvedValueOnce({
      startsAt: seasonStart,
      createdAt: new Date(),
    });
    mocked.proBet.findMany.mockResolvedValue([]);

    const out = await getBetLeaderboard({ period: "season" });
    expect(out.fromAt).toBe(seasonStart.toISOString());
    const where = mocked.proBet.findMany.mock.calls[0][0].where;
    expect(where.createdAt.gte).toEqual(seasonStart);
  });

  it("all-time : pas de filtre createdAt", async () => {
    mocked.proBet.findMany.mockResolvedValue([]);
    await getBetLeaderboard({ period: "all-time" });
    const where = mocked.proBet.findMany.mock.calls[0][0].where;
    expect(where).toEqual({});
  });

  it("paginate avec offset+limit, rang absolu", async () => {
    const samples = [];
    for (let i = 0; i < 5; i += 1) {
      samples.push(
        bet(`u${i}`, "won", 100, 100 + 50 * (5 - i), new Date()),
      );
    }
    mocked.proBet.findMany.mockResolvedValue(samples);
    mocked.user.findMany.mockResolvedValue(
      samples.map((s) => ({ id: s.userId, coachName: s.userId.toUpperCase() })),
    );

    const out = await getBetLeaderboard({
      period: "all-time",
      offset: 2,
      limit: 2,
    });
    expect(out.entries).toHaveLength(2);
    expect(out.entries[0].rank).toBe(3);
    expect(out.entries[1].rank).toBe(4);
  });
});
