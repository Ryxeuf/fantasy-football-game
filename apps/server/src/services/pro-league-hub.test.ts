/**
 * Sprint Pro League lot 1.C.1 — Tests pro-league-hub service.
 *
 * Mocks `prisma` pour valider la sélection prio in_progress > completed,
 * le choix du round courant, et la mise en forme des entités.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeague: { findUnique: vi.fn() },
    proLeagueSeason: { findFirst: vi.fn() },
    proLeagueRound: { findFirst: vi.fn() },
    proLeagueMatch: { findMany: vi.fn() },
    proLeagueStandings: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";

import {
  ProLeagueNotFoundError,
  getProLeagueHubSnapshot,
} from "./pro-league-hub";

interface MockedPrisma {
  proLeague: { findUnique: ReturnType<typeof vi.fn> };
  proLeagueSeason: { findFirst: ReturnType<typeof vi.fn> };
  proLeagueRound: { findFirst: ReturnType<typeof vi.fn> };
  proLeagueMatch: { findMany: ReturnType<typeof vi.fn> };
  proLeagueStandings: { findMany: ReturnType<typeof vi.fn> };
}

const mocked = prisma as unknown as MockedPrisma;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getProLeagueHubSnapshot — sprint 1.C.1", () => {
  it("throw ProLeagueNotFoundError si la ligue n'existe pas", async () => {
    mocked.proLeague.findUnique.mockResolvedValue(null);
    await expect(getProLeagueHubSnapshot()).rejects.toThrow(
      ProLeagueNotFoundError,
    );
  });

  it("renvoie league + season=null + listes vides si pas de saison", async () => {
    mocked.proLeague.findUnique.mockResolvedValue({
      slug: "old-world-league",
      name: "Old World League",
      description: "test",
      branding: { motto: "x" },
    });
    mocked.proLeagueSeason.findFirst.mockResolvedValue(null);

    const out = await getProLeagueHubSnapshot();
    expect(out.league.slug).toBe("old-world-league");
    expect(out.season).toBeNull();
    expect(out.currentRound).toBeNull();
    expect(out.nextMatches).toEqual([]);
    expect(out.standings).toEqual([]);
  });

  it("priorise une saison in_progress sur une saison completed", async () => {
    mocked.proLeague.findUnique.mockResolvedValue({
      slug: "old-world-league",
      name: "Old World League",
      description: null,
      branding: null,
    });
    // Premier appel = recherche in_progress.
    mocked.proLeagueSeason.findFirst.mockResolvedValueOnce({
      id: "s_active",
      year: 2026,
      status: "in_progress",
      engineVer: "0.13.0",
      startsAt: new Date("2026-09-01T00:00:00Z"),
      endsAt: null,
    });
    mocked.proLeagueRound.findFirst.mockResolvedValueOnce(null);
    mocked.proLeagueRound.findFirst.mockResolvedValueOnce(null);
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    mocked.proLeagueStandings.findMany.mockResolvedValue([]);

    const out = await getProLeagueHubSnapshot();
    expect(out.season?.id).toBe("s_active");
    expect(out.season?.status).toBe("in_progress");
    // Le 2e fallback (completed) n'est pas appelé puisque in_progress trouvé.
    expect(mocked.proLeagueSeason.findFirst).toHaveBeenCalledTimes(1);
  });

  it("fallback sur saison completed si pas d'in_progress", async () => {
    mocked.proLeague.findUnique.mockResolvedValue({
      slug: "old-world-league",
      name: "Old World League",
      description: null,
      branding: null,
    });
    mocked.proLeagueSeason.findFirst
      .mockResolvedValueOnce(null) // pas d'in_progress
      .mockResolvedValueOnce({
        id: "s_done",
        year: 2025,
        status: "completed",
        engineVer: "0.12.0",
        startsAt: null,
        endsAt: null,
      });
    mocked.proLeagueRound.findFirst.mockResolvedValue(null);
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    mocked.proLeagueStandings.findMany.mockResolvedValue([]);

    const out = await getProLeagueHubSnapshot();
    expect(out.season?.id).toBe("s_done");
    expect(out.season?.status).toBe("completed");
  });

  it("formate les nextMatches en string ISO + slugs équipes", async () => {
    mocked.proLeague.findUnique.mockResolvedValue({
      slug: "old-world-league",
      name: "Old World League",
      description: null,
      branding: null,
    });
    mocked.proLeagueSeason.findFirst.mockResolvedValue({
      id: "s1",
      year: 2026,
      status: "in_progress",
      engineVer: "0.13.0",
      startsAt: null,
      endsAt: null,
    });
    mocked.proLeagueRound.findFirst.mockResolvedValueOnce({
      id: "r1",
      roundNumber: 3,
      status: "pending",
      scheduledAt: new Date("2026-09-15T21:00:00Z"),
    });
    const scheduledAt = new Date("2026-09-15T21:00:00Z");
    mocked.proLeagueMatch.findMany.mockResolvedValue([
      {
        id: "m1",
        status: "scheduled",
        scheduledAt,
        scoreHome: null,
        scoreAway: null,
        outcome: null,
        round: { roundNumber: 3 },
        homeTeam: {
          slug: "pit-smashers",
          name: "Smashers",
          city: "Pittsburgh",
          primaryColor: "#000000",
          secondaryColor: "#FFB612",
        },
        awayTeam: {
          slug: "kc-soaring-hawks",
          name: "Soaring Hawks",
          city: "Kansas City",
          primaryColor: "#E31837",
          secondaryColor: "#FFB81C",
        },
      },
    ]);
    mocked.proLeagueStandings.findMany.mockResolvedValue([]);

    const out = await getProLeagueHubSnapshot();
    expect(out.nextMatches).toHaveLength(1);
    const m = out.nextMatches[0];
    expect(m.id).toBe("m1");
    expect(m.roundNumber).toBe(3);
    expect(m.homeTeam.slug).toBe("pit-smashers");
    expect(m.awayTeam.slug).toBe("kc-soaring-hawks");
    expect(m.scheduledAt).toBe(scheduledAt.toISOString());
    expect(out.currentRound?.roundNumber).toBe(3);
  });

  it("formate les standings en plat (sans nesting team)", async () => {
    mocked.proLeague.findUnique.mockResolvedValue({
      slug: "old-world-league",
      name: "Old World League",
      description: null,
      branding: null,
    });
    mocked.proLeagueSeason.findFirst.mockResolvedValue({
      id: "s1",
      year: 2026,
      status: "in_progress",
      engineVer: "0.13.0",
      startsAt: null,
      endsAt: null,
    });
    mocked.proLeagueRound.findFirst.mockResolvedValue(null);
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    mocked.proLeagueStandings.findMany.mockResolvedValue([
      {
        played: 5,
        wins: 4,
        draws: 0,
        losses: 1,
        points: 12,
        tdFor: 14,
        tdAgainst: 6,
        team: {
          slug: "buf-snow-ogres",
          name: "Snow Ogres",
          city: "Buffalo",
        },
      },
    ]);

    const out = await getProLeagueHubSnapshot();
    expect(out.standings).toHaveLength(1);
    const s = out.standings[0];
    expect(s.teamSlug).toBe("buf-snow-ogres");
    expect(s.teamName).toBe("Snow Ogres");
    expect(s.points).toBe(12);
    expect(s.tdFor).toBe(14);
  });
});
