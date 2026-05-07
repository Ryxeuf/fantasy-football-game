import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeague: { findUnique: vi.fn() },
    proLeagueSeason: { findFirst: vi.fn() },
    proLeagueStandings: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  ProLeagueStandingsNotFoundError,
  getProLeagueCurrentStandings,
} from "./pro-league-standings";

interface MockedPrisma {
  proLeague: { findUnique: ReturnType<typeof vi.fn> };
  proLeagueSeason: { findFirst: ReturnType<typeof vi.fn> };
  proLeagueStandings: { findMany: ReturnType<typeof vi.fn> };
}

const mocked = prisma as unknown as MockedPrisma;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getProLeagueCurrentStandings — sprint 1.C.5", () => {
  it("404 si la ligue n'existe pas", async () => {
    mocked.proLeague.findUnique.mockResolvedValue(null);
    await expect(getProLeagueCurrentStandings()).rejects.toThrow(
      ProLeagueStandingsNotFoundError,
    );
  });

  it("404 si aucune saison disponible", async () => {
    mocked.proLeague.findUnique.mockResolvedValue({ slug: "old-world-league" });
    mocked.proLeagueSeason.findFirst.mockResolvedValue(null);
    await expect(getProLeagueCurrentStandings()).rejects.toThrow(
      /Aucune saison/i,
    );
  });

  it("calcule le rang (1-based) et les diffs TD/cas", async () => {
    mocked.proLeague.findUnique.mockResolvedValue({ slug: "old-world-league" });
    mocked.proLeagueSeason.findFirst.mockResolvedValue({
      id: "s1",
      year: 2026,
      status: "in_progress",
    });
    mocked.proLeagueStandings.findMany.mockResolvedValue([
      {
        played: 5,
        wins: 4,
        draws: 0,
        losses: 1,
        points: 12,
        tdFor: 14,
        tdAgainst: 6,
        casualtiesFor: 3,
        casualtiesAgainst: 1,
        form: '["W","W","L","W","W"]',
        team: {
          slug: "buf-snow-ogres",
          name: "Snow Ogres",
          city: "Buffalo",
          race: "Ogre",
          primaryColor: "#00338D",
          secondaryColor: "#C60C30",
        },
      },
      {
        played: 5,
        wins: 0,
        draws: 1,
        losses: 4,
        points: 1,
        tdFor: 4,
        tdAgainst: 12,
        casualtiesFor: 0,
        casualtiesAgainst: 5,
        form: '["L","D","L","L","L"]',
        team: {
          slug: "gb-cheese-halflings",
          name: "Cheese Halflings",
          city: "Green Bay",
          race: "Halfling",
          primaryColor: "#203731",
          secondaryColor: "#FFB612",
        },
      },
    ]);

    const out = await getProLeagueCurrentStandings();
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0].rank).toBe(1);
    expect(out.rows[0].team.slug).toBe("buf-snow-ogres");
    expect(out.rows[0].tdDiff).toBe(8);
    expect(out.rows[0].casualtiesDiff).toBe(2);
    expect(out.rows[0].form).toEqual(["W", "W", "L", "W", "W"]);
    expect(out.rows[1].rank).toBe(2);
    expect(out.rows[1].tdDiff).toBe(-8);
    expect(out.rows[1].form).toEqual(["L", "D", "L", "L", "L"]);
  });

  it("parse form depuis array natif sqlite (mirror)", async () => {
    mocked.proLeague.findUnique.mockResolvedValue({ slug: "old-world-league" });
    mocked.proLeagueSeason.findFirst.mockResolvedValue({
      id: "s1",
      year: 2026,
      status: "in_progress",
    });
    mocked.proLeagueStandings.findMany.mockResolvedValue([
      {
        played: 1,
        wins: 1,
        draws: 0,
        losses: 0,
        points: 3,
        tdFor: 2,
        tdAgainst: 1,
        casualtiesFor: 1,
        casualtiesAgainst: 0,
        form: ["W"], // postgres JSON-natif (pas string)
        team: {
          slug: "pit-smashers",
          name: "Smashers",
          city: "Pittsburgh",
          race: "Orc",
          primaryColor: "#000000",
          secondaryColor: "#FFB612",
        },
      },
    ]);
    const out = await getProLeagueCurrentStandings();
    expect(out.rows[0].form).toEqual(["W"]);
  });

  it("retourne form=[] si la valeur est invalide ou vide", async () => {
    mocked.proLeague.findUnique.mockResolvedValue({ slug: "old-world-league" });
    mocked.proLeagueSeason.findFirst.mockResolvedValue({
      id: "s1",
      year: 2026,
      status: "in_progress",
    });
    mocked.proLeagueStandings.findMany.mockResolvedValue([
      {
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        tdFor: 0,
        tdAgainst: 0,
        casualtiesFor: 0,
        casualtiesAgainst: 0,
        form: "garbage-not-json",
        team: {
          slug: "x",
          name: "X",
          city: "X",
          race: "X",
          primaryColor: null,
          secondaryColor: null,
        },
      },
    ]);
    const out = await getProLeagueCurrentStandings();
    expect(out.rows[0].form).toEqual([]);
  });
});
