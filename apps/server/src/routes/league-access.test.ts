/**
 * Visibilité d'une ligue PRIVÉE sur les lectures par id — la VRAIE chaîne
 * Express : routeur `/leagues`, `authUser` / `optionalAuthUser` avec de vrais
 * JWT, Prisma mocké, calculs lourds (classement, statistiques, récap, feuille
 * de match) remplacés par des fixtures. Sous test :
 *
 *   - un tiers obtient 404 sur une ligue privée — jamais 403, qui en
 *     confirmerait l'existence — et rien n'est calculé ;
 *   - commissaire, admin, coach inscrit et coach invité obtiennent 200 ;
 *   - une ligue publique reste lisible d'un tiers, et sans compte sur les
 *     endpoints ouverts (poules, classements individuels, récap, bracket).
 *
 * Pattern `http.createServer(express())` + `http.request` natif
 * (cf. `routes/auth-register.test.ts`) : supertest n'est pas dans les deps.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";

vi.mock("../prisma", () => ({
  prisma: {
    league: { findUnique: vi.fn() },
    leagueSeason: { findUnique: vi.fn() },
    leaguePairing: { findUnique: vi.fn() },
    leagueParticipant: { count: vi.fn() },
    leagueInvitation: { count: vi.fn() },
    leagueRound: { findMany: vi.fn(), count: vi.fn() },
    leaguePool: { findMany: vi.fn() },
    match: { count: vi.fn() },
    team: { findUnique: vi.fn() },
  },
}));

// Calculs hors sujet remplacés par des fixtures. `getLeagueById`,
// `getSeasonById` et `isLeagueParticipant` restent RÉELS (Prisma mocké) :
// c'est la chaîne route → garde → service qui est exercée.
vi.mock("../services/league", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/league")>();
  return {
    ...actual,
    computeSeasonStandings: vi.fn(),
    computeSeasonStandingsByPool: vi.fn(),
    addParticipant: vi.fn(),
  };
});
vi.mock("../services/league-pool", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/league-pool")>();
  return { ...actual, listPoolsForSeason: vi.fn() };
});
vi.mock("../services/league-player-stats", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/league-player-stats")>();
  return {
    ...actual,
    computeLeaderboards: vi.fn(),
    computeLeaderboardsByTeam: vi.fn(),
  };
});
vi.mock("../services/league-team-stats", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/league-team-stats")>();
  return { ...actual, computeTeamLeaderboards: vi.fn() };
});
vi.mock("../services/league-scoring", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/league-scoring")>();
  return {
    ...actual,
    computeSeasonRecap: vi.fn(),
    getPersistedSeasonAward: vi.fn(),
  };
});
vi.mock("../services/league-match-sheet", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/league-match-sheet")>();
  return { ...actual, getMatchSheet: vi.fn() };
});

import router from "./league";
import { prisma } from "../prisma";
import { JWT_SECRET } from "../config";
import { addParticipant, computeSeasonStandings } from "../services/league";
import { getMatchSheet } from "../services/league-match-sheet";
import { computeLeaderboards } from "../services/league-player-stats";
import { computeTeamLeaderboards } from "../services/league-team-stats";
import { computeLeaderboardsByTeam } from "../services/league-player-stats";
import { computeSeasonRecap } from "../services/league-scoring";
import { listPoolsForSeason } from "../services/league-pool";

type MockFn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  league: { findUnique: MockFn };
  leagueSeason: { findUnique: MockFn };
  leaguePairing: { findUnique: MockFn };
  leagueParticipant: { count: MockFn };
  leagueInvitation: { count: MockFn };
  leagueRound: { findMany: MockFn; count: MockFn };
  leaguePool: { findMany: MockFn };
  match: { count: MockFn };
  team: { findUnique: MockFn };
};

const COMMISH = "commish";
const MEMBER = "member";
const INVITEE = "invitee";
const STRANGER = "stranger";
const ADMIN = "admin-1";

/** Vrai JWT signé avec le secret de l'app : `authUser` le vérifie tel quel. */
function tokenFor(userId: string, roles: readonly string[] = ["user"]): string {
  return jwt.sign({ sub: userId, roles: [...roles] }, JWT_SECRET);
}

function leagueRow(isPublic: boolean) {
  return {
    id: "league-1",
    name: "Cercle fermé",
    description: null,
    creatorId: COMMISH,
    isPublic,
    status: "open",
    ruleset: "season_3",
    tournamentRuleset: null,
    maxParticipants: 16,
    allowedRosters: null,
    allowedInducements: null,
    tieBreakRules: null,
    creator: { id: COMMISH, coachName: "Grim" },
    seasons: [],
  };
}

function seasonRow(isPublic: boolean) {
  return {
    id: "season-1",
    leagueId: "league-1",
    seasonNumber: 1,
    name: "Saison 1",
    status: "in_progress",
    playoffSize: 0,
    playoffsPublished: null,
    league: leagueRow(isPublic),
    rounds: [],
    participants: [],
  };
}

