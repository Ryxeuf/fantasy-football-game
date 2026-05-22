import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflWeek: { findFirst: vi.fn(), findMany: vi.fn() },
    nflFantasyLeague: { findMany: vi.fn() },
    nflFantasyDraftSession: { findMany: vi.fn() },
  },
}));

vi.mock("./nfl-ingest", () => ({ ingestNflverseWeek: vi.fn() }));
vi.mock("./nfl-ingest-espn", () => ({ ingestEspnGameday: vi.fn() }));
vi.mock("./nfl-fantasy-lineup", () => ({ lockLineups: vi.fn() }));
vi.mock("./nfl-fantasy-scoring", () => ({
  generateMatchups: vi.fn(),
  settleNflFantasyWeek: vi.fn(),
}));
vi.mock("./nfl-fantasy-draft-session", () => ({ resolveSession: vi.fn() }));

import { prisma } from "../prisma";
import { ingestNflverseWeek } from "./nfl-ingest";
import { ingestEspnGameday } from "./nfl-ingest-espn";
import { lockLineups } from "./nfl-fantasy-lineup";
import {
  generateMatchups,
  settleNflFantasyWeek,
} from "./nfl-fantasy-scoring";
import {
  currentSeasonId,
  dateYmd,
  espnGamedayTick,
  findCurrentNflWeek,
  findPreviousNflWeek,
  isLockLineupsWindow,
  isNflGameday,
  isNflverseDailyWindow,
  isSettleWindow,
  lockLineupsTick,
  nflFantasyOrchestratorTick,
  nflverseIngestTick,
  settleWeekTick,
} from "./nfl-fantasy-cron";

beforeEach(() => {
  vi.resetAllMocks();
});

// ────────────────────────────────────────────────────────────────────
// Helpers purs
// ────────────────────────────────────────────────────────────────────

describe("dateYmd", () => {
  it("format YYYYMMDD UTC", () => {
    expect(dateYmd(new Date("2025-11-09T18:30:00Z"))).toBe("20251109");
    expect(dateYmd(new Date("2026-01-05T00:00:00Z"))).toBe("20260105");
  });
});

describe("currentSeasonId", () => {
  it("octobre 2025 -> '2025'", () => {
    expect(currentSeasonId(new Date("2025-10-15T00:00:00Z"))).toBe("2025");
  });

  it("janvier 2026 -> '2025' (playoffs precedente)", () => {
    expect(currentSeasonId(new Date("2026-01-15T00:00:00Z"))).toBe("2025");
  });

  it("juin 2026 -> '2025' (off-season)", () => {
    expect(currentSeasonId(new Date("2026-06-15T00:00:00Z"))).toBe("2025");
  });

  it("juillet 2026 -> '2026' (preseason)", () => {
    expect(currentSeasonId(new Date("2026-07-01T00:00:00Z"))).toBe("2026");
  });
});

describe("isNflGameday", () => {
  it("true Thu (4), Fri (5), Sat (6), Sun (0), Mon (1)", () => {
    expect(isNflGameday(new Date("2025-11-09T18:00:00Z"))).toBe(true); // dim
    expect(isNflGameday(new Date("2025-11-10T18:00:00Z"))).toBe(true); // lun
    expect(isNflGameday(new Date("2025-11-13T18:00:00Z"))).toBe(true); // jeu
    expect(isNflGameday(new Date("2025-11-14T18:00:00Z"))).toBe(true); // ven
    expect(isNflGameday(new Date("2025-11-15T18:00:00Z"))).toBe(true); // sam
  });

  it("false mardi/mercredi", () => {
    expect(isNflGameday(new Date("2025-11-11T18:00:00Z"))).toBe(false); // mar
    expect(isNflGameday(new Date("2025-11-12T18:00:00Z"))).toBe(false); // mer
  });
});

describe("isLockLineupsWindow", () => {
  it("true dimanche 17:00-17:59 UTC", () => {
    expect(isLockLineupsWindow(new Date("2025-11-09T17:00:00Z"))).toBe(true);
    expect(isLockLineupsWindow(new Date("2025-11-09T17:30:00Z"))).toBe(true);
    expect(isLockLineupsWindow(new Date("2025-11-09T17:59:00Z"))).toBe(true);
  });

  it("false hors fenetre", () => {
    expect(isLockLineupsWindow(new Date("2025-11-09T16:59:00Z"))).toBe(false);
    expect(isLockLineupsWindow(new Date("2025-11-09T18:00:00Z"))).toBe(false);
    expect(isLockLineupsWindow(new Date("2025-11-10T17:00:00Z"))).toBe(false); // lun
  });
});

