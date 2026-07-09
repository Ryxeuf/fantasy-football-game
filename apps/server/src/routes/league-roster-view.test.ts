/**
 * FR20 — roster de ligue en lecture seule enrichi des stats par joueur
 * (TD, éliminations, passes, interceptions, agressions), des blessures
 * durables (séquelles + réductions de caractéristiques) et de la
 * disponibilité pour le prochain match (`missNextMatch`).
 *
 * Handler unitaire : prisma + getTeamForEdit mockés, req/res à la main
 * (même pattern que league.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    league: { findUnique: vi.fn() },
    team: { findUnique: vi.fn() },
    roster: { findFirst: vi.fn() },
    teamPlayer: { findMany: vi.fn() },
    leagueMatchEvent: { findMany: vi.fn() },
  },
}));

vi.mock("../services/commissioner-team-edit", () => ({
  adjustPlayerSpp: vi.fn(),
  addPlayerSkill: vi.fn(),
  removePlayerSkill: vi.fn(),
  adjustCharacteristic: vi.fn(),
  updatePlayerIdentity: vi.fn(),
  adjustTreasury: vi.fn(),
  listAuditLog: vi.fn(),
  getTeamForEdit: vi.fn(),
  CommissionerEditError: class CommissionerEditError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "CommissionerEditError";
    }
  },
}));

import type { Response } from "express";
import { prisma } from "../prisma";
import { getTeamForEdit } from "../services/commissioner-team-edit";
import { handleGetLeagueTeamRoster } from "./league";
import type { AuthenticatedRequest } from "../middleware/authUser";

const mockPrisma = prisma as unknown as {
  league: { findUnique: ReturnType<typeof vi.fn> };
  team: { findUnique: ReturnType<typeof vi.fn> };
  roster: { findFirst: ReturnType<typeof vi.fn> };
  teamPlayer: { findMany: ReturnType<typeof vi.fn> };
  leagueMatchEvent: { findMany: ReturnType<typeof vi.fn> };
};
const mockGetTeamForEdit = getTeamForEdit as ReturnType<typeof vi.fn>;

function createRes() {
  const res: Partial<Response> & { statusCode?: number; payload?: unknown } =
    {};
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = vi.fn().mockImplementation((payload: unknown) => {
    res.payload = payload;
    return res as Response;
  });
  return res as Response & { statusCode?: number; payload?: unknown };
}

function createReq(): AuthenticatedRequest {
  return {
    user: { id: "creator-1" },
    params: { leagueId: "L1", teamId: "T1" },
  } as unknown as AuthenticatedRequest;
}

describe("handleGetLeagueTeamRoster — FR20 stats joueurs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Viewer = créateur de la ligue.
    mockPrisma.league.findUnique.mockResolvedValue({ creatorId: "creator-1" });
    // Méta d'équipe (2e findUnique du handler).
    mockPrisma.team.findUnique.mockResolvedValue({
      teamValue: 1_000_000,
      currentValue: 950_000,
      rerolls: 2,
      cheerleaders: 0,
      assistants: 1,
      apothecary: true,
      dedicatedFans: 3,
      owner: { coachName: "Sepp" },
    });
    mockPrisma.roster.findFirst.mockResolvedValue(null);
    mockGetTeamForEdit.mockResolvedValue({
      team: {
        id: "T1",
        name: "Reikland Reavers",
        roster: "human",
        treasury: 40_000,
        ruleset: "season_3",
      },
      players: [
        {
          id: "pl1",
          name: "Griff",
          position: "human_blitzer",
          number: 7,
          ma: 7,
          st: 3,
          ag: 3,
          pa: 4,
          av: 9,
          skills: "block",
          spp: 12,
          dead: false,
        },
        {
          id: "pl2",
          name: "Boris",
          position: "human_lineman",
          number: 3,
          ma: 6,
          st: 3,
          ag: 3,
          pa: 4,
          av: 9,
          skills: "",
          spp: 2,
          dead: false,
        },
      ],
      accessByPosition: {},
    });
    mockPrisma.teamPlayer.findMany.mockResolvedValue([
      {
        id: "pl1",
        totalTouchdowns: 4,
        totalCasualties: 2,
        totalCompletions: 5,
        totalInterceptions: 1,
        matchesPlayed: 6,
        missNextMatch: false,
        nigglingInjuries: 0,
        maReduction: 0,
        stReduction: 0,
        agReduction: 0,
        paReduction: 0,
        avReduction: 0,
      },
      {
        id: "pl2",
        totalTouchdowns: 0,
        totalCasualties: 0,
        totalCompletions: 0,
        totalInterceptions: 0,
        matchesPlayed: 5,
        missNextMatch: true,
        nigglingInjuries: 2,
        maReduction: 1,
        stReduction: 0,
        agReduction: 0,
        paReduction: 0,
        avReduction: 1,
      },
    ]);
    mockPrisma.leagueMatchEvent.findMany.mockResolvedValue([
      { actorPlayerId: "pl1" },
      { actorPlayerId: "pl1" },
      { actorPlayerId: "pl2" },
    ]);
  });

  it("enrichit chaque joueur des compteurs, agressions, blessures et dispo", async () => {
    const res = createRes();
    await handleGetLeagueTeamRoster(createReq(), res);

    expect(res.statusCode ?? 200).toBe(200);
    const payload = res.payload as {
      success: boolean;
      data: { players: Array<Record<string, unknown>> };
    };
    expect(payload.success).toBe(true);

    const [griff, boris] = payload.data.players;
    expect(griff).toMatchObject({
      id: "pl1",
      totalTouchdowns: 4,
      totalCasualties: 2,
      totalCompletions: 5,
      totalInterceptions: 1,
      aggressions: 2,
      matchesPlayed: 6,
      missNextMatch: false,
      nigglingInjuries: 0,
    });
    expect(boris).toMatchObject({
      id: "pl2",
      aggressions: 1,
      missNextMatch: true,
      nigglingInjuries: 2,
      statReductions: { ma: 1, st: 0, ag: 0, pa: 0, av: 1 },
    });
    // Le filtre d'events ne compte que les agressions de la ligue.
    expect(mockPrisma.leagueMatchEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: "aggression",
          matchSheet: { pairing: { round: { season: { leagueId: "L1" } } } },
        }),
      }),
    );
  });

  it("tolère un modèle d'events absent (SQLite tests) : agressions à 0", async () => {
    mockPrisma.leagueMatchEvent.findMany.mockRejectedValue(
      new Error("no such table"),
    );
    const res = createRes();
    await handleGetLeagueTeamRoster(createReq(), res);

    const payload = res.payload as {
      data: { players: Array<{ aggressions: number }> };
    };
    expect(payload.data.players[0].aggressions).toBe(0);
    expect(payload.data.players[1].aggressions).toBe(0);
  });
});
