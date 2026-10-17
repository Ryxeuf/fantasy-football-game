/**
 * `GET /career-stats/team/:teamId` — la page carrière comptait seulement les
 * matchs EN LIGNE : une équipe de ligue ou de coupe y était à 0, et chaque
 * joueur ne portait que ses compteurs bruts (coupe ignorée).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    team: { findFirst: vi.fn() },
    teamSelection: { findMany: vi.fn(async () => []) },
    turn: { findFirst: vi.fn() },
  },
}));

vi.mock("../services/team-match-stats-loader", () => ({
  loadTeamMatchStats: vi.fn(),
}));

vi.mock("../services/player-career-loader", () => ({
  buildPlayerCareerTotals: vi.fn(),
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authUser";
import { prisma } from "../prisma";
import { loadTeamMatchStats } from "../services/team-match-stats-loader";
import { buildPlayerCareerTotals } from "../services/player-career-loader";
import { handleGetTeamCareer } from "./career-stats";

const teamFindFirst = prisma.team.findFirst as unknown as ReturnType<typeof vi.fn>;
const loadStats = loadTeamMatchStats as unknown as ReturnType<typeof vi.fn>;
const buildCareers = buildPlayerCareerTotals as unknown as ReturnType<typeof vi.fn>;

function createRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

const player = {
  id: "p-1",
  name: "Sire Bohémond",
  number: 1,
  position: "grail_knight",
  spp: 0,
  matchesPlayed: 0,
  totalTouchdowns: 0,
  totalCasualties: 0,
  totalCompletions: 0,
  totalInterceptions: 0,
  totalMvpAwards: 0,
  nigglingInjuries: 0,
  advancements: "[]",
  dead: false,
};

async function call() {
  const req = {
    params: { teamId: "team-1" },
    user: { id: "user-1" },
  } as unknown as AuthenticatedRequest;
  const res = createRes();
  await handleGetTeamCareer(req, res as unknown as Response);
  return res;
}

beforeEach(() => {
  vi.resetAllMocks();
  teamFindFirst.mockResolvedValue({
    id: "team-1",
    name: "Paladins de la Dame",
    roster: "bretonnian",
    ruleset: "season_3",
    players: [player],
  });
  (prisma.teamSelection.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
});

describe("GET /career-stats/team/:teamId", () => {
  it("sert le bilan toutes compétitions et la carrière des joueurs coupe comprise", async () => {
    loadStats.mockResolvedValue({
      localMatchStats: {},
      matchStats: { played: 4, wins: 3, draws: 0, losses: 1, bySource: { cup: { played: 4 } } },
    });
    buildCareers.mockResolvedValue(
      new Map([
        [
          "p-1",
          {
            matchesPlayed: 4,
            touchdowns: 3,
            casualties: 2,
            completions: 1,
            interceptions: 0,
            mvpAwards: 1,
            spp: 0,
            cup: {},
          },
        ],
      ]),
    );

    const res = await call();

    expect(res.statusCode).toBe(200);
    expect(buildCareers).toHaveBeenCalledWith(["team-1"], [player], expect.any(Function));
    expect(res.body).toMatchObject({
      // Palmarès en ligne : aucun match en ligne ici.
      record: { matchesPlayed: 0 },
      matchStats: { played: 4, wins: 3 },
      players: [
        {
          id: "p-1",
          matchesPlayed: 4,
          totalTouchdowns: 3,
          totalCasualties: 2,
          totalCompletions: 1,
          totalMvpAwards: 1,
          spp: 0,
        },
      ],
    });
  });

  it("se sert sans bilan ni carrière quand leurs lectures échouent", async () => {
    loadStats.mockRejectedValue(new Error("db down"));
    buildCareers.mockResolvedValue(new Map());

    const res = await call();

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      matchStats: null,
      players: [{ id: "p-1", matchesPlayed: 0, totalTouchdowns: 0 }],
    });
  });

  it("404 pour l'équipe d'un autre coach", async () => {
    teamFindFirst.mockResolvedValue(null);
    const res = await call();
    expect(res.statusCode).toBe(404);
  });
});
