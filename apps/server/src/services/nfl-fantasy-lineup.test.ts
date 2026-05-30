import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflFantasyEntry: { findUnique: vi.fn(), update: vi.fn() },
    nflFantasyLineup: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    nflFantasyLineupStarter: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    nflFantasyRoster: { findMany: vi.fn() },
    nflPlayer: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("./nfl-fantasy-bot-lineup", () => ({
  ensureDefaultLineupsForWeek: vi.fn(),
}));

import { prisma } from "../prisma";
import {
  CAPTAIN_MULTIPLIER,
  DEFAULT_STARTERS_COUNT,
  getLineup,
  isLineupLocked,
  lockLineups,
  NflFantasyLineupError,
  setLineup,
  updateEntryPlayStyle,
  validateComposition,
  validateLineupStructure,
  VICE_CAPTAIN_MULTIPLIER,
} from "./nfl-fantasy-lineup";

beforeEach(() => {
  vi.resetAllMocks();
});

// Helper : construit 11 starters bidons
function fakeStarters(count = 11): { playerId: string; bbPosition: string }[] {
  return Array.from({ length: count }, (_, i) => ({
    playerId: `p${i + 1}`,
    bbPosition: i === 0 ? "Thrower" : "Lineman",
  }));
}

describe("constants Q3", () => {
  it("captain multiplier = 1.5 (Q3)", () => {
    expect(CAPTAIN_MULTIPLIER).toBe(1.5);
  });
  it("vice captain multiplier = 1.2 (Q3)", () => {
    expect(VICE_CAPTAIN_MULTIPLIER).toBe(1.2);
  });
  it("default starters = 11", () => {
    expect(DEFAULT_STARTERS_COUNT).toBe(11);
  });
});

describe("validateLineupStructure", () => {
  it("accepte 11 starters distincts + captain/vice", () => {
    expect(() =>
      validateLineupStructure({
        starters: fakeStarters(),
        captainId: "p1",
        viceCaptainId: "p2",
      }),
    ).not.toThrow();
  });

  it("INVALID_LINEUP_SIZE si != 11", () => {
    expect(() =>
      validateLineupStructure({
        starters: fakeStarters(10),
        captainId: "p1",
      }),
    ).toThrow(/exactement 11 starters/);
  });

  it("respecte startersCount override", () => {
    expect(() =>
      validateLineupStructure({
        starters: fakeStarters(9),
        captainId: "p1",
        startersCount: 9,
      }),
    ).not.toThrow();
  });

  it("DUPLICATE_PLAYER si meme playerId 2x", () => {
    const dups = fakeStarters();
    dups[5] = { playerId: "p1", bbPosition: "Catcher" };
    expect(() =>
      validateLineupStructure({ starters: dups, captainId: "p1" }),
    ).toThrow(/plusieurs fois/);
  });

  it("INVALID_STARTERS si bbPosition vide", () => {
    const bad = fakeStarters();
    bad[3] = { playerId: "p4", bbPosition: "" };
    expect(() =>
      validateLineupStructure({ starters: bad, captainId: "p1" }),
    ).toThrow(/playerId \+ bbPosition/);
  });

  it("CAPTAIN_NOT_IN_STARTERS", () => {
    expect(() =>
      validateLineupStructure({
        starters: fakeStarters(),
        captainId: "pX",
      }),
    ).toThrow(/Captain pX/);
  });

  it("VICE_NOT_IN_STARTERS", () => {
    expect(() =>
      validateLineupStructure({
        starters: fakeStarters(),
        captainId: "p1",
        viceCaptainId: "pY",
      }),
    ).toThrow(/Vice-captain pY/);
  });

  it("CAPTAIN_EQUALS_VICE", () => {
    expect(() =>
      validateLineupStructure({
        starters: fakeStarters(),
        captainId: "p1",
        viceCaptainId: "p1",
      }),
    ).toThrow(/Captain et vice-captain doivent etre differents/);
  });

  it("captainId null + vice optionnel : OK (lineup sans designations)", () => {
    expect(() =>
      validateLineupStructure({
        starters: fakeStarters(),
        captainId: null,
      }),
    ).not.toThrow();
  });
});

