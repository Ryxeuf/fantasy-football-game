/**
 * S26.6d — Tests du service `getCoachThemedChampionships`.
 *
 * Calcule les badges "Champion {Theme} {YYYY}" d'un coach en parcourant
 * les saisons LeagueSeason avec `theme!=null` et `status='completed'`,
 * en designant le 1er du classement (computeSeasonStandings).
 *
 * Foundation pour S26.6d (badge profil champion). L'API + UI viendront
 * dans les sous-taches suivantes.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeason: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("./league", () => ({
  computeSeasonStandings: vi.fn(),
}));

import { prisma } from "../prisma";
import { computeSeasonStandings } from "./league";
import { getCoachThemedChampionships } from "./coach-championships";

const mockPrisma = prisma as unknown as {
  leagueSeason: { findMany: ReturnType<typeof vi.fn> };
};
const mockCompute = computeSeasonStandings as unknown as ReturnType<
  typeof vi.fn
>;

function makeStandings(
  ownerIds: string[],
): Array<{ ownerId: string; teamName: string; points: number }> {
  return ownerIds.map((ownerId, i) => ({
    ownerId,
    teamName: `team-${i + 1}`,
    points: 100 - i,
  }));
}

describe("getCoachThemedChampionships (S26.6d)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne une liste vide quand le coach n'a aucun titre thematique", async () => {
    mockPrisma.leagueSeason.findMany.mockResolvedValue([]);
    const r = await getCoachThemedChampionships("user-1");
    expect(r).toEqual([]);
  });

  it("retourne le badge correctement formatte quand l'utilisateur est 1er", async () => {
    mockPrisma.leagueSeason.findMany.mockResolvedValue([
      {
        id: "season-skaven-2026",
        theme: "skaven_cup",
        themeYear: 2026,
        leagueId: "lg-1",
        league: { id: "lg-1", name: "Skaven League" },
      },
    ]);
    mockCompute.mockResolvedValueOnce(makeStandings(["user-1", "user-2"]));

    const r = await getCoachThemedChampionships("user-1");

    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      seasonId: "season-skaven-2026",
      theme: "skaven_cup",
      themeYear: 2026,
      label: "Champion Skaven Cup 2026",
      leagueId: "lg-1",
      leagueName: "Skaven League",
    });
  });

  it("ignore les saisons ou l'utilisateur n'est pas 1er", async () => {
    mockPrisma.leagueSeason.findMany.mockResolvedValue([
      {
        id: "season-1",
        theme: "skaven_cup",
        themeYear: 2026,
        leagueId: "lg-1",
        league: { id: "lg-1", name: "L1" },
      },
    ]);
    mockCompute.mockResolvedValueOnce(makeStandings(["other-user", "user-1"]));

    const r = await getCoachThemedChampionships("user-1");
    expect(r).toEqual([]);
  });

  it("ordonne les badges par themeYear DESC puis par theme alphabetique", async () => {
    mockPrisma.leagueSeason.findMany.mockResolvedValue([
      {
        id: "s-2025",
        theme: "skaven_cup",
        themeYear: 2025,
        leagueId: "lg-a",
        league: { id: "lg-a", name: "A" },
      },
      {
        id: "s-2026-nordic",
        theme: "nordic_challenge",
        themeYear: 2026,
        leagueId: "lg-b",
        league: { id: "lg-b", name: "B" },
      },
      {
        id: "s-2026-skaven",
        theme: "skaven_cup",
        themeYear: 2026,
        leagueId: "lg-c",
        league: { id: "lg-c", name: "C" },
      },
    ]);
    mockCompute.mockResolvedValue(makeStandings(["user-1"]));

    const r = await getCoachThemedChampionships("user-1");

    expect(r.map((b) => b.label)).toEqual([
      "Champion Nordic Challenge 2026",
      "Champion Skaven Cup 2026",
      "Champion Skaven Cup 2025",
    ]);
  });

  it("ignore les saisons dont le theme n'est pas dans le catalogue (forward-compat)", async () => {
    mockPrisma.leagueSeason.findMany.mockResolvedValue([
      {
        id: "s-deprecated",
        theme: "ghost_league",
        themeYear: 2026,
        leagueId: "lg-x",
        league: { id: "lg-x", name: "X" },
      },
    ]);
    mockCompute.mockResolvedValue(makeStandings(["user-1"]));

    const r = await getCoachThemedChampionships("user-1");
    expect(r).toEqual([]);
  });

  it("ne crashe pas si computeSeasonStandings retourne une liste vide", async () => {
    mockPrisma.leagueSeason.findMany.mockResolvedValue([
      {
        id: "s-empty",
        theme: "skaven_cup",
        themeYear: 2026,
        leagueId: "lg-1",
        league: { id: "lg-1", name: "L1" },
      },
    ]);
    mockCompute.mockResolvedValue([]);

    const r = await getCoachThemedChampionships("user-1");
    expect(r).toEqual([]);
  });

  it("filtre Prisma : status=completed AND theme NOT null AND themeYear NOT null", async () => {
    mockPrisma.leagueSeason.findMany.mockResolvedValue([]);
    await getCoachThemedChampionships("user-1");
    expect(mockPrisma.leagueSeason.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "completed",
          theme: { not: null },
          themeYear: { not: null },
        }),
      }),
    );
  });

  it("retourne tableau vide pour userId vide ou whitespace (defense en profondeur)", async () => {
    expect(await getCoachThemedChampionships("")).toEqual([]);
    expect(await getCoachThemedChampionships("   ")).toEqual([]);
    expect(mockPrisma.leagueSeason.findMany).not.toHaveBeenCalled();
  });
});
