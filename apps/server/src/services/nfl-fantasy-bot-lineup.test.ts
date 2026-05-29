import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflFantasyEntry: { findMany: vi.fn() },
    nflFantasyRoster: { findMany: vi.fn() },
  },
}));

vi.mock("./nfl-fantasy-lineup", () => {
  class NflFantasyLineupError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "NflFantasyLineupError";
    }
  }
  return {
    NflFantasyLineupError,
    setLineup: vi.fn(),
    DEFAULT_STARTERS_COUNT: 11,
  };
});

import { prisma } from "../prisma";
import { setLineup, NflFantasyLineupError } from "./nfl-fantasy-lineup";
import {
  autoFillTestLineups,
  pickTopStarters,
} from "./nfl-fantasy-bot-lineup";

beforeEach(() => {
  vi.resetAllMocks();
});

// ────────────────────────────────────────────────────────────────────
// pickTopStarters (pure)
// ────────────────────────────────────────────────────────────────────

describe("pickTopStarters", () => {
  const mk = (id: string, value: number, pseudonym = id) => ({
    playerId: id,
    bbPosition: "Lineman",
    currentValue: value,
    pseudonym,
  });

  it("retourne les N premiers par currentValue desc", () => {
    const roster = [mk("a", 100), mk("b", 300), mk("c", 200), mk("d", 50)];
    const top = pickTopStarters(roster, 2);
    expect(top.map((p) => p.playerId)).toEqual(["b", "c"]);
  });

  it("tiebreak par pseudonym asc (deterministe)", () => {
    const roster = [
      mk("p1", 200, "zeta"),
      mk("p2", 200, "alpha"),
      mk("p3", 200, "mike"),
    ];
    const top = pickTopStarters(roster, 2);
    expect(top.map((p) => p.pseudonym)).toEqual(["alpha", "mike"]);
  });

  it("count > roster.length retourne tout le roster trie", () => {
    const roster = [mk("a", 100), mk("b", 200)];
    const top = pickTopStarters(roster, 5);
    expect(top).toHaveLength(2);
    expect(top[0].playerId).toBe("b");
  });

  it("ne mute pas le roster source", () => {
    const roster = [mk("a", 100), mk("b", 200)];
    const before = roster.map((r) => r.playerId);
    pickTopStarters(roster, 1);
    expect(roster.map((r) => r.playerId)).toEqual(before);
  });
});

// ────────────────────────────────────────────────────────────────────
// autoFillTestLineups (DB)
// ────────────────────────────────────────────────────────────────────

describe("autoFillTestLineups", () => {
  it("exclut l'entry de l'owner et persiste les lineups des autres", async () => {
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([
      { id: "e2" },
      { id: "e3" },
    ] as never);

    // Roster avec 11 joueurs pour chaque entry (currentValue different
    // pour qu'on observe l'ordre).
    const buildRoster = (prefix: string) =>
      Array.from({ length: 11 }, (_, i) => ({
        playerId: `${prefix}-p${i}`,
        player: {
          pseudonym: `name${i}`,
          bbPosition: "Lineman",
          currentValue: 100 + i, // p10 > p9 > ... > p0
        },
      }));
    vi.mocked(prisma.nflFantasyRoster.findMany)
      .mockResolvedValueOnce(buildRoster("e2") as never)
      .mockResolvedValueOnce(buildRoster("e3") as never);

    vi.mocked(setLineup).mockResolvedValue({} as never);

    const res = await autoFillTestLineups({
      leagueId: "lg1",
      weekId: "2025:W10",
      excludeEntryId: "e1",
    });

    expect(res.lineupsCreated).toBe(2);
    expect(res.entriesProcessed).toBe(2);
    expect(res.lineupsSkippedLocked).toBe(0);
    expect(res.entriesTooSmall).toBe(0);

    // findMany sur entries doit exclure e1
    expect(prisma.nflFantasyEntry.findMany).toHaveBeenCalledWith({
      where: { leagueId: "lg1", id: { not: "e1" } },
      select: { id: true },
    });

    // Verifie qu'on call setLineup avec captain = top currentValue (p10)
    const firstCall = vi.mocked(setLineup).mock.calls[0]?.[0];
    expect(firstCall?.captainId).toBe("e2-p10");
    expect(firstCall?.viceCaptainId).toBe("e2-p9");
    expect(firstCall?.starters).toHaveLength(11);
  });

  it("incrementeentriesTooSmall si roster < 11 et skip", async () => {
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([
      { id: "e2" },
    ] as never);
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue([
      {
        playerId: "p1",
        player: { pseudonym: "x", bbPosition: "Lineman", currentValue: 100 },
      },
    ] as never);

    const res = await autoFillTestLineups({
      leagueId: "lg1",
      weekId: "2025:W10",
      excludeEntryId: null,
    });

    expect(res.entriesTooSmall).toBe(1);
    expect(res.lineupsCreated).toBe(0);
    expect(setLineup).not.toHaveBeenCalled();
  });

  it("compte les lineups LINEUP_LOCKED comme skipped (pas un fail)", async () => {
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([
      { id: "e2" },
    ] as never);
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue(
      Array.from({ length: 11 }, (_, i) => ({
        playerId: `p${i}`,
        player: {
          pseudonym: `n${i}`,
          bbPosition: "Lineman",
          currentValue: 100,
        },
      })) as never,
    );
    vi.mocked(setLineup).mockRejectedValue(
      new NflFantasyLineupError("LINEUP_LOCKED", "deja locked"),
    );

    const res = await autoFillTestLineups({
      leagueId: "lg1",
      weekId: "2025:W10",
      excludeEntryId: null,
    });

    expect(res.lineupsSkippedLocked).toBe(1);
    expect(res.lineupsCreated).toBe(0);
  });

  it("excludeEntryId=null traite toutes les entries", async () => {
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([] as never);

    await autoFillTestLineups({
      leagueId: "lg1",
      weekId: "2025:W10",
      excludeEntryId: null,
    });

    expect(prisma.nflFantasyEntry.findMany).toHaveBeenCalledWith({
      where: { leagueId: "lg1" },
      select: { id: true },
    });
  });
});