/** Une seule ligue en base, publique ou privée ; membres simulés. */
function seedLeague(isPublic: boolean): void {
  db.league.findUnique.mockResolvedValue(leagueRow(isPublic));
  db.leagueSeason.findUnique.mockResolvedValue(seasonRow(isPublic));
  db.leaguePairing.findUnique.mockResolvedValue({
    round: { season: { league: leagueRow(isPublic) } },
  });
  db.leagueParticipant.count.mockImplementation(
    async (args: { where: { team: { ownerId: string } } }) =>
      args.where.team.ownerId === MEMBER ? 1 : 0,
  );
  db.leagueInvitation.count.mockImplementation(
    async (args: { where: { inviteeUserId: string } }) =>
      args.where.inviteeUserId === INVITEE ? 1 : 0,
  );
}

interface RequestOptions {
  readonly token?: string | null;
  readonly json?: Record<string, unknown>;
}

async function request(
  method: "GET" | "POST",
  routePath: string,
  options: RequestOptions = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = express();
  app.use(express.json());
  app.use("/leagues", router);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const payload = Buffer.from(
        options.json ? JSON.stringify(options.json) : "",
      );
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: routePath,
          method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": payload.length.toString(),
            ...(options.token
              ? { Authorization: `Bearer ${options.token}` }
              : {}),
          },
        },
        (res) => {
          let buf = "";
          res.on("data", (c) => (buf += c));
          res.on("end", () => {
            server.close();
            try {
              resolve({
                status: res.statusCode ?? 0,
                body: buf ? (JSON.parse(buf) as Record<string, unknown>) : {},
              });
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on("error", (e) => {
        server.close();
        reject(e);
      });
      if (payload.length) req.write(payload);
      req.end();
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.match.count.mockResolvedValue(0);
  db.leagueRound.findMany.mockResolvedValue([]);
  db.leagueRound.count.mockResolvedValue(0);
  db.leaguePool.findMany.mockResolvedValue([]);
  vi.mocked(computeSeasonStandings).mockResolvedValue([]);
  vi.mocked(listPoolsForSeason).mockResolvedValue([] as never);
  vi.mocked(computeLeaderboards).mockResolvedValue({
    seasonId: "season-1",
    topN: 5,
  } as never);
  vi.mocked(computeLeaderboardsByTeam).mockResolvedValue([]);
  vi.mocked(computeTeamLeaderboards).mockResolvedValue({
    seasonId: "season-1",
    topN: 5,
  } as never);
  vi.mocked(computeSeasonRecap).mockResolvedValue({
    seasonId: "season-1",
    championUserId: null,
    championTeamId: null,
    championLabel: null,
    awards: {},
    standings: [],
  } as never);
  vi.mocked(getMatchSheet).mockResolvedValue({ sheet: null } as never);
});

interface ReadEndpoint {
  readonly name: string;
  readonly path: string;
  /** `required` = `authUser` (401 sans compte) ; `optional` = `optionalAuthUser`. */
  readonly auth: "required" | "optional";
  /** Message du 404 — le MÊME que pour une ressource inexistante. */
  readonly notFound: string;
}

const READS: readonly ReadEndpoint[] = [
  {
    name: "GET /leagues/:id (détail)",
    path: "/leagues/league-1",
    auth: "required",
    notFound: "Ligue introuvable",
  },
  {
    name: "GET /leagues/seasons/:seasonId (calendrier + participants)",
    path: "/leagues/seasons/season-1",
    auth: "required",
    notFound: "Saison introuvable",
  },
  {
    name: "GET /leagues/seasons/:seasonId/standings",
    path: "/leagues/seasons/season-1/standings?byPool=true",
    auth: "required",
    notFound: "Saison introuvable",
  },
  {
    name: "GET /leagues/seasons/:seasonId/pools",
    path: "/leagues/seasons/season-1/pools",
    auth: "optional",
    notFound: "Saison introuvable",
  },
  {
    name: "GET /leagues/seasons/:seasonId/leaderboards",
    path: "/leagues/seasons/season-1/leaderboards",
    auth: "optional",
    notFound: "Saison introuvable",
  },
  {
    name: "GET /leagues/seasons/:seasonId/leaderboards/by-team",
    path: "/leagues/seasons/season-1/leaderboards/by-team",
    auth: "optional",
    notFound: "Saison introuvable",
  },
  {
    name: "GET /leagues/seasons/:seasonId/leaderboards/teams",
    path: "/leagues/seasons/season-1/leaderboards/teams",
    auth: "optional",
    notFound: "Saison introuvable",
  },
  {
    name: "GET /leagues/seasons/:seasonId/awards (récap)",
    path: "/leagues/seasons/season-1/awards",
    auth: "optional",
    notFound: "Saison introuvable",
  },
  {
    name: "GET /leagues/seasons/:seasonId/playoff-bracket",
    path: "/leagues/seasons/season-1/playoff-bracket",
    auth: "optional",
    notFound: "Saison introuvable",
  },
  {
    name: "GET /leagues/pairings/:pairingId/sheet (feuille de match)",
    path: "/leagues/pairings/pairing-1/sheet",
    auth: "required",
    notFound: "Pairing introuvable",
  },
];

describe.each(READS)("$name", ({ path, auth, notFound }) => {
  it("ligue privée : 404 pour un coach tiers, jamais 403", async () => {
    seedLeague(false);
    const res = await request("GET", path, { token: tokenFor(STRANGER) });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: notFound });
  });

  it("ligue privée : 200 pour un coach inscrit", async () => {
    seedLeague(false);
    const res = await request("GET", path, { token: tokenFor(MEMBER) });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("ligue privée : 200 pour un coach invité en attente", async () => {
    seedLeague(false);
    const res = await request("GET", path, { token: tokenFor(INVITEE) });
    expect(res.status).toBe(200);
  });

  it("ligue privée : 200 pour son commissaire", async () => {
    seedLeague(false);
    const res = await request("GET", path, { token: tokenFor(COMMISH) });
    expect(res.status).toBe(200);
  });

  it("ligue privée : 200 pour un administrateur", async () => {
    seedLeague(false);
    const res = await request("GET", path, {
      token: tokenFor(ADMIN, ["user", "admin"]),
    });
    expect(res.status).toBe(200);
  });

  it("ligue publique : 200 pour un coach tiers", async () => {
    seedLeague(true);
    const res = await request("GET", path, { token: tokenFor(STRANGER) });
    expect(res.status).toBe(200);
  });

  if (auth === "optional") {
    it("ligue publique : 200 sans compte", async () => {
      seedLeague(true);
      const res = await request("GET", path);
      expect(res.status).toBe(200);
    });

    it("ligue privée : 404 sans compte", async () => {
      seedLeague(false);
      const res = await request("GET", path);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, error: notFound });
    });
  } else {
    it("401 sans compte (une ligue privée ne devient pas lisible anonymement)", async () => {
      seedLeague(false);
      const res = await request("GET", path);
      expect(res.status).toBe(401);
    });
  }
});

