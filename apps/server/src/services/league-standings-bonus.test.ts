/**
 * E2 — Tests de l'agrégation des points bonus dans le classement
 * (`computeSeasonStandings` + helper pur `attachBonusPoints`).
 *
 * Prisma est mocké (pas d'engine requis). On vérifie que les snapshots
 * `LeaguePairing.bonusPointsHome/Away` sont cumulés par participant et
 * exposés sur `StandingRow.bonusPoints`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeason: { findUnique: vi.fn() },
    leagueParticipant: { findMany: vi.fn() },
    leaguePairing: { groupBy: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  computeSeasonStandings,
  attachBonusPoints,
  type StandingRow,
} from "./league";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

interface ParticipantOverrides {
  id: string;
  name?: string;
  points?: number;
}

function participant(over: ParticipantOverrides) {
  return {
    id: over.id,
    teamId: `${over.id}-team`,
    seasonElo: 1000,
    wins: 0,
    draws: 0,
    losses: 0,
    points: over.points ?? 0,
    touchdownsFor: 0,
    touchdownsAgainst: 0,
    casualtiesFor: 0,
    casualtiesAgainst: 0,
    status: "active",
    poolId: null,
    team: {
      id: `${over.id}-team`,
      name: over.name ?? over.id,
      roster: "humans",
      owner: { id: `${over.id}-owner`, coachName: null },
    },
  };
}

describe("E2 — computeSeasonStandings bonus aggregation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("cumule les bonus home + away par participant sur StandingRow.bonusPoints", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s1",
      league: { tieBreakRules: null },
    });
    mockPrisma.leagueParticipant.findMany.mockResolvedValue([
      participant({ id: "p1", name: "Alpha", points: 10 }),
      participant({ id: "p2", name: "Beta", points: 7 }),
      participant({ id: "p3", name: "Gamma", points: 4 }),
    ]);
    // Robuste à l'ordre d'invocation (les 2 groupBy tournent en parallèle).
    mockPrisma.leaguePairing.groupBy.mockImplementation(
      async (args: { by: string[] }) => {
        if (args.by[0] === "homeParticipantId") {
          return [
            { homeParticipantId: "p1", _sum: { bonusPointsHome: 2 } },
            { homeParticipantId: "p2", _sum: { bonusPointsHome: 0 } },
          ];
        }
        return [
          { awayParticipantId: "p1", _sum: { bonusPointsAway: 1 } },
          { awayParticipantId: "p3", _sum: { bonusPointsAway: 3 } },
        ];
      },
    );

    const rows = await computeSeasonStandings("s1");
    const byId = Object.fromEntries(
      rows.map((r) => [r.participantId, r.bonusPoints]),
    );
    expect(byId["p1"]).toBe(3); // 2 (home) + 1 (away)
    expect(byId["p2"]).toBe(0);
    expect(byId["p3"]).toBe(3); // 0 (home) + 3 (away)
    expect(mockPrisma.leaguePairing.groupBy).toHaveBeenCalledTimes(2);
  });

  it("ne lance aucune agrégation quand la saison n'a aucun participant", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s1",
      league: { tieBreakRules: null },
    });
    mockPrisma.leagueParticipant.findMany.mockResolvedValue([]);

    const rows = await computeSeasonStandings("s1");
    expect(rows).toEqual([]);
    expect(mockPrisma.leaguePairing.groupBy).not.toHaveBeenCalled();
  });

  it("traite _sum null (aucun pairing joué) comme 0", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s1",
      league: { tieBreakRules: null },
    });
    mockPrisma.leagueParticipant.findMany.mockResolvedValue([
      participant({ id: "p1", name: "Alpha", points: 0 }),
    ]);
    mockPrisma.leaguePairing.groupBy.mockImplementation(
      async (args: { by: string[] }) => {
        if (args.by[0] === "homeParticipantId") {
          return [{ homeParticipantId: "p1", _sum: { bonusPointsHome: null } }];
        }
        return [];
      },
    );

    const rows = await computeSeasonStandings("s1");
    expect(rows[0].bonusPoints).toBe(0);
  });
});

describe("E2 — attachBonusPoints (pur)", () => {
  it("associe le cumul, 0 si le participant est absent de la map", () => {
    const rows = [
      { participantId: "p1" },
      { participantId: "p2" },
    ] as unknown as StandingRow[];
    const out = attachBonusPoints(rows, new Map([["p1", 5]]));
    expect(out[0].bonusPoints).toBe(5);
    expect(out[1].bonusPoints).toBe(0);
  });

  it("est immutable (ne mute pas les lignes d'entrée)", () => {
    const rows = [{ participantId: "p1" }] as unknown as StandingRow[];
    attachBonusPoints(rows, new Map([["p1", 9]]));
    expect(rows[0]).not.toHaveProperty("bonusPoints");
  });
});
