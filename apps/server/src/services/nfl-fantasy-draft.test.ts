import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflFantasyLeague: { findUnique: vi.fn(), update: vi.fn() },
    nflFantasyRoster: { findMany: vi.fn() },
    nflPlayer: { findMany: vi.fn() },
  },
}));

// On mock ces 2 modules pour eviter de re-tester la logique addPlayerToRoster
// + seedStartingRerolls (deja couverts par leurs propres tests).
vi.mock("./nfl-fantasy-roster", async () => {
  const actual =
    await vi.importActual<typeof import("./nfl-fantasy-roster")>(
      "./nfl-fantasy-roster",
    );
  return {
    ...actual,
    addPlayerToRoster: vi.fn().mockResolvedValue({}),
  };
});

vi.mock("./nfl-fantasy-mercato", async () => {
  const actual =
    await vi.importActual<typeof import("./nfl-fantasy-mercato")>(
      "./nfl-fantasy-mercato",
    );
  return {
    ...actual,
    seedStartingRerolls: vi.fn().mockResolvedValue({ rerollsSeeded: 8 }),
  };
});

import { prisma } from "../prisma";
import { addPlayerToRoster } from "./nfl-fantasy-roster";
import { seedStartingRerolls } from "./nfl-fantasy-mercato";
import {
  autoFillRosters,
  DEFAULT_PLAYERS_PER_ENTRY,
  finalizeLeague,
  getDraftStats,
  MAX_PLAYERS_PER_ENTRY,
  MIN_PLAYERS_PER_ENTRY,
  NflFantasyDraftError,
  seededShuffle,
} from "./nfl-fantasy-draft";

beforeEach(() => {
  vi.resetAllMocks();
  // resetAllMocks vide aussi les mockResolvedValue declares dans les
  // vi.mock factories, donc on les redeclare ici pour les mocks "always-on".
  vi.mocked(addPlayerToRoster).mockResolvedValue({} as never);
  vi.mocked(seedStartingRerolls).mockResolvedValue({ rerollsSeeded: 8 });
});

// ────────────────────────────────────────────────────────────────────
// seededShuffle (helper pur)
// ────────────────────────────────────────────────────────────────────

