/**
 * S26 DoD — Tests du seeder de ligue thematique active.
 *
 * Objectif : avoir une ligue + une saison thematique active dans le
 * calendrier au moment du release. Le seeder est idempotent — on
 * peut le rejouer sans creer de doublons.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    league: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    leagueSeason: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leagueRound: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  seedThemedLeagueSeason,
  DEFAULT_THEMED_LEAGUE_NAME,
  resolveDefaultThemeForMonth,
} from "./themed-league";

const mockPrisma = prisma as unknown as {
  league: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  leagueSeason: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  leagueRound: {
    findMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
};

describe("resolveDefaultThemeForMonth (S26 DoD)", () => {
  it("renvoie skaven_cup en mars", () => {
    const t = resolveDefaultThemeForMonth(3);
    expect(t.slug).toBe("skaven_cup");
  });

  it("renvoie nordic_challenge en avril", () => {
    expect(resolveDefaultThemeForMonth(4).slug).toBe("nordic_challenge");
  });

  it("renvoie underworld_open en mai", () => {
    expect(resolveDefaultThemeForMonth(5).slug).toBe("underworld_open");
  });

  it("retombe sur le 1er theme du catalogue en dehors des mois canoniques", () => {
    const t = resolveDefaultThemeForMonth(11);
    expect(["skaven_cup", "nordic_challenge", "underworld_open"]).toContain(
      t.slug,
    );
  });
});

describe("seedThemedLeagueSeason (S26 DoD)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cree la ligue + saison thematique au premier appel", async () => {
    mockPrisma.league.findFirst.mockResolvedValue(null);
    mockPrisma.league.create.mockResolvedValue({
      id: "league-1",
      name: DEFAULT_THEMED_LEAGUE_NAME,
    });
    mockPrisma.leagueSeason.findFirst.mockResolvedValue(null);
    mockPrisma.leagueSeason.create.mockResolvedValue({
      id: "season-1",
      leagueId: "league-1",
      seasonNumber: 1,
      theme: "skaven_cup",
      themeYear: 2026,
      status: "scheduled",
    });
    mockPrisma.leagueRound.findMany.mockResolvedValue([]);
    mockPrisma.leagueRound.createMany.mockResolvedValue({ count: 0 });

    const out = await seedThemedLeagueSeason({
      creatorId: "admin-1",
      theme: "skaven_cup",
      themeYear: 2026,
    });

    expect(mockPrisma.league.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.leagueSeason.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leagueId: "league-1",
          theme: "skaven_cup",
          themeYear: 2026,
          status: "scheduled",
        }),
      }),
    );
    expect(out.created).toBe(true);
    expect(out.season.theme).toBe("skaven_cup");
  });

  it("est idempotent : second appel ne re-cree ni ligue ni saison", async () => {
    mockPrisma.league.findFirst.mockResolvedValue({
      id: "league-1",
      name: DEFAULT_THEMED_LEAGUE_NAME,
    });
    mockPrisma.leagueSeason.findFirst.mockResolvedValue({
      id: "season-1",
      leagueId: "league-1",
      seasonNumber: 1,
      theme: "skaven_cup",
      themeYear: 2026,
      status: "scheduled",
    });
    mockPrisma.leagueRound.findMany.mockResolvedValue([
      { roundNumber: 1 },
      { roundNumber: 2 },
    ]);

    const out = await seedThemedLeagueSeason({
      creatorId: "admin-1",
      theme: "skaven_cup",
      themeYear: 2026,
    });

    expect(mockPrisma.league.create).not.toHaveBeenCalled();
    expect(mockPrisma.leagueSeason.create).not.toHaveBeenCalled();
    expect(out.created).toBe(false);
  });

  it("rejette un theme inconnu", async () => {
    await expect(
      seedThemedLeagueSeason({
        creatorId: "admin-1",
        theme: "fake_theme" as unknown as "skaven_cup",
        themeYear: 2026,
      }),
    ).rejects.toThrow(/theme/i);
    expect(mockPrisma.league.create).not.toHaveBeenCalled();
  });

  it("rejette une annee invalide (negative ou non entiere)", async () => {
    await expect(
      seedThemedLeagueSeason({
        creatorId: "admin-1",
        theme: "skaven_cup",
        themeYear: -1,
      }),
    ).rejects.toThrow(/themeYear/i);
    await expect(
      seedThemedLeagueSeason({
        creatorId: "admin-1",
        theme: "skaven_cup",
        themeYear: 2026.5,
      }),
    ).rejects.toThrow(/themeYear/i);
  });

  it("genere les rounds manquants quand la saison existe deja sans rounds", async () => {
    mockPrisma.league.findFirst.mockResolvedValue({
      id: "league-1",
      name: DEFAULT_THEMED_LEAGUE_NAME,
    });
    mockPrisma.leagueSeason.findFirst.mockResolvedValue({
      id: "season-1",
      leagueId: "league-1",
      seasonNumber: 1,
      theme: "skaven_cup",
      themeYear: 2026,
      status: "scheduled",
    });
    mockPrisma.leagueRound.findMany.mockResolvedValue([]);
    mockPrisma.leagueRound.createMany.mockResolvedValue({ count: 4 });

    await seedThemedLeagueSeason({
      creatorId: "admin-1",
      theme: "skaven_cup",
      themeYear: 2026,
      participantCount: 4,
    });

    expect(mockPrisma.leagueRound.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            seasonId: "season-1",
            roundNumber: 1,
          }),
        ]),
      }),
    );
  });
});
