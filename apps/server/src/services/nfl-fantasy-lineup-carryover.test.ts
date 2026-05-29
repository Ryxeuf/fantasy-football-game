import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflWeek: { findUnique: vi.fn(), findMany: vi.fn() },
    nflFantasyLineup: { findMany: vi.fn() },
    nflFantasyRoster: { findMany: vi.fn() },
  },
}));

vi.mock("./nfl-fantasy-lineup", async (orig) => {
  const actual = await orig<typeof import("./nfl-fantasy-lineup")>();
  return {
    ...actual,
    setLineup: vi.fn(),
  };
});

import { prisma } from "../prisma";
import {
  NflFantasyLineupError,
  setLineup,
} from "./nfl-fantasy-lineup";
import {
  carryOverLineupFromPreviousWeek,
  findPreviousLineup,
  findPreviousLineupSummary,
} from "./nfl-fantasy-lineup-carryover";

beforeEach(() => {
  vi.resetAllMocks();
});

function mockWeeks(
  current: { id: string; seasonId: string; weekNumber: number },
  previous: ReadonlyArray<{ id: string; weekNumber: number }>,
): void {
  vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue(current as never);
  vi.mocked(prisma.nflWeek.findMany).mockResolvedValue(previous as never);
}

function buildPreviousLineup(starters: ReadonlyArray<{
  playerId: string;
  bbPosition: string;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
}>) {
  return {
    id: "lPrev",
    entryId: "e1",
    weekId: "2025:W1",
    captainId: starters.find((s) => s.isCaptain)?.playerId ?? null,
    viceCaptainId: starters.find((s) => s.isViceCaptain)?.playerId ?? null,
    lockedAt: new Date(),
    starters: starters.map((s, i) => ({
      id: `prev-s-${i}`,
      lineupId: "lPrev",
      playerId: s.playerId,
      bbPosition: s.bbPosition,
      isCaptain: !!s.isCaptain,
      isViceCaptain: !!s.isViceCaptain,
      rawSpp: null,
      finalSpp: null,
      sppBreakdown: null,
    })),
  };
}

// ────────────────────────────────────────────────────────────────────
// findPreviousLineup
// ────────────────────────────────────────────────────────────────────

describe("findPreviousLineup", () => {
  it("retourne null si week courante introuvable", async () => {
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue(null);
    expect(
      await findPreviousLineup({ entryId: "e1", currentWeekId: "X" }),
    ).toBeNull();
  });

  it("retourne null si aucune semaine anterieure dans la saison", async () => {
    mockWeeks({ id: "2025:W1", seasonId: "s2025", weekNumber: 1 }, []);
    expect(
      await findPreviousLineup({ entryId: "e1", currentWeekId: "2025:W1" }),
    ).toBeNull();
  });

  it("retourne null si aucune lineup persisted pour les semaines anterieures", async () => {
    mockWeeks(
      { id: "2025:W2", seasonId: "s2025", weekNumber: 2 },
      [{ id: "2025:W1", weekNumber: 1 }],
    );
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([] as never);
    expect(
      await findPreviousLineup({ entryId: "e1", currentWeekId: "2025:W2" }),
    ).toBeNull();
  });

  it("renvoie la lineup la plus recente (weekNumber max) parmi les anterieures", async () => {
    mockWeeks(
      { id: "2025:W4", seasonId: "s2025", weekNumber: 4 },
      [
        { id: "2025:W3", weekNumber: 3 },
        { id: "2025:W2", weekNumber: 2 },
        { id: "2025:W1", weekNumber: 1 },
      ],
    );
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([
      { ...buildPreviousLineup([{ playerId: "p1", bbPosition: "QB" }]), weekId: "2025:W1" },
      { ...buildPreviousLineup([{ playerId: "p2", bbPosition: "RB" }]), weekId: "2025:W3" },
    ] as never);

    const out = await findPreviousLineup({
      entryId: "e1",
      currentWeekId: "2025:W4",
    });
    expect(out?.weekId).toBe("2025:W3");
    expect(out?.weekNumber).toBe(3);
  });
});

// ────────────────────────────────────────────────────────────────────
// findPreviousLineupSummary
// ────────────────────────────────────────────────────────────────────