describe("setLineup", () => {
  function happyMocks() {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({
      id: "e1",
    } as never);
    vi.mocked(prisma.nflFantasyLineup.findUnique)
      .mockResolvedValueOnce(null) // existence check
      .mockResolvedValueOnce({
        id: "l1",
        entryId: "e1",
        weekId: "2025:W10",
        captainId: "p1",
        viceCaptainId: "p2",
        lockedAt: null,
        starters: fakeStarters(),
      } as never);
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue(
      fakeStarters().map((s) => ({ playerId: s.playerId })) as never,
    );
    // Resolution archetype : 1 QB (passer) + 10 OL (lineman) — conforme balanced.
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue(
      fakeStarters().map((s, i) => ({
        id: s.playerId,
        nflPosition: i === 0 ? "QB" : "OL",
      })) as never,
    );
    vi.mocked(prisma.nflFantasyLineup.create).mockResolvedValue({
      id: "l1",
    } as never);
  }

  it("cree un nouveau lineup si absent", async () => {
    happyMocks();

    const out = await setLineup({
      entryId: "e1",
      weekId: "2025:W10",
      starters: fakeStarters(),
      captainId: "p1",
      viceCaptainId: "p2",
    });

    expect(out.id).toBe("l1");
    expect(prisma.nflFantasyLineup.create).toHaveBeenCalledTimes(1);
  });

  it("met a jour si lineup existe (non locked)", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({
      id: "e1",
    } as never);
    vi.mocked(prisma.nflFantasyLineup.findUnique)
      .mockResolvedValueOnce({ id: "l-existing", lockedAt: null } as never)
      .mockResolvedValueOnce({
        id: "l-existing",
        starters: fakeStarters(),
      } as never);
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue(
      fakeStarters().map((s) => ({ playerId: s.playerId })) as never,
    );
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue(
      fakeStarters().map((s, i) => ({
        id: s.playerId,
        nflPosition: i === 0 ? "QB" : "OL",
      })) as never,
    );
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);

    await setLineup({
      entryId: "e1",
      weekId: "2025:W10",
      starters: fakeStarters(),
      captainId: "p1",
      viceCaptainId: "p2",
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.nflFantasyLineup.create).not.toHaveBeenCalled();
  });

  it("COMPOSITION_CAP_EXCEEDED si trop de receveurs pour le style", async () => {
    // Entry en style 'balanced' (receiver cap 3). On aligne 5 WR.
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({
      id: "e1",
      playStyle: "balanced",
    } as never);
    vi.mocked(prisma.nflFantasyLineup.findUnique).mockResolvedValue(null);
    const starters = Array.from({ length: 11 }, (_, i) => ({
      playerId: `p${i + 1}`,
      bbPosition: "Catcher",
    }));
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue(
      starters.map((s) => ({ playerId: s.playerId })) as never,
    );
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue(
      starters.map((s, i) => ({
        id: s.playerId,
        nflPosition: i < 5 ? "WR" : "OL", // 5 receveurs, 6 linemen
      })) as never,
    );

    await expect(
      setLineup({
        entryId: "e1",
        weekId: "2025:W10",
        starters,
        captainId: "p1",
      }),
    ).rejects.toThrow(/Composition invalide.*receveurs/);
  });

  it("accepte 6 receveurs en style air_raid", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({
      id: "e1",
      playStyle: "air_raid",
    } as never);
    vi.mocked(prisma.nflFantasyLineup.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "l1", starters: [] } as never);
    const starters = Array.from({ length: 11 }, (_, i) => ({
      playerId: `p${i + 1}`,
      bbPosition: "Catcher",
    }));
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue(
      starters.map((s) => ({ playerId: s.playerId })) as never,
    );
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue(
      starters.map((s, i) => ({
        id: s.playerId,
        nflPosition: i < 6 ? "WR" : "OL", // 6 receveurs (cap air_raid), 5 linemen
      })) as never,
    );
    vi.mocked(prisma.nflFantasyLineup.create).mockResolvedValue({
      id: "l1",
    } as never);

    await expect(
      setLineup({
        entryId: "e1",
        weekId: "2025:W10",
        starters,
        captainId: "p1",
      }),
    ).resolves.toBeDefined();
  });

  it("LINEUP_LOCKED si lockedAt set", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({
      id: "e1",
    } as never);
    vi.mocked(prisma.nflFantasyLineup.findUnique).mockResolvedValue({
      id: "l1",
      lockedAt: new Date("2025-11-09T17:00:00Z"),
    } as never);

    await expect(
      setLineup({
        entryId: "e1",
        weekId: "2025:W10",
        starters: fakeStarters(),
        captainId: "p1",
      }),
    ).rejects.toThrow(/deja locked/);
  });

  it("ENTRY_NOT_FOUND si entry absente", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue(null);

    await expect(
      setLineup({
        entryId: "missing",
        weekId: "2025:W10",
        starters: fakeStarters(),
        captainId: "p1",
      }),
    ).rejects.toThrow(/Entry missing introuvable/);
  });

  it("PLAYER_NOT_ON_ROSTER si un starter pas dans le roster", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({
      id: "e1",
    } as never);
    vi.mocked(prisma.nflFantasyLineup.findUnique).mockResolvedValue(null);
    // Roster ne contient que 10 des 11 starters
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue(
      fakeStarters()
        .slice(0, 10)
        .map((s) => ({ playerId: s.playerId })) as never,
    );

    await expect(
      setLineup({
        entryId: "e1",
        weekId: "2025:W10",
        starters: fakeStarters(),
        captainId: "p1",
      }),
    ).rejects.toThrow(/pas sur le roster/);
  });

  it("propage les erreurs de validateLineupStructure", async () => {
    await expect(
      setLineup({
        entryId: "e1",
        weekId: "2025:W10",
        starters: fakeStarters(5),
        captainId: "p1",
      }),
    ).rejects.toThrow(/exactement 11 starters/);
  });
});