describe("Ligue privée — ce que le 404 ne révèle pas", () => {
  it("ligue inconnue et ligue privée cachée : réponses identiques", async () => {
    seedLeague(false);
    const hidden = await request("GET", "/leagues/league-1", {
      token: tokenFor(STRANGER),
    });
    db.league.findUnique.mockResolvedValue(null);
    const missing = await request("GET", "/leagues/nope", {
      token: tokenFor(STRANGER),
    });
    expect(hidden.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(hidden.body).toEqual(missing.body);
  });

  it("aucun calcul n'est lancé pour un tiers (classement, feuille de match)", async () => {
    seedLeague(false);
    await request("GET", "/leagues/seasons/season-1/standings", {
      token: tokenFor(STRANGER),
    });
    await request("GET", "/leagues/pairings/pairing-1/sheet", {
      token: tokenFor(STRANGER),
    });
    expect(computeSeasonStandings).not.toHaveBeenCalled();
    expect(getMatchSheet).not.toHaveBeenCalled();
  });

  it("une rencontre hors ligue (coupe) n'est pas cachée par cette garde", async () => {
    seedLeague(false);
    db.leaguePairing.findUnique.mockResolvedValue(null);
    const res = await request("GET", "/leagues/pairings/cup-pairing/sheet", {
      token: tokenFor(STRANGER),
    });
    expect(res.status).toBe(200);
    expect(getMatchSheet).toHaveBeenCalledWith({
      pairingId: "cup-pairing",
      userId: STRANGER,
    });
  });
});

describe("GET /leagues/:leagueId/teams/:teamId/roster-view", () => {
  it("ligue privée : 404 pour un coach tiers", async () => {
    seedLeague(false);
    const res = await request(
      "GET",
      "/leagues/league-1/teams/team-1/roster-view",
      {
        token: tokenFor(STRANGER),
      },
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: "Ligue introuvable" });
  });

  it("ligue publique : 403 pour un coach non inscrit (les rosters restent réservés)", async () => {
    seedLeague(true);
    const res = await request(
      "GET",
      "/leagues/league-1/teams/team-1/roster-view",
      {
        token: tokenFor(STRANGER),
      },
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /leagues/seasons/:seasonId/join", () => {
  it("ligue privée : un tiers ne peut pas la rejoindre par son id (404)", async () => {
    seedLeague(false);
    const res = await request("POST", "/leagues/seasons/season-1/join", {
      token: tokenFor(STRANGER),
      json: { teamId: "team-1" },
    });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: "Saison introuvable" });
    expect(addParticipant).not.toHaveBeenCalled();
  });

  it("ligue privée : un coach invité en attente peut inscrire son équipe", async () => {
    seedLeague(false);
    db.team.findUnique.mockResolvedValue({ id: "team-1", ownerId: INVITEE });
    vi.mocked(addParticipant).mockResolvedValue({
      id: "participant-1",
    } as never);
    const res = await request("POST", "/leagues/seasons/season-1/join", {
      token: tokenFor(INVITEE),
      json: { teamId: "team-1" },
    });
    expect(res.status).toBe(201);
    expect(addParticipant).toHaveBeenCalledWith({
      seasonId: "season-1",
      teamId: "team-1",
    });
  });
});
