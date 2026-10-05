import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueSeason: { findFirst: vi.fn() },
    proLeagueMatch: { findFirst: vi.fn() },
    proGazetteArticle: { findFirst: vi.fn() },
    proBetMarket: { count: vi.fn() },
  },
}));

// Lot 5 — les deux checks d'exploitation sont testés à part ; ici ils
// répondent « up » pour ne pas changer le statut global des cas historiques.
vi.mock("./pro-league-match-completion", () => ({
  countStaleLiveMatches: vi.fn(async () => 0),
}));
vi.mock("./pro-league-sim-pool", () => ({
  getSimPoolStats: vi.fn(() => ({
    mode: "inline",
    size: 0,
    busy: 0,
    queued: 0,
    completed: 0,
    failed: 0,
    respawned: 0,
  })),
}));

import { prisma } from "../prisma";
import { countStaleLiveMatches } from "./pro-league-match-completion";
import { checkSimPool, getProLeagueHealth } from "./pro-league-health";

interface MockedPrisma {
  proLeagueSeason: { findFirst: ReturnType<typeof vi.fn> };
  proLeagueMatch: { findFirst: ReturnType<typeof vi.fn> };
  proGazetteArticle: { findFirst: ReturnType<typeof vi.fn> };
  proBetMarket: { count: ReturnType<typeof vi.fn> };
}
const mocked = prisma as unknown as MockedPrisma;

const NOW = new Date("2026-05-07T12:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function recentDate(hoursAgo: number): Date {
  return new Date(NOW.getTime() - hoursAgo * 60 * 60 * 1000);
}

describe("getProLeagueHealth — sprint 1.F.2", () => {
  it("status global up si tous les checks sont up", async () => {
    mocked.proLeagueSeason.findFirst.mockResolvedValue({ id: "s1", year: 2026 });
    mocked.proLeagueMatch.findFirst.mockResolvedValue({
      completedAt: recentDate(2),
    });
    mocked.proGazetteArticle.findFirst.mockResolvedValue({
      date: recentDate(4),
    });
    mocked.proBetMarket.count.mockResolvedValue(3);

    const out = await getProLeagueHealth();
    expect(out.status).toBe("up");
    const byName = new Map(out.checks.map((c) => [c.name, c]));
    expect(byName.get("season")?.status).toBe("up");
    expect(byName.get("simRunner")?.status).toBe("up");
    expect(byName.get("gazette")?.status).toBe("up");
    expect(byName.get("bettingMarkets")?.status).toBe("up");
    expect(out.checkedAt).toBe(NOW.toISOString());
  });

  it("season degraded si pas de saison in_progress", async () => {
    mocked.proLeagueSeason.findFirst.mockResolvedValue(null);
    mocked.proLeagueMatch.findFirst.mockResolvedValue({
      completedAt: recentDate(2),
    });
    mocked.proGazetteArticle.findFirst.mockResolvedValue({
      date: recentDate(2),
    });
    mocked.proBetMarket.count.mockResolvedValue(1);

    const out = await getProLeagueHealth();
    expect(out.status).toBe("degraded");
    expect(
      out.checks.find((c) => c.name === "season")?.status,
    ).toBe("degraded");
  });

  it("simRunner degraded si dernier match > 24h", async () => {
    mocked.proLeagueSeason.findFirst.mockResolvedValue({ id: "s1", year: 2026 });
    mocked.proLeagueMatch.findFirst.mockResolvedValue({
      completedAt: recentDate(48),
    });
    mocked.proGazetteArticle.findFirst.mockResolvedValue({
      date: recentDate(2),
    });
    mocked.proBetMarket.count.mockResolvedValue(1);

    const out = await getProLeagueHealth();
    expect(out.status).toBe("degraded");
    const sim = out.checks.find((c) => c.name === "simRunner");
    expect(sim?.status).toBe("degraded");
    expect(sim?.detail).toContain("48h ago");
  });

  it("simRunner degraded si pas encore de match", async () => {
    mocked.proLeagueSeason.findFirst.mockResolvedValue({ id: "s1", year: 2026 });
    mocked.proLeagueMatch.findFirst.mockResolvedValue(null);
    mocked.proGazetteArticle.findFirst.mockResolvedValue({
      date: recentDate(2),
    });
    mocked.proBetMarket.count.mockResolvedValue(1);

    const out = await getProLeagueHealth();
    expect(out.checks.find((c) => c.name === "simRunner")?.status).toBe(
      "degraded",
    );
  });

  it("gazette degraded si > 48h", async () => {
    mocked.proLeagueSeason.findFirst.mockResolvedValue({ id: "s1", year: 2026 });
    mocked.proLeagueMatch.findFirst.mockResolvedValue({
      completedAt: recentDate(2),
    });
    mocked.proGazetteArticle.findFirst.mockResolvedValue({
      date: recentDate(72),
    });
    mocked.proBetMarket.count.mockResolvedValue(1);

    const out = await getProLeagueHealth();
    expect(out.checks.find((c) => c.name === "gazette")?.status).toBe(
      "degraded",
    );
  });

  it("bettingMarkets degraded si 0 open", async () => {
    mocked.proLeagueSeason.findFirst.mockResolvedValue({ id: "s1", year: 2026 });
    mocked.proLeagueMatch.findFirst.mockResolvedValue({
      completedAt: recentDate(2),
    });
    mocked.proGazetteArticle.findFirst.mockResolvedValue({
      date: recentDate(2),
    });
    mocked.proBetMarket.count.mockResolvedValue(0);

    const out = await getProLeagueHealth();
    expect(out.checks.find((c) => c.name === "bettingMarkets")?.status).toBe(
      "degraded",
    );
  });

  it("season down si la query throw -> status global down", async () => {
    mocked.proLeagueSeason.findFirst.mockRejectedValue(new Error("DB closed"));
    mocked.proLeagueMatch.findFirst.mockResolvedValue({
      completedAt: recentDate(2),
    });
    mocked.proGazetteArticle.findFirst.mockResolvedValue({
      date: recentDate(2),
    });
    mocked.proBetMarket.count.mockResolvedValue(1);

    const out = await getProLeagueHealth();
    expect(out.status).toBe("down");
    const season = out.checks.find((c) => c.name === "season");
    expect(season?.status).toBe("down");
    expect(season?.detail).toContain("DB closed");
  });

  it("worstStatus: down domine degraded", async () => {
    mocked.proLeagueSeason.findFirst.mockResolvedValue({ id: "s1", year: 2026 });
    mocked.proLeagueMatch.findFirst.mockResolvedValue({
      completedAt: recentDate(48), // degraded
    });
    mocked.proGazetteArticle.findFirst.mockRejectedValue(new Error("nope")); // down
    mocked.proBetMarket.count.mockResolvedValue(0); // degraded

    const out = await getProLeagueHealth();
    expect(out.status).toBe("down");
  });

  it("checks executes en parallele (Promise.all)", async () => {
    const order: string[] = [];
    mocked.proLeagueSeason.findFirst.mockImplementation(async () => {
      order.push("season");
      return { id: "s1", year: 2026 };
    });
    mocked.proLeagueMatch.findFirst.mockImplementation(async () => {
      order.push("match");
      return { completedAt: recentDate(1) };
    });
    mocked.proGazetteArticle.findFirst.mockImplementation(async () => {
      order.push("gazette");
      return { date: recentDate(1) };
    });
    mocked.proBetMarket.count.mockImplementation(async () => {
      order.push("market");
      return 1;
    });

    await getProLeagueHealth();
    expect(order).toHaveLength(4);
  });
});