describe("lockLineups", () => {
  it("genere les defaults manquants puis lock toutes les non-lockees", async () => {
    const { ensureDefaultLineupsForWeek } = await import(
      "./nfl-fantasy-bot-lineup"
    );
    vi.mocked(ensureDefaultLineupsForWeek).mockResolvedValue({
      defaultsCreated: 2,
      defaultsTooSmall: 1,
      entriesScanned: 3,
    });
    vi.mocked(prisma.nflFantasyLineup.updateMany).mockResolvedValue({
      count: 5,
    } as never);

    const result = await lockLineups("2025:W10");

    expect(result.locked).toBe(5);
    expect(result.defaultsCreated).toBe(2);
    expect(result.defaultsTooSmall).toBe(1);
    expect(ensureDefaultLineupsForWeek).toHaveBeenCalledWith("2025:W10");
    expect(prisma.nflFantasyLineup.updateMany).toHaveBeenCalledWith({
      where: { weekId: "2025:W10", lockedAt: null },
      data: { lockedAt: expect.any(Date) },
    });
  });

  it("retourne 0 si rien a lock ni a defaulter (idempotent)", async () => {
    const { ensureDefaultLineupsForWeek } = await import(
      "./nfl-fantasy-bot-lineup"
    );
    vi.mocked(ensureDefaultLineupsForWeek).mockResolvedValue({
      defaultsCreated: 0,
      defaultsTooSmall: 0,
      entriesScanned: 0,
    });
    vi.mocked(prisma.nflFantasyLineup.updateMany).mockResolvedValue({
      count: 0,
    } as never);

    const result = await lockLineups("2025:W10");
    expect(result.locked).toBe(0);
    expect(result.defaultsCreated).toBe(0);
  });
});

describe("getLineup / isLineupLocked", () => {
  it("getLineup retourne null si absent", async () => {
    vi.mocked(prisma.nflFantasyLineup.findUnique).mockResolvedValue(null);

    const lineup = await getLineup({ entryId: "e1", weekId: "2025:W10" });
    expect(lineup).toBeNull();
  });

  it("isLineupLocked true si lockedAt non null", async () => {
    vi.mocked(prisma.nflFantasyLineup.findUnique).mockResolvedValue({
      lockedAt: new Date(),
    } as never);
    expect(await isLineupLocked({ entryId: "e1", weekId: "w" })).toBe(true);
  });

  it("isLineupLocked false si lineup absent", async () => {
    vi.mocked(prisma.nflFantasyLineup.findUnique).mockResolvedValue(null);
    expect(await isLineupLocked({ entryId: "e1", weekId: "w" })).toBe(false);
  });
});

describe("validateComposition (pur)", () => {
  it("ne throw pas si conforme", () => {
    expect(() =>
      validateComposition({
        archetypes: ["passer", "rusher", "rusher", "receiver", "lineman"],
        playStyle: "balanced",
      }),
    ).not.toThrow();
  });

  it("throw COMPOSITION_CAP_EXCEEDED avec libelle FR si depassement", () => {
    expect(() =>
      validateComposition({
        archetypes: ["receiver", "receiver", "receiver", "receiver"],
        playStyle: "balanced",
      }),
    ).toThrow(/receveurs.*4\/3 max/);
  });
});

describe("updateEntryPlayStyle", () => {
  it("met a jour le style si pas de semaine lockee en attente", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({
      id: "e1",
    } as never);
    vi.mocked(prisma.nflFantasyLineup.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.nflFantasyEntry.update).mockResolvedValue({
      id: "e1",
      playStyle: "offensive",
    } as never);

    const out = await updateEntryPlayStyle({
      entryId: "e1",
      playStyle: "offensive",
    });
    expect(out).toEqual({ id: "e1", playStyle: "offensive" });
    expect(prisma.nflFantasyEntry.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { playStyle: "offensive" },
      select: { id: true, playStyle: true },
    });
  });

  it("rejette un style inconnu (INVALID_STARTERS)", async () => {
    await expect(
      updateEntryPlayStyle({ entryId: "e1", playStyle: "chaos" }),
    ).rejects.toThrow(/Style de jeu inconnu/);
  });

  it("ENTRY_NOT_FOUND si entry absente", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue(null);
    await expect(
      updateEntryPlayStyle({ entryId: "missing", playStyle: "defensive" }),
    ).rejects.toThrow(/introuvable/);
  });

  it("LINEUP_LOCKED si une semaine verrouillee est en attente de resolution", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({
      id: "e1",
    } as never);
    vi.mocked(prisma.nflFantasyLineup.findFirst).mockResolvedValue({
      id: "l1",
    } as never);
    await expect(
      updateEntryPlayStyle({ entryId: "e1", playStyle: "defensive" }),
    ).rejects.toThrow(/non modifiable/);
  });
});

describe("NflFantasyLineupError", () => {
  it("preserve code + name", () => {
    const err = new NflFantasyLineupError("LINEUP_LOCKED", "boom");
    expect(err.code).toBe("LINEUP_LOCKED");
    expect(err.name).toBe("NflFantasyLineupError");
  });
});
