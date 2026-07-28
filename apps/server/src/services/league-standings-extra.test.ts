/**
 * F1 — Tests des colonnes étendues du classement (Diff Sor / For / P /
 * Agr / SP / Exclu) : intégration dans `computeSeasonStandings` et
 * helper pur `attachExtraStats`.
 *
 * Prisma est mocké (pas d'engine requis).
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

import { prisma } from "../prisma";
import {
  computeSeasonStandings,
  attachExtraStats,
  type StandingRow,
} from "./league";
import { EMPTY_EXTRA_STATS } from "./league-standings-stats";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

function participant(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    teamId: `${id}-team`,
    seasonElo: 1000,
    wins: 1,
    draws: 0,
    losses: 0,
    points: 3,
    touchdownsFor: 2,
    touchdownsAgainst: 1,
    casualtiesFor: 3,
    casualtiesAgainst: 1,
    status: "active",
    poolId: null,
    team: {
      id: `${id}-team`,
      name: id,
      roster: "humans",
      owner: { id: `${id}-owner`, coachName: null },
    },
    ...over,
  };
}

describe("F1 — computeSeasonStandings : colonnes étendues", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.leaguePairing.groupBy.mockResolvedValue([]);
  });

  it("expose Diff Sor, For, P, Agr, SP et Exclu par participant", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s1",
      league: { tieBreakRules: null, forfeitPoints: -1 },
    });
    mockPrisma.leagueParticipant.findMany.mockResolvedValue([
      participant("p1"),
      participant("p2"),
    ]);
    mockPrisma.leaguePairing.findMany.mockResolvedValue([
      {
        status: "played",
        homeParticipantId: "p1",
        awayParticipantId: "p2",
        matchSheet: { id: "sheet-1" },
      },
      {
        status: "forfeit_away",
        homeParticipantId: "p1",
        awayParticipantId: "p2",
        matchSheet: null,
      },
    ]);
    mockPrisma.leagueMatchEvent.groupBy.mockResolvedValue([
      {
        matchSheetId: "sheet-1",
        kind: "pass_complete",
        team: "home",
        _count: { _all: 6 },
      },
      {
        matchSheetId: "sheet-1",
        kind: "aggression",
        team: "home",
        _count: { _all: 2 },
      },
      {
        matchSheetId: "sheet-1",
        kind: "crowd_surge",
        team: "away",
        _count: { _all: 1 },
      },
      {
        matchSheetId: "sheet-1",
        kind: "expulsion",
        team: "away",
        _count: { _all: 1 },
      },
    ]);

    const rows = await computeSeasonStandings("s1");
    const p1 = rows.find((r) => r.participantId === "p1");
    const p2 = rows.find((r) => r.participantId === "p2");

    expect(p1).toMatchObject({
      casualtyDifference: 2, // 3 - 1
      forfeits: 0,
      forfeitPoints: 0,
      passes: 6,
      aggressions: 2,
      crowdSurges: 0,
      expulsions: 0,
    });
    expect(p2).toMatchObject({
      casualtyDifference: 2,
      forfeits: 1,
      forfeitPoints: -1, // 1 forfait × barème -1
      passes: 0,
      aggressions: 0,
      crowdSurges: 1,
      expulsions: 1,
    });
  });

  it("multiplie les forfaits par le barème `League.forfeitPoints`", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s1",
      league: { tieBreakRules: null, forfeitPoints: -3 },
    });
    mockPrisma.leagueParticipant.findMany.mockResolvedValue([
      participant("p1"),
    ]);
    mockPrisma.leaguePairing.findMany.mockResolvedValue([
      {
        status: "forfeit_home",
        homeParticipantId: "p1",
        awayParticipantId: "p2",
        matchSheet: null,
      },
      {
        status: "forfeit_home",
        homeParticipantId: "p1",
        awayParticipantId: "p2",
        matchSheet: null,
      },
    ]);
    mockPrisma.leagueMatchEvent.groupBy.mockResolvedValue([]);

    const rows = await computeSeasonStandings("s1");
    expect(rows[0].forfeits).toBe(2);
    expect(rows[0].forfeitPoints).toBe(-6);
  });

  it("n'interroge pas les events quand aucune feuille de match n'existe", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s1",
      league: { tieBreakRules: null, forfeitPoints: -1 },
    });
    mockPrisma.leagueParticipant.findMany.mockResolvedValue([
      participant("p1"),
    ]);
    mockPrisma.leaguePairing.findMany.mockResolvedValue([
      {
        status: "scheduled",
        homeParticipantId: "p1",
        awayParticipantId: "p2",
        matchSheet: null,
      },
    ]);

    const rows = await computeSeasonStandings("s1");
    expect(mockPrisma.leagueMatchEvent.groupBy).not.toHaveBeenCalled();
    expect(rows[0].passes).toBe(0);
  });

  it("retombe sur des colonnes à zéro si l'agrégation échoue (classement préservé)", async () => {
    mockPrisma.leagueSeason.findUnique.mockResolvedValue({
      id: "s1",
      league: { tieBreakRules: null, forfeitPoints: -1 },
    });
    mockPrisma.leagueParticipant.findMany.mockResolvedValue([
      participant("p1"),
    ]);
    mockPrisma.leaguePairing.findMany.mockRejectedValue(
      new Error("db down"),
    );

    const rows = await computeSeasonStandings("s1");
    expect(rows).toHaveLength(1);
    expect(rows[0].points).toBe(3);
    expect(rows[0].passes).toBe(0);
    expect(rows[0].forfeitPoints).toBe(0);
    expect(rows[0].casualtyDifference).toBe(2);
  });
});

describe("F1 — attachExtraStats (pur)", () => {
  const base = [
    {
      participantId: "p1",
      casualtiesFor: 5,
      casualtiesAgainst: 2,
    },
  ] as unknown as StandingRow[];

  it("calcule casualtyDifference et les points de forfait", () => {
    const out = attachExtraStats(
      base,
      new Map([["p1", { ...EMPTY_EXTRA_STATS, forfeits: 2, passes: 4 }]]),
      -1,
    );
    expect(out[0].casualtyDifference).toBe(3);
    expect(out[0].forfeits).toBe(2);
    expect(out[0].forfeitPoints).toBe(-2);
    expect(out[0].passes).toBe(4);
  });

  it("retombe à zéro quand le participant est absent de la map", () => {
    const out = attachExtraStats(base, new Map(), -1);
    expect(out[0]).toMatchObject({
      forfeits: 0,
      forfeitPoints: 0,
      passes: 0,
      aggressions: 0,
      crowdSurges: 0,
      expulsions: 0,
    });
  });

  it("est immutable (ne mute pas les lignes d'entrée)", () => {
    attachExtraStats(base, new Map(), -1);
    expect(base[0]).not.toHaveProperty("passes");
    expect(base[0]).not.toHaveProperty("casualtyDifference");
  });
});