describe("isSettleWindow", () => {
  it("true mardi 12:00-12:59 UTC", () => {
    expect(isSettleWindow(new Date("2025-11-11T12:00:00Z"))).toBe(true);
    expect(isSettleWindow(new Date("2025-11-11T12:45:00Z"))).toBe(true);
  });

  it("false hors fenetre", () => {
    expect(isSettleWindow(new Date("2025-11-11T11:59:00Z"))).toBe(false);
    expect(isSettleWindow(new Date("2025-11-11T13:00:00Z"))).toBe(false);
    expect(isSettleWindow(new Date("2025-11-12T12:00:00Z"))).toBe(false); // mer
  });
});

describe("isNflverseDailyWindow", () => {
  it("true 03:00-03:59 UTC tous les jours", () => {
    expect(isNflverseDailyWindow(new Date("2025-11-09T03:00:00Z"))).toBe(true);
    expect(isNflverseDailyWindow(new Date("2025-11-11T03:30:00Z"))).toBe(true);
  });

  it("false hors fenetre", () => {
    expect(isNflverseDailyWindow(new Date("2025-11-09T02:59:00Z"))).toBe(false);
    expect(isNflverseDailyWindow(new Date("2025-11-09T04:00:00Z"))).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────
// findCurrent/Previous NflWeek
// ────────────────────────────────────────────────────────────────────

describe("findCurrentNflWeek", () => {
  it("retourne la derniere week avec startDate <= now (tri secondaire weekNumber desc)", async () => {
    vi.mocked(prisma.nflWeek.findFirst).mockResolvedValue({
      id: "2025:W10",
      seasonId: "2025",
      weekNumber: 10,
    } as never);

    const w = await findCurrentNflWeek(new Date("2025-11-09T18:00:00Z"));
    expect(w?.id).toBe("2025:W10");
    const args = vi.mocked(prisma.nflWeek.findFirst).mock.calls[0]?.[0];
    expect(args?.where).toMatchObject({
      seasonId: "2025",
      startDate: { lte: new Date("2025-11-09T18:00:00Z") },
    });
    expect(args?.orderBy).toEqual([
      { startDate: "desc" },
      { weekNumber: "desc" },
    ]);
  });
});

describe("findPreviousNflWeek", () => {
  it("retourne la 2e plus recente", async () => {
    vi.mocked(prisma.nflWeek.findMany).mockResolvedValue([
      { id: "2025:W10", seasonId: "2025", weekNumber: 10 },
      { id: "2025:W9", seasonId: "2025", weekNumber: 9 },
    ] as never);

    const w = await findPreviousNflWeek(new Date());
    expect(w?.id).toBe("2025:W9");
  });

  it("null si <2 weeks", async () => {
    vi.mocked(prisma.nflWeek.findMany).mockResolvedValue([
      { id: "2025:W1", seasonId: "2025", weekNumber: 1 },
    ] as never);

    expect(await findPreviousNflWeek(new Date())).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────
// Ticks (avec mock des services)
// ────────────────────────────────────────────────────────────────────

describe("nflverseIngestTick", () => {
  it("skip hors fenetre 03h UTC", async () => {
    const out = await nflverseIngestTick({
      now: new Date("2025-11-09T12:00:00Z"),
    });
    expect(out.ran).toBe(false);
    expect(out.reason).toBe("out_of_window");
    expect(ingestNflverseWeek).not.toHaveBeenCalled();
  });

  it("force=true bypass la fenetre", async () => {
    vi.mocked(prisma.nflWeek.findFirst).mockResolvedValue({
      id: "2025:W10",
      seasonId: "2025",
      weekNumber: 10,
    } as never);
    vi.mocked(ingestNflverseWeek).mockResolvedValue({
      playersUpdated: 100,
      statsUpdated: 100,
      gamesUpdated: 14,
      errors: [],
    } as never);

    const out = await nflverseIngestTick({
      now: new Date("2025-11-09T12:00:00Z"),
      force: true,
    });
    expect(out.ran).toBe(true);
    expect(ingestNflverseWeek).toHaveBeenCalledWith({
      seasonId: "2025",
      weekNumber: 10,
    });
  });

  it("skip si pas de week courante", async () => {
    vi.mocked(prisma.nflWeek.findFirst).mockResolvedValue(null);

    const out = await nflverseIngestTick({
      now: new Date("2025-11-09T03:30:00Z"),
    });
    expect(out.ran).toBe(false);
    expect(out.reason).toBe("no_current_week");
  });

  it("capture les erreurs ingest sans crasher", async () => {
    vi.mocked(prisma.nflWeek.findFirst).mockResolvedValue({
      id: "2025:W10",
      seasonId: "2025",
      weekNumber: 10,
    } as never);
    vi.mocked(ingestNflverseWeek).mockRejectedValue(new Error("network"));

    const out = await nflverseIngestTick({
      now: new Date("2025-11-09T03:00:00Z"),
    });
    expect(out.ran).toBe(true);
    expect(out.reason).toBe("ingest_failed");
  });
});

describe("espnGamedayTick", () => {
  it("skip hors jour NFL (mardi)", async () => {
    const out = await espnGamedayTick({
      now: new Date("2025-11-11T18:00:00Z"),
    });
    expect(out.ran).toBe(false);
    expect(out.reason).toBe("not_gameday");
  });

  it("appelle ingestEspnGameday avec dateYmd correct", async () => {
    vi.mocked(ingestEspnGameday).mockResolvedValue({
      source: "espn",
      dateYmd: "20251109",
      gamesUpdated: 12,
      gamesSkipped: 0,
      errors: [],
      ingestRunId: "run-1",
    } as never);

    await espnGamedayTick({ now: new Date("2025-11-09T18:00:00Z") });

    expect(ingestEspnGameday).toHaveBeenCalledWith({ dateYmd: "20251109" });
  });
});

describe("lockLineupsTick", () => {
  it("skip hors fenetre dimanche 17h", async () => {
    const out = await lockLineupsTick({
      now: new Date("2025-11-09T12:00:00Z"),
    });
    expect(out.ran).toBe(false);
    expect(lockLineups).not.toHaveBeenCalled();
  });

  it("appelle lockLineups dans la fenetre", async () => {
    vi.mocked(prisma.nflWeek.findFirst).mockResolvedValue({
      id: "2025:W10",
    } as never);
    vi.mocked(lockLineups).mockResolvedValue({ locked: 7 } as never);

    const out = await lockLineupsTick({
      now: new Date("2025-11-09T17:00:00Z"),
    });
    expect(out.ran).toBe(true);
    expect(lockLineups).toHaveBeenCalledWith("2025:W10");
    expect((out.detail as { locked: number }).locked).toBe(7);
  });
});

describe("settleWeekTick", () => {
  it("skip hors fenetre mardi 12h", async () => {
    const out = await settleWeekTick({
      now: new Date("2025-11-10T18:00:00Z"),
    });
    expect(out.ran).toBe(false);
    expect(settleNflFantasyWeek).not.toHaveBeenCalled();
  });

  it("genere + settle pour chaque league in_progress", async () => {
    vi.mocked(prisma.nflWeek.findMany).mockResolvedValue([
      { id: "2025:W11", seasonId: "2025", weekNumber: 11 },
      { id: "2025:W10", seasonId: "2025", weekNumber: 10 },
    ] as never);
    vi.mocked(prisma.nflFantasyLeague.findMany).mockResolvedValue([
      { id: "lg1" },
      { id: "lg2" },
    ] as never);
    vi.mocked(generateMatchups).mockResolvedValue({
      matchupsCreated: 0,
      matchupsExisting: 5,
      weekNumber: 10,
    } as never);
    vi.mocked(settleNflFantasyWeek).mockResolvedValue({
      matchupsSettled: 5,
      matchupsSkipped: 0,
      startersScored: 110,
    } as never);

    const out = await settleWeekTick({
      now: new Date("2025-11-11T12:00:00Z"),
    });

    expect(out.ran).toBe(true);
    expect(generateMatchups).toHaveBeenCalledTimes(2);
    expect(settleNflFantasyWeek).toHaveBeenCalledTimes(2);
    const detail = out.detail as { matchupsSettled: number; leaguesProcessed: number };
    expect(detail.leaguesProcessed).toBe(2);
    expect(detail.matchupsSettled).toBe(10);
  });

  it("isole les erreurs par league", async () => {
    vi.mocked(prisma.nflWeek.findMany).mockResolvedValue([
      { id: "2025:W11" },
      { id: "2025:W10", seasonId: "2025" },
    ] as never);
    vi.mocked(prisma.nflFantasyLeague.findMany).mockResolvedValue([
      { id: "lg1" },
      { id: "lg2" },
    ] as never);
    vi.mocked(generateMatchups)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error("boom"));
    vi.mocked(settleNflFantasyWeek).mockResolvedValue({
      matchupsSettled: 1,
      matchupsSkipped: 0,
      startersScored: 0,
    } as never);

    const out = await settleWeekTick({
      now: new Date("2025-11-11T12:00:00Z"),
      force: true,
    });

    const detail = out.detail as { errors: unknown[] };
    expect(detail.errors).toHaveLength(1);
  });
});

describe("nflFantasyOrchestratorTick", () => {
  it("orchestre les 6 ticks et retourne leurs resultats", async () => {
    vi.mocked(prisma.nflWeek.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.nflWeek.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.nflFantasyDraftSession.findMany).mockResolvedValue(
      [] as never,
    );

    const out = await nflFantasyOrchestratorTick({
      now: new Date("2025-11-11T18:00:00Z"), // mardi 18h
    });
    expect(out.nflverse.ran).toBe(false);
    expect(out.espn.ran).toBe(false); // mardi != gameday
    expect(out.lock.ran).toBe(false);
    expect(out.settle.ran).toBe(false);
    expect(out.mercato.ran).toBe(false); // aucune session due
  });
});
