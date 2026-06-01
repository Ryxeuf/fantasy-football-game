/**
 * L.3 — Tests des routes API ligue (create / list / get / join /
 * schedule round / standings / withdraw).
 *
 * Les handlers sont unitaires : service et prisma mockes,
 * req/res faits a la main (comme middleware/authUser.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/league", () => ({
  createLeague: vi.fn(),
  createSeason: vi.fn(),
  addParticipant: vi.fn(),
  createRound: vi.fn(),
  listLeagues: vi.fn(),
  getLeagueById: vi.fn(),
  getSeasonById: vi.fn(),
  computeSeasonStandings: vi.fn(),
  isSeasonEloRanked: vi.fn(() => false),
  withdrawParticipant: vi.fn(),
  listThemedSeasons: vi.fn(),
  parseAllowedRosters: vi.fn((raw: string | null) =>
    raw ? (JSON.parse(raw) as string[]) : null,
  ),
}));

vi.mock("../prisma", () => ({
  prisma: {
    team: { findUnique: vi.fn() },
    league: { findUnique: vi.fn() },
    leagueSeason: { findUnique: vi.fn() },
  },
}));

import type { Request, Response } from "express";
import {
  createLeague,
  createSeason,
  addParticipant,
  createRound,
  listLeagues,
  getLeagueById,
  getSeasonById,
  computeSeasonStandings,
  withdrawParticipant,
  listThemedSeasons,
} from "../services/league";
import { prisma } from "../prisma";
import {
  handleCreateLeague,
  handleListLeagues,
  handleGetLeague,
  handleGetSeason,
  handleCreateSeason,
  handleJoinSeason,
  handleCreateRound,
  handleGetStandings,
  handleLeaveSeason,
  handleListThemes,
  handleListSeasonsByTheme,
} from "./league";
import type { AuthenticatedRequest } from "../middleware/authUser";

const mockService = {
  createLeague: createLeague as ReturnType<typeof vi.fn>,
  createSeason: createSeason as ReturnType<typeof vi.fn>,
  addParticipant: addParticipant as ReturnType<typeof vi.fn>,
  createRound: createRound as ReturnType<typeof vi.fn>,
  listLeagues: listLeagues as ReturnType<typeof vi.fn>,
  getLeagueById: getLeagueById as ReturnType<typeof vi.fn>,
  getSeasonById: getSeasonById as ReturnType<typeof vi.fn>,
  computeSeasonStandings: computeSeasonStandings as ReturnType<typeof vi.fn>,
  withdrawParticipant: withdrawParticipant as ReturnType<typeof vi.fn>,
  listThemedSeasons: listThemedSeasons as ReturnType<typeof vi.fn>,
};
const mockPrisma = prisma as unknown as {
  team: { findUnique: ReturnType<typeof vi.fn> };
  league: { findUnique: ReturnType<typeof vi.fn> };
};

function createRes() {
  const res: Partial<Response> & {
    statusCode?: number;
    payload?: unknown;
  } = {};
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

function createReq(
  overrides: Partial<AuthenticatedRequest> = {},
): AuthenticatedRequest {
  return {
    body: {},
    params: {},
    query: {},
    user: { id: "user-1", roles: ["user"] },
    ...overrides,
  } as AuthenticatedRequest;
}

describe("Route: POST /leagues (create)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a league with the authenticated user as creator", async () => {
    mockService.createLeague.mockResolvedValue({
      id: "league-1",
      name: "Open 5 Teams",
      creatorId: "user-1",
    });

    const req = createReq({ body: { name: "Open 5 Teams" } });
    const res = createRes();
    await handleCreateLeague(req, res);

    expect(mockService.createLeague).toHaveBeenCalledWith(
      expect.objectContaining({ creatorId: "user-1", name: "Open 5 Teams" }),
    );
    expect(res.statusCode).toBe(201);
    // S25.5e — sendSuccess wraps in { success, data }
    expect(res.payload).toMatchObject({
      success: true,
      data: expect.objectContaining({ id: "league-1" }),
    });
  });

  it("passes allowedRosters through to the service", async () => {
    mockService.createLeague.mockResolvedValue({ id: "league-2" });
    const req = createReq({
      body: {
        name: "Open 5",
        allowedRosters: ["skaven", "gnomes"],
        maxParticipants: 8,
      },
    });
    const res = createRes();
    await handleCreateLeague(req, res);
    expect(mockService.createLeague).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedRosters: ["skaven", "gnomes"],
        maxParticipants: 8,
      }),
    );
  });

  it("returns 400 when the service throws a domain error", async () => {
    mockService.createLeague.mockRejectedValue(new Error("nom obligatoire"));
    const req = createReq({ body: { name: " " } });
    const res = createRes();
    await handleCreateLeague(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({ error: expect.stringMatching(/nom/i) });
  });
});

describe("Route: GET /leagues (list)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the list of leagues with publicOnly default", async () => {
    // S25.6 — listLeagues retourne maintenant un objet { items, total, limit, offset }
    mockService.listLeagues.mockResolvedValue({
      items: [{ id: "league-1", name: "A", isPublic: true }],
      total: 1,
      limit: 50,
      offset: 0,
    });
    const req = createReq({ query: {} });
    const res = createRes();
    await handleListLeagues(req, res);
    expect(mockService.listLeagues).toHaveBeenCalledWith(
      expect.objectContaining({ publicOnly: undefined }),
    );
    expect(res.payload).toMatchObject({
      success: true,
      data: expect.objectContaining({ leagues: expect.any(Array) }),
    });
  });

  it("forwards query filters to the service (post validateQuery coercion)", async () => {
    mockService.listLeagues.mockResolvedValue([]);
    // validateQuery coerces publicOnly from "false" to boolean false before the handler
    const req = createReq({
      query: { status: "open", publicOnly: false } as unknown as Record<
        string,
        string
      >,
    });
    const res = createRes();
    await handleListLeagues(req, res);
    expect(mockService.listLeagues).toHaveBeenCalledWith(
      expect.objectContaining({ status: "open", publicOnly: false }),
    );
  });
});

describe("Route: GET /leagues/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the league does not exist", async () => {
    mockService.getLeagueById.mockResolvedValue(null);
    const req = createReq({ params: { id: "nope" } });
    const res = createRes();
    await handleGetLeague(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("returns the league details including parsed allowedRosters", async () => {
    mockService.getLeagueById.mockResolvedValue({
      id: "league-1",
      name: "Open",
      allowedRosters: JSON.stringify(["skaven", "dwarf"]),
      seasons: [],
    });
    const req = createReq({ params: { id: "league-1" } });
    const res = createRes();
    await handleGetLeague(req, res);
    expect(res.payload).toMatchObject({
      success: true,
      data: expect.objectContaining({
        league: expect.objectContaining({
          id: "league-1",
          allowedRosters: ["skaven", "dwarf"],
        }),
      }),
    });
  });
});

describe("Route: GET /leagues/seasons/:seasonId (season detail)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when the season does not exist", async () => {
    mockService.getSeasonById.mockResolvedValue(null);
    const req = createReq({ params: { seasonId: "nope" } });
    const res = createRes();
    await handleGetSeason(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("returns rounds, participants and allowedRosters parsed", async () => {
    mockService.getSeasonById.mockResolvedValue({
      id: "season-1",
      seasonNumber: 1,
      name: "Saison 1",
      status: "draft",
      startDate: null,
      endDate: null,
      leagueId: "league-1",
      league: {
        id: "league-1",
        name: "Open 5",
        creatorId: "user-1",
        allowedRosters: JSON.stringify(["skaven", "dwarf"]),
      },
      rounds: [
        {
          id: "round-1",
          roundNumber: 1,
          name: "J1",
          status: "pending",
          startDate: null,
          endDate: null,
        },
      ],
      participants: [
        {
          id: "participant-1",
          seasonElo: 1000,
          status: "active",
          wins: 1,
          draws: 0,
          losses: 0,
          points: 3,
          touchdownsFor: 2,
          touchdownsAgainst: 1,
          casualtiesFor: 0,
          casualtiesAgainst: 0,
          teamId: "team-1",
          team: {
            id: "team-1",
            name: "Team A",
            roster: "skaven",
            owner: { id: "user-1", coachName: "Coach Ryxeuf" },
          },
        },
      ],
    });
    const req = createReq({ params: { seasonId: "season-1" } });
    const res = createRes();
    await handleGetSeason(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      data: expect.objectContaining({
        season: expect.objectContaining({
          id: "season-1",
          rounds: expect.any(Array),
          participants: expect.any(Array),
          league: expect.objectContaining({
            allowedRosters: ["skaven", "dwarf"],
          }),
        }),
      }),
    });
  });
});

describe("Route: POST /leagues/:id/seasons (schedule a season)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-creator with 403", async () => {
    mockService.getLeagueById.mockResolvedValue({
      id: "league-1",
      creatorId: "someone-else",
    });
    const req = createReq({
      params: { id: "league-1" },
      body: { name: "Saison 1" },
    });
    const res = createRes();
    await handleCreateSeason(req, res);
    expect(res.statusCode).toBe(403);
    expect(mockService.createSeason).not.toHaveBeenCalled();
  });

  it("lets the creator create a new season", async () => {
    mockService.getLeagueById.mockResolvedValue({
      id: "league-1",
      creatorId: "user-1",
    });
    mockService.createSeason.mockResolvedValue({
      id: "season-1",
      seasonNumber: 1,
      name: "Saison 1",
    });
    const req = createReq({
      params: { id: "league-1" },
      body: { name: "Saison 1" },
    });
    const res = createRes();
    await handleCreateSeason(req, res);
    expect(mockService.createSeason).toHaveBeenCalledWith(
      expect.objectContaining({ leagueId: "league-1", name: "Saison 1" }),
    );
    expect(res.statusCode).toBe(201);
  });

  it("returns 404 when the league is not found", async () => {
    mockService.getLeagueById.mockResolvedValue(null);
    const req = createReq({
      params: { id: "unknown" },
      body: { name: "S1" },
    });
    const res = createRes();
    await handleCreateSeason(req, res);
    expect(res.statusCode).toBe(404);
  });

  // S26.6b — le handler doit transmettre theme + themeYear au service
  // pour que la creation persiste l'edition thematique correcte.
  it("forwards theme + themeYear to the service when both are provided", async () => {
    mockService.getLeagueById.mockResolvedValue({
      id: "league-1",
      creatorId: "user-1",
    });
    mockService.createSeason.mockResolvedValue({
      id: "season-1",
      seasonNumber: 1,
      name: "Skaven Cup 2026",
      theme: "skaven_cup",
      themeYear: 2026,
    });
    const req = createReq({
      params: { id: "league-1" },
      body: {
        name: "Skaven Cup 2026",
        theme: "skaven_cup",
        themeYear: 2026,
      },
    });
    const res = createRes();
    await handleCreateSeason(req, res);
    expect(mockService.createSeason).toHaveBeenCalledWith(
      expect.objectContaining({
        leagueId: "league-1",
        name: "Skaven Cup 2026",
        theme: "skaven_cup",
        themeYear: 2026,
      }),
    );
    expect(res.statusCode).toBe(201);
  });
});

describe("Route: POST /leagues/seasons/:seasonId/join", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires the team to belong to the authenticated user", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      ownerId: "other-user",
      roster: "skaven",
    });
    mockService.getSeasonById.mockResolvedValue({
      id: "season-1",
      league: { allowedRosters: null },
    });
    const req = createReq({
      params: { seasonId: "season-1" },
      body: { teamId: "team-1" },
    });
    const res = createRes();
    await handleJoinSeason(req, res);
    expect(res.statusCode).toBe(403);
    expect(mockService.addParticipant).not.toHaveBeenCalled();
  });

  it("rejects teams whose roster is not allowed (domain error from service)", async () => {
    // L.9 — la verification allowedRosters est deleguee au service.
    // Le handler se contente de convertir l'erreur metier en reponse 400
    // via `domainError`.
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      roster: "chaos",
    });
    mockService.getSeasonById.mockResolvedValue({
      id: "season-1",
      league: { allowedRosters: JSON.stringify(["skaven", "dwarf"]) },
    });
    mockService.addParticipant.mockRejectedValue(
      new Error("Roster chaos non autorise sur cette saison (autorises: skaven, dwarf)"),
    );
    const req = createReq({
      params: { seasonId: "season-1" },
      body: { teamId: "team-1" },
    });
    const res = createRes();
    await handleJoinSeason(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      error: expect.stringMatching(/roster/i),
    });
  });

  it("registers the team when ownership + roster check pass", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      roster: "skaven",
    });
    mockService.getSeasonById.mockResolvedValue({
      id: "season-1",
      league: { allowedRosters: null },
    });
    mockService.addParticipant.mockResolvedValue({
      id: "participant-1",
      seasonId: "season-1",
      teamId: "team-1",
      seasonElo: 1000,
    });
    const req = createReq({
      params: { seasonId: "season-1" },
      body: { teamId: "team-1" },
    });
    const res = createRes();
    await handleJoinSeason(req, res);
    expect(mockService.addParticipant).toHaveBeenCalledWith({
      seasonId: "season-1",
      teamId: "team-1",
    });
    expect(res.statusCode).toBe(201);
  });

  it("returns 404 when the season is missing", async () => {
    mockService.getSeasonById.mockResolvedValue(null);
    const req = createReq({
      params: { seasonId: "nope" },
      body: { teamId: "team-1" },
    });
    const res = createRes();
    await handleJoinSeason(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe("Route: POST /leagues/seasons/:seasonId/rounds (schedule round)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-creator with 403", async () => {
    mockService.getSeasonById.mockResolvedValue({
      id: "season-1",
      league: { creatorId: "someone-else" },
    });
    const req = createReq({
      params: { seasonId: "season-1" },
      body: { roundNumber: 1 },
    });
    const res = createRes();
    await handleCreateRound(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("creates the round when the caller is the creator", async () => {
    mockService.getSeasonById.mockResolvedValue({
      id: "season-1",
      league: { creatorId: "user-1" },
    });
    mockService.createRound.mockResolvedValue({
      id: "round-1",
      roundNumber: 1,
      name: "J1",
    });
    const req = createReq({
      params: { seasonId: "season-1" },
      body: { roundNumber: 1, name: "J1" },
    });
    const res = createRes();
    await handleCreateRound(req, res);
    expect(mockService.createRound).toHaveBeenCalledWith(
      expect.objectContaining({ seasonId: "season-1", roundNumber: 1 }),
    );
    expect(res.statusCode).toBe(201);
  });
});

describe("Route: GET /leagues/seasons/:seasonId/standings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the sorted standings", async () => {
    mockService.computeSeasonStandings.mockResolvedValue([
      { teamId: "t1", points: 9, touchdownDifference: 5 },
      { teamId: "t2", points: 3, touchdownDifference: -2 },
    ]);
    const req = createReq({ params: { seasonId: "season-1" } });
    const res = createRes();
    await handleGetStandings(req, res);
    expect(mockService.computeSeasonStandings).toHaveBeenCalledWith("season-1");
    expect(res.payload).toMatchObject({
      success: true,
      data: expect.objectContaining({
        standings: [
          expect.objectContaining({ teamId: "t1" }),
          expect.objectContaining({ teamId: "t2" }),
        ],
        // ELO masque par defaut (non present dans tieBreakRules).
        showSeasonElo: false,
      }),
    });
  });

  it("returns 404 when the season does not exist", async () => {
    mockService.computeSeasonStandings.mockRejectedValue(
      new Error("Saison introuvable: X"),
    );
    const req = createReq({ params: { seasonId: "nope" } });
    const res = createRes();
    await handleGetStandings(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe("Route: POST /leagues/seasons/:seasonId/leave", () => {
  beforeEach(() => vi.clearAllMocks());

  it("only allows the team owner to withdraw", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      ownerId: "other-user",
    });
    const req = createReq({
      params: { seasonId: "season-1" },
      body: { teamId: "team-1" },
    });
    const res = createRes();
    await handleLeaveSeason(req, res);
    expect(res.statusCode).toBe(403);
    expect(mockService.withdrawParticipant).not.toHaveBeenCalled();
  });

  it("calls withdrawParticipant for the owner", async () => {
    mockPrisma.team.findUnique.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
    });
    mockService.withdrawParticipant.mockResolvedValue({
      id: "part-1",
      status: "withdrawn",
    });
    const req = createReq({
      params: { seasonId: "season-1" },
      body: { teamId: "team-1" },
    });
    const res = createRes();
    await handleLeaveSeason(req, res);
    expect(mockService.withdrawParticipant).toHaveBeenCalledWith({
      seasonId: "season-1",
      teamId: "team-1",
    });
    expect(res.statusCode).toBe(200);
  });
});

// S26.6b — endpoints lecture des saisons thematiques.
describe("Route: GET /leagues/themes (catalogue public)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne le catalogue des themes ordonnes par mois croissant", async () => {
    const req = createReq();
    const res = createRes();
    await handleListThemes(req, res);
    expect(res.statusCode).toBe(200);
    const payload = res.payload as {
      success: boolean;
      data: { themes: Array<{ slug: string; month: number }> };
    };
    expect(payload.success).toBe(true);
    expect(payload.data.themes.length).toBeGreaterThanOrEqual(3);
    const slugs = payload.data.themes.map((t) => t.slug);
    expect(slugs).toEqual(
      expect.arrayContaining([
        "skaven_cup",
        "nordic_challenge",
        "underworld_open",
      ]),
    );
    for (let i = 1; i < payload.data.themes.length; i++) {
      expect(payload.data.themes[i].month).toBeGreaterThan(
        payload.data.themes[i - 1].month,
      );
    }
  });

  it("expose chaque theme avec slug, title, month, badgeColor, description", async () => {
    const req = createReq();
    const res = createRes();
    await handleListThemes(req, res);
    const payload = res.payload as {
      data: {
        themes: Array<{
          slug: string;
          title: string;
          month: number;
          badgeColor: string;
          description: string;
        }>;
      };
    };
    for (const t of payload.data.themes) {
      expect(typeof t.slug).toBe("string");
      expect(typeof t.title).toBe("string");
      expect(typeof t.month).toBe("number");
      expect(t.badgeColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(typeof t.description).toBe("string");
    }
  });
});

describe("Route: GET /leagues/seasons/themed (lecture filtree)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne les saisons d'un theme avec slug + annee", async () => {
    mockService.listThemedSeasons.mockResolvedValue({
      items: [
        {
          id: "s-1",
          name: "Skaven Cup 2026",
          theme: "skaven_cup",
          themeYear: 2026,
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    });
    const req = createReq({
      query: { theme: "skaven_cup", themeYear: 2026, limit: 50, offset: 0 },
    });
    const res = createRes();
    await handleListSeasonsByTheme(req, res);
    expect(res.statusCode).toBe(200);
    const payload = res.payload as {
      success: boolean;
      data: { seasons: Array<{ id: string }> };
      meta: { total: number };
    };
    expect(payload.success).toBe(true);
    expect(payload.data.seasons).toHaveLength(1);
    expect(payload.meta.total).toBe(1);
  });

  it("convertit une erreur de slug inconnu en 400", async () => {
    mockService.listThemedSeasons.mockRejectedValue(
      new Error("theme inconnu: ghost_league"),
    );
    const req = createReq({
      query: { theme: "ghost_league", limit: 50, offset: 0 },
    });
    const res = createRes();
    await handleListSeasonsByTheme(req, res);
    expect(res.statusCode).toBe(400);
  });
});
