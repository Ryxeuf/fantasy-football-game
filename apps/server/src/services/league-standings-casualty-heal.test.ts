/**
 * Le classement d'une saison rattrape les sorties persistées sous l'ancienne
 * règle AVANT de lire les compteurs — sinon il servirait le « 5 sorties »
 * d'une feuille qui, relue, en annonce 4.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeason: { findUnique: vi.fn() },
    leagueParticipant: { findMany: vi.fn() },
    leaguePairing: { groupBy: vi.fn(), findMany: vi.fn() },
    leagueMatchEvent: { groupBy: vi.fn() },
  },
}));

vi.mock("./league-season-casualty-heal", () => ({
  healSeasonCasualties: vi.fn(),
}));

import { prisma } from "../prisma";
import { healSeasonCasualties } from "./league-season-casualty-heal";
import { computeSeasonStandings } from "./league";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
const mockHeal = vi.mocked(healSeasonCasualties);

function participant(id: string, casualtiesFor: number) {
  return {
    id,
    teamId: `${id}-team`,
    seasonElo: 1000,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    touchdownsFor: 0,
    touchdownsAgainst: 0,
    casualtiesFor,
    casualtiesAgainst: 0,
    status: "active",
    poolId: null,
    team: {
      id: `${id}-team`,
      name: id,
      roster: "humans",
      owner: { id: `${id}-owner`, coachName: null },
    },
  };
}

describe("computeSeasonStandings — rattrapage des sorties", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "S1",
      league: { tieBreakRules: null, forfeitPoints: 0 },
    });
    mockPrisma.leagueParticipant.findMany.mockResolvedValue([
      participant("p1", 4),
    ]);
    mockPrisma.leaguePairing.groupBy.mockResolvedValue([]);
    mockPrisma.leaguePairing.findMany.mockResolvedValue([]);
    mockPrisma.leagueMatchEvent.groupBy.mockResolvedValue([]);
    mockHeal.mockResolvedValue({ scanned: 0, repaired: 0, marked: 0 });
  });

  it("rattrape la saison AVANT de lire les compteurs des participants", async () => {
    const order: string[] = [];
    mockHeal.mockImplementation(async () => {
      order.push("heal");
      return { scanned: 1, repaired: 1, marked: 1 };
    });
    mockPrisma.leagueParticipant.findMany.mockImplementation(async () => {
      order.push("participants");
      return [participant("p1", 4)];
    });

    const rows = await computeSeasonStandings("S1");

    expect(mockHeal).toHaveBeenCalledWith("S1");
    expect(order).toEqual(["heal", "participants"]);
    expect(rows[0]?.casualtiesFor).toBe(4);
  });

  // Un classement se sert toujours : le rattrapage est un confort, pas une
  // dépendance.
  it("sert le classement même si le rattrapage lève", async () => {
    mockHeal.mockRejectedValue(new Error("boom"));
    const rows = await computeSeasonStandings("S1");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.casualtiesFor).toBe(4);
  });
});