describe("findPreviousLineupSummary", () => {
  it("retourne null si pas de lineup precedente", async () => {
    mockWeeks({ id: "2025:W1", seasonId: "s2025", weekNumber: 1 }, []);
    expect(
      await findPreviousLineupSummary({
        entryId: "e1",
        currentWeekId: "2025:W1",
      }),
    ).toBeNull();
  });

  it("missingPlayers = nb de starters absents du roster courant", async () => {
    mockWeeks(
      { id: "2025:W2", seasonId: "s2025", weekNumber: 2 },
      [{ id: "2025:W1", weekNumber: 1 }],
    );
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([
      {
        ...buildPreviousLineup([
          { playerId: "p1", bbPosition: "QB" },
          { playerId: "p2", bbPosition: "RB" },
          { playerId: "p3", bbPosition: "WR" },
        ]),
        weekId: "2025:W1",
      },
    ] as never);
    // Roster courant : p1 + p3 (p2 a quitte via mercato)
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue([
      { playerId: "p1" },
      { playerId: "p3" },
    ] as never);

    const out = await findPreviousLineupSummary({
      entryId: "e1",
      currentWeekId: "2025:W2",
    });
    expect(out?.startersCount).toBe(3);
    expect(out?.missingPlayers).toBe(1);
    expect(out?.allPlayersOnRoster).toBe(false);
    expect(out?.weekId).toBe("2025:W1");
    expect(out?.weekNumber).toBe(1);
  });

  it("allPlayersOnRoster=true quand tout le monde est encore present", async () => {
    mockWeeks(
      { id: "2025:W2", seasonId: "s2025", weekNumber: 2 },
      [{ id: "2025:W1", weekNumber: 1 }],
    );
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([
      {
        ...buildPreviousLineup([
          { playerId: "p1", bbPosition: "QB" },
          { playerId: "p2", bbPosition: "RB" },
        ]),
        weekId: "2025:W1",
      },
    ] as never);
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue([
      { playerId: "p1" },
      { playerId: "p2" },
    ] as never);

    const out = await findPreviousLineupSummary({
      entryId: "e1",
      currentWeekId: "2025:W2",
    });
    expect(out?.missingPlayers).toBe(0);
    expect(out?.allPlayersOnRoster).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────
// carryOverLineupFromPreviousWeek
// ────────────────────────────────────────────────────────────────────

describe("carryOverLineupFromPreviousWeek", () => {
  it("throw WEEK_NOT_FOUND si la week courante est introuvable", async () => {
    vi.mocked(prisma.nflWeek.findUnique).mockResolvedValue(null);
    await expect(
      carryOverLineupFromPreviousWeek({
        entryId: "e1",
        currentWeekId: "X",
      }),
    ).rejects.toMatchObject({ code: "WEEK_NOT_FOUND" });
  });

  it("throw NO_PREVIOUS_LINEUP si rien a reporter", async () => {
    mockWeeks({ id: "2025:W1", seasonId: "s2025", weekNumber: 1 }, []);
    await expect(
      carryOverLineupFromPreviousWeek({
        entryId: "e1",
        currentWeekId: "2025:W1",
      }),
    ).rejects.toBeInstanceOf(NflFantasyLineupError);
  });

  it("throw ROSTER_TOO_DIVERGENT si <11 survivants apres filtrage", async () => {
    mockWeeks(
      { id: "2025:W2", seasonId: "s2025", weekNumber: 2 },
      [{ id: "2025:W1", weekNumber: 1 }],
    );
    // Lineup precedente avec 11 joueurs, mais seuls 3 encore sur le roster.
    const previousStarters = Array.from({ length: 11 }, (_, i) => ({
      playerId: `p${i}`,
      bbPosition: "Lineman",
    }));
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([
      { ...buildPreviousLineup(previousStarters), weekId: "2025:W1" },
    ] as never);
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue([
      { playerId: "p0" },
      { playerId: "p1" },
      { playerId: "p2" },
    ] as never);

    await expect(
      carryOverLineupFromPreviousWeek({
        entryId: "e1",
        currentWeekId: "2025:W2",
      }),
    ).rejects.toMatchObject({ code: "ROSTER_TOO_DIVERGENT" });
  });

  it("nominal : 11 survivants → setLineup appele avec captain preserve", async () => {
    mockWeeks(
      { id: "2025:W2", seasonId: "s2025", weekNumber: 2 },
      [{ id: "2025:W1", weekNumber: 1 }],
    );
    const previousStarters = Array.from({ length: 11 }, (_, i) => ({
      playerId: `p${i}`,
      bbPosition: i === 0 ? "Thrower" : "Lineman",
      isCaptain: i === 0,
      isViceCaptain: i === 1,
    }));
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([
      { ...buildPreviousLineup(previousStarters), weekId: "2025:W1" },
    ] as never);
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue(
      previousStarters.map((s) => ({ playerId: s.playerId })) as never,
    );
    vi.mocked(setLineup).mockResolvedValue({
      id: "lNew",
      starters: [],
    } as never);

    await carryOverLineupFromPreviousWeek({
      entryId: "e1",
      currentWeekId: "2025:W2",
    });

    expect(setLineup).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(setLineup).mock.calls[0][0];
    expect(arg.entryId).toBe("e1");
    expect(arg.weekId).toBe("2025:W2");
    expect(arg.captainId).toBe("p0"); // captain preserve
    expect(arg.viceCaptainId).toBe("p1"); // vice preserve
    expect(arg.starters).toHaveLength(11);
  });

  it("captain absent du roster → fallback sur le premier survivant", async () => {
    mockWeeks(
      { id: "2025:W2", seasonId: "s2025", weekNumber: 2 },
      [{ id: "2025:W1", weekNumber: 1 }],
    );
    const previousStarters = Array.from({ length: 12 }, (_, i) => ({
      playerId: `p${i}`,
      bbPosition: "Lineman",
      isCaptain: i === 0, // captain est p0
      isViceCaptain: i === 1,
    }));
    vi.mocked(prisma.nflFantasyLineup.findMany).mockResolvedValue([
      { ...buildPreviousLineup(previousStarters), weekId: "2025:W1" },
    ] as never);
    // p0 absent du roster (trade)
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue(
      previousStarters.slice(1).map((s) => ({ playerId: s.playerId })) as never,
    );
    vi.mocked(setLineup).mockResolvedValue({ id: "lNew" } as never);

    await carryOverLineupFromPreviousWeek({
      entryId: "e1",
      currentWeekId: "2025:W2",
    });

    const arg = vi.mocked(setLineup).mock.calls[0][0];
    expect(arg.captainId).toBe("p1"); // p0 absent -> premier survivant
    expect(arg.viceCaptainId).toBe(null); // p1 promu captain, vice n'a plus de candidat preserve
  });
});
