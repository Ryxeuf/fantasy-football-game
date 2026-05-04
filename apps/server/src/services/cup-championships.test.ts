/**
 * S27.1d — Tests du service `getCoachCupChampionships`.
 *
 * Calcule les badges "Champion Nuffle Cup {Mois} {YYYY}" pour les
 * cups mensuelles `status='terminee'` ou `'archivee'` que le coach a
 * remporte (1er du computeCupStandings, vu via team.ownerId).
 *
 * Foundation pour le badge profil (analogue a S26.6d/e pour les
 * ligues thematiques).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    cup: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../cupScoring", () => ({
  computeCupStandings: vi.fn(),
}));

import { prisma } from "../prisma";
import { computeCupStandings } from "../cupScoring";
import { getCoachCupChampionships } from "./cup-championships";

const mockPrisma = prisma as unknown as {
  cup: { findMany: ReturnType<typeof vi.fn> };
};
const mockCompute = computeCupStandings as unknown as ReturnType<
  typeof vi.fn
>;

function makeCup(overrides: Record<string, unknown> = {}) {
  return {
    id: "cup-1",
    name: "Nuffle Cup Avril 2026",
    status: "terminee",
    monthlyYear: 2026,
    monthlyMonth: 4,
    participants: [
      {
        team: {
          id: "team-winner",
          name: "Winners",
          owner: { id: "user-1" },
        },
      },
      {
        team: {
          id: "team-loser",
          name: "Losers",
          owner: { id: "user-2" },
        },
      },
    ],
    localMatches: [],
    ...overrides,
  };
}

function makeStandings(rankedTeamIds: string[]) {
  return {
    teamStats: rankedTeamIds.map((teamId, i) => ({
      teamId,
      teamName: `team-${teamId}`,
      totalPoints: 1000 - i,
    })),
  };
}

describe("getCoachCupChampionships (S27.1d)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne tableau vide quand userId est vide ou whitespace", async () => {
    expect(await getCoachCupChampionships("")).toEqual([]);
    expect(await getCoachCupChampionships("   ")).toEqual([]);
    expect(mockPrisma.cup.findMany).not.toHaveBeenCalled();
  });

  it("retourne tableau vide quand le coach n'a aucun titre", async () => {
    mockPrisma.cup.findMany.mockResolvedValue([]);
    const r = await getCoachCupChampionships("user-1");
    expect(r).toEqual([]);
  });

  it("retourne le badge correctement formatte quand l'utilisateur est 1er", async () => {
    mockPrisma.cup.findMany.mockResolvedValue([makeCup()]);
    mockCompute.mockReturnValue(
      makeStandings(["team-winner", "team-loser"]),
    );

    const r = await getCoachCupChampionships("user-1");

    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      cupId: "cup-1",
      cupName: "Nuffle Cup Avril 2026",
      monthlyYear: 2026,
      monthlyMonth: 4,
      label: "Champion Nuffle Cup Avril 2026",
    });
  });

  it("ignore les cups ou l'utilisateur n'est pas 1er", async () => {
    mockPrisma.cup.findMany.mockResolvedValue([makeCup()]);
    mockCompute.mockReturnValue(
      makeStandings(["team-loser", "team-winner"]),
    );

    const r = await getCoachCupChampionships("user-1");
    expect(r).toEqual([]);
  });

  it("ordonne les badges par monthlyYear DESC puis monthlyMonth DESC", async () => {
    mockPrisma.cup.findMany.mockResolvedValue([
      makeCup({ id: "c-2025-12", monthlyYear: 2025, monthlyMonth: 12 }),
      makeCup({ id: "c-2026-04", monthlyYear: 2026, monthlyMonth: 4 }),
      makeCup({ id: "c-2026-01", monthlyYear: 2026, monthlyMonth: 1 }),
    ]);
    mockCompute.mockReturnValue(makeStandings(["team-winner"]));

    const r = await getCoachCupChampionships("user-1");

    expect(r.map((b) => b.cupId)).toEqual([
      "c-2026-04",
      "c-2026-01",
      "c-2025-12",
    ]);
  });

  it("ignore les cups sans participants ou sans standings", async () => {
    mockPrisma.cup.findMany.mockResolvedValue([
      makeCup({ id: "c-empty", participants: [] }),
    ]);
    mockCompute.mockReturnValue({ teamStats: [] });

    const r = await getCoachCupChampionships("user-1");
    expect(r).toEqual([]);
  });

  it("ignore les cups dont le slot mensuel est invalide (defense)", async () => {
    mockPrisma.cup.findMany.mockResolvedValue([
      makeCup({ id: "c-bad", monthlyYear: -1, monthlyMonth: 4 }),
      makeCup({ id: "c-bad-month", monthlyYear: 2026, monthlyMonth: 13 }),
    ]);
    mockCompute.mockReturnValue(makeStandings(["team-winner"]));

    const r = await getCoachCupChampionships("user-1");
    expect(r).toEqual([]);
  });

  it("filtre Prisma sur status terminee/archivee + monthlyYear/Month NOT NULL", async () => {
    mockPrisma.cup.findMany.mockResolvedValue([]);
    await getCoachCupChampionships("user-1");
    expect(mockPrisma.cup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["terminee", "archivee"] },
          monthlyYear: { not: null },
          monthlyMonth: { not: null },
        }),
      }),
    );
  });
});