describe("seededShuffle", () => {
  it("ne modifie pas l'array source", () => {
    const src = [1, 2, 3, 4, 5];
    const _out = seededShuffle("seed", src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });

  it("deterministe pour la meme seed", () => {
    const a = seededShuffle("X", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const b = seededShuffle("X", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(a).toEqual(b);
  });

  it("different pour des seeds differentes", () => {
    const a = seededShuffle("A", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const b = seededShuffle("B", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(a).not.toEqual(b);
  });

  it("retourne tous les elements", () => {
    const out = seededShuffle("seed", [1, 2, 3, 4, 5]);
    expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("tolere l'array vide ou un seul element", () => {
    expect(seededShuffle("x", [])).toEqual([]);
    expect(seededShuffle("x", [42])).toEqual([42]);
  });
});

// ────────────────────────────────────────────────────────────────────
// autoFillRosters
// ────────────────────────────────────────────────────────────────────

describe("autoFillRosters", () => {
  function pool(n: number): { id: string }[] {
    return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` }));
  }

  it("happy path : 2 entries * 15 = 30 picks", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      status: "draft",
      entries: [
        { id: "e1", joinedAt: new Date(0) },
        { id: "e2", joinedAt: new Date(1) },
      ],
    } as never);
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue(pool(50) as never);

    const out = await autoFillRosters({ leagueId: "lg1" });

    expect(out.entriesFilled).toBe(2);
    expect(out.playersAssigned).toBe(30);
    expect(out.playersPerEntry).toBe(15);
    expect(addPlayerToRoster).toHaveBeenCalledTimes(30);
  });

  it("respecte playersPerEntry override", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      status: "draft",
      entries: [{ id: "e1", joinedAt: new Date(0) }],
    } as never);
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue(pool(20) as never);

    const out = await autoFillRosters({ leagueId: "lg1", playersPerEntry: 11 });
    expect(out.playersAssigned).toBe(11);
  });

  it("skip les entries deja remplies (idempotent partiel)", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      status: "draft",
      entries: [
        { id: "e1", joinedAt: new Date(0) },
        { id: "e2", joinedAt: new Date(1) },
      ],
    } as never);
    // e1 a deja 15 joueurs : ne devrait recevoir aucun pick
    const e1Roster = pool(15).map((p) => ({ playerId: p.id, entryId: "e1" }));
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue(e1Roster as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue(pool(50) as never);

    const out = await autoFillRosters({ leagueId: "lg1" });

    expect(out.playersAssigned).toBe(15); // seulement e2
    expect(out.entriesFilled).toBe(1);
  });

  it("LEAGUE_NOT_FOUND", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue(null);

    await expect(autoFillRosters({ leagueId: "missing" })).rejects.toThrow(
      /introuvable/,
    );
  });

  it("INVALID_STATUS si pas en draft", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      status: "in_progress",
      entries: [],
    } as never);

    await expect(autoFillRosters({ leagueId: "lg1" })).rejects.toThrow(
      /requiert 'draft'/,
    );
  });

  it("NO_ENTRIES si pas d'entries", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      status: "draft",
      entries: [],
    } as never);

    await expect(autoFillRosters({ leagueId: "lg1" })).rejects.toThrow(
      /sans entries/,
    );
  });

  it("POOL_TOO_SMALL si pas assez de joueurs", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      status: "draft",
      entries: [
        { id: "e1", joinedAt: new Date(0) },
        { id: "e2", joinedAt: new Date(1) },
      ],
    } as never);
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue(pool(10) as never);

    await expect(autoFillRosters({ leagueId: "lg1" })).rejects.toThrow(
      /Pool.*insuffisant/,
    );
  });

  it("INVALID_PLAYERS_PER_ENTRY hors bornes", async () => {
    await expect(
      autoFillRosters({ leagueId: "lg1", playersPerEntry: 5 }),
    ).rejects.toThrow(/playersPerEntry/);
    await expect(
      autoFillRosters({ leagueId: "lg1", playersPerEntry: 50 }),
    ).rejects.toThrow(/playersPerEntry/);
  });
});

// ────────────────────────────────────────────────────────────────────
// finalizeLeague
// ────────────────────────────────────────────────────────────────────

describe("finalizeLeague", () => {
  it("transitionne draft -> in_progress + seed rerolls", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      status: "draft",
      entries: [{ id: "e1" }, { id: "e2" }, { id: "e3" }],
    } as never);
    vi.mocked(prisma.nflFantasyLeague.update).mockResolvedValue({} as never);

    const out = await finalizeLeague({ leagueId: "lg1" });

    expect(out.status).toBe("in_progress");
    expect(out.entriesSeeded).toBe(3);
    expect(out.rerollsSeededTotal).toBe(24); // 3 * 8
    // Sans cycleId sur la league mockee, pas de pre-generation de matchups
    expect(out.matchupsCreated).toBe(0);
    expect(out.weeksAlreadyPaired).toBe(0);
    expect(seedStartingRerolls).toHaveBeenCalledTimes(3);
    expect(prisma.nflFantasyLeague.update).toHaveBeenCalledWith({
      where: { id: "lg1" },
      data: { status: "in_progress" },
    });
  });

  it("LEAGUE_NOT_FOUND", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue(null);
    await expect(finalizeLeague({ leagueId: "missing" })).rejects.toThrow(
      /introuvable/,
    );
  });

  it("INVALID_STATUS si pas en draft", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      status: "in_progress",
      entries: [{ id: "e1" }],
    } as never);

    await expect(finalizeLeague({ leagueId: "lg1" })).rejects.toThrow(
      /requiert 'draft'/,
    );
  });

  it("NO_ENTRIES rejette", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      status: "draft",
      entries: [],
    } as never);

    await expect(finalizeLeague({ leagueId: "lg1" })).rejects.toThrow(
      /sans entries/,
    );
  });
});

// ────────────────────────────────────────────────────────────────────
// getDraftStats
// ────────────────────────────────────────────────────────────────────

describe("getDraftStats", () => {
  it("retourne le compte rostered par entry", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      status: "draft",
      entries: [
        { id: "e1", teamName: "Team A", roster: [{ id: "r1" }, { id: "r2" }] },
        { id: "e2", teamName: "Team B", roster: [] },
      ],
    } as never);

    const stats = await getDraftStats("lg1");

    expect(stats.status).toBe("draft");
    expect(stats.perEntry).toEqual([
      { entryId: "e1", teamName: "Team A", rostered: 2 },
      { entryId: "e2", teamName: "Team B", rostered: 0 },
    ]);
  });
});

describe("NflFantasyDraftError + constants", () => {
  it("preserve code + name", () => {
    const err = new NflFantasyDraftError("POOL_TOO_SMALL", "boom");
    expect(err.code).toBe("POOL_TOO_SMALL");
    expect(err.name).toBe("NflFantasyDraftError");
  });
  it("expose DEFAULT/MIN/MAX players per entry", () => {
    expect(DEFAULT_PLAYERS_PER_ENTRY).toBe(15);
    expect(MIN_PLAYERS_PER_ENTRY).toBe(11);
    expect(MAX_PLAYERS_PER_ENTRY).toBe(30);
  });
});