describe("checks d'exploitation (lot 5)", () => {
  it("simPool : up en inline, up/degraded/down selon le pool", () => {
    expect(checkSimPool({ mode: "inline", size: 0, busy: 0, queued: 0, completed: 0, failed: 0, respawned: 0 }).status).toBe("up");
    const base = { mode: "pool" as const, size: 2, busy: 2, completed: 10, failed: 0, respawned: 0 };
    expect(checkSimPool({ ...base, queued: 10 }).status).toBe("up");
    expect(checkSimPool({ ...base, queued: 51 }).status).toBe("degraded");
    expect(checkSimPool({ ...base, queued: 0, respawned: 1 }).status).toBe("degraded");
    expect(checkSimPool({ ...base, size: 0, queued: 0 }).status).toBe("down");
  });

  it("liveCompletion : degraded quand un match en direct attend sa clôture depuis plus de 3h", async () => {
    mocked.proLeagueSeason.findFirst.mockResolvedValue({ id: "s", year: 2026 });
    mocked.proLeagueMatch.findFirst.mockResolvedValue({ completedAt: recentDate(1) });
    mocked.proGazetteArticle.findFirst.mockResolvedValue({ date: recentDate(1) });
    mocked.proBetMarket.count.mockResolvedValue(1);
    vi.mocked(countStaleLiveMatches).mockResolvedValueOnce(2);
    const out = await getProLeagueHealth();
    const check = out.checks.find((c) => c.name === "liveCompletion");
    expect(check?.status).toBe("degraded");
    expect(check?.detail).toContain("2 match(s)");
    expect(out.status).toBe("degraded");
    expect(out.checks.find((c) => c.name === "simPool")?.status).toBe("up");
  });
});
