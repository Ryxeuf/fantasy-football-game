/**
 * Pronostics de ligue — la VRAIE chaîne Express : routeur monté sur
 * `/leagues`, `authUser` / `optionalAuthUser` avec de vrais JWT, service et
 * garde de visibilité RÉELS, Prisma mocké. Sous test : les codes de réponse
 * que l'écran exploite (401, 403, 404 d'une ligue privée, 409, 400) et le
 * fait qu'une ligue invisible ne laisse rien filtrer, en lecture comme en
 * écriture.
 *
 * Pattern `http.createServer(express())` + `http.request` natif : supertest
 * n'est pas dans les dépendances (cf. `routes/league-access.test.ts`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";

vi.mock("../prisma", () => ({
  prisma: {
    league: { findUnique: vi.fn(), update: vi.fn() },
    leagueSeason: { findUnique: vi.fn() },
    leagueRound: { findUnique: vi.fn(), updateMany: vi.fn() },
    leaguePairing: { findUnique: vi.fn(), updateMany: vi.fn() },
    leagueParticipant: { count: vi.fn() },
    leagueInvitation: { count: vi.fn() },
    competitionPrediction: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

import router from "./league-predictions";
import { prisma } from "../prisma";
import { JWT_SECRET } from "../config";

type MockFn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  league: { findUnique: MockFn; update: MockFn };
  leagueSeason: { findUnique: MockFn };
  leagueRound: { findUnique: MockFn; updateMany: MockFn };
  leaguePairing: { findUnique: MockFn; updateMany: MockFn };
  leagueParticipant: { count: MockFn };
  leagueInvitation: { count: MockFn };
  competitionPrediction: { upsert: MockFn; deleteMany: MockFn; findMany: MockFn };
};

const COMMISH = "commish";
const HOME = "coach-home";
const AWAY = "coach-away";
const MEMBER = "coach-member";
const STRANGER = "stranger";
const ADMIN = "admin-1";
const ACTIVE_COACHES = new Set([HOME, AWAY, MEMBER]);

function tokenFor(userId: string, roles: readonly string[] = ["user"]): string {
  return jwt.sign({ sub: userId, roles: [...roles] }, JWT_SECRET);
}

function leagueRow(isPublic: boolean, predictionsScope: string | null) {
  return {
    id: "league-1",
    creatorId: COMMISH,
    isPublic,
    status: "in_progress",
    predictionsScope,
  };
}

function team(id: string, ownerId: string) {
  return {
    id,
    teamId: `t-${id}`,
    team: {
      id: `t-${id}`,
      name: `Équipe ${id}`,
      roster: "skaven",
      logoUrl: null,
      ownerId,
      owner: { coachName: ownerId },
    },
  };
}

function seasonRow(isPublic: boolean, predictionsScope: string | null) {
  return {
    id: "season-1",
    status: "in_progress",
    playoffsPublished: null,
    league: leagueRow(isPublic, predictionsScope),
    participants: [...ACTIVE_COACHES].map((ownerId) => ({
      status: "active",
      team: { ownerId },
    })),
    rounds: [
      {
        id: "round-1",
        roundNumber: 1,
        name: null,
        status: "in_progress",
        kind: "regular",
        bracketSlot: null,
        startDate: null,
        pairings: [
          {
            id: "pairing-1",
            status: "scheduled",
            scheduledAt: null,
            predictionsClosedAt: null,
            homeParticipantId: "p-home",
            awayParticipantId: "p-away",
            homeParticipant: team("p-home", HOME),
            awayParticipant: team("p-away", AWAY),
            matchSheet: null,
            predictions: [],
          },
        ],
      },
    ],
  };
}

function pairingContext(
  isPublic: boolean,
  predictionsScope: string | null,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "pairing-1",
    status: "scheduled",
    scheduledAt: null,
    predictionsClosedAt: null,
    homeParticipantId: "p-home",
    awayParticipantId: "p-away",
    homeParticipant: { team: { ownerId: HOME } },
    awayParticipant: { team: { ownerId: AWAY } },
    round: {
      id: "round-1",
      kind: "regular",
      bracketSlot: null,
      season: {
        id: "season-1",
        playoffsPublished: null,
        league: leagueRow(isPublic, predictionsScope),
      },
    },
    ...overrides,
  };
}

/** Une ligue en base ; les coachs actifs sont membres, les autres non. */
function seed(isPublic: boolean, predictionsScope: string | null = "members") {
  db.league.findUnique.mockResolvedValue(leagueRow(isPublic, predictionsScope));
  db.leagueSeason.findUnique.mockResolvedValue(
    seasonRow(isPublic, predictionsScope),
  );
  db.leaguePairing.findUnique.mockResolvedValue(
    pairingContext(isPublic, predictionsScope),
  );
  db.leagueRound.findUnique.mockResolvedValue({
    id: "round-1",
    season: { league: leagueRow(isPublic, predictionsScope) },
  });
  // Visibilité (toute saison) comme appartenance active : les coachs actifs.
  db.leagueParticipant.count.mockImplementation(
    async (args: { where: { team: { ownerId: string } } }) =>
      ACTIVE_COACHES.has(args.where.team.ownerId) ? 1 : 0,
  );
  db.leagueInvitation.count.mockResolvedValue(0);
  db.competitionPrediction.findMany.mockResolvedValue([]);
  db.competitionPrediction.upsert.mockResolvedValue({});
  db.competitionPrediction.deleteMany.mockResolvedValue({ count: 1 });
  db.leaguePairing.updateMany.mockResolvedValue({ count: 1 });
  db.league.update.mockResolvedValue({});
}

interface Reply {
  status: number;
  body: { success?: boolean; data?: Record<string, unknown>; error?: string };
}

async function request(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  routePath: string,
  options: { token?: string | null; json?: Record<string, unknown> } = {},
): Promise<Reply> {
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
                body: buf ? JSON.parse(buf) : {},
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
  vi.resetAllMocks();
});

describe("GET /leagues/seasons/:seasonId/predictions", () => {
  it("sert une ligue publique sans compte, en expliquant qu'il en faut un", async () => {
    seed(true);
    const res = await request("GET", "/leagues/seasons/season-1/predictions");
    expect(res.status).toBe(200);
    const rounds = res.body.data?.rounds as Array<{
      pairings: Array<{ eligibility: string; predictions: unknown }>;
    }>;
    expect(rounds[0].pairings[0].eligibility).toBe("anonymous");
    expect(rounds[0].pairings[0].predictions).toBeNull();
  });

  it("cache une ligue privée à un tiers (404, jamais 403)", async () => {
    seed(false);
    const res = await request("GET", "/leagues/seasons/season-1/predictions", {
      token: tokenFor(STRANGER),
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Saison introuvable");
  });

  it("sert une ligue privée à un coach inscrit", async () => {
    seed(false);
    const res = await request("GET", "/leagues/seasons/season-1/predictions", {
      token: tokenFor(MEMBER),
    });
    expect(res.status).toBe(200);
    expect(res.body.data?.scope).toBe("members");
  });
});

describe("GET /leagues/seasons/:seasonId/predictions/leaderboard", () => {
  it("sert le classement d'une ligue publique, cache celui d'une privée", async () => {
    seed(true);
    const open = await request(
      "GET",
      "/leagues/seasons/season-1/predictions/leaderboard",
    );
    expect(open.status).toBe(200);
    expect(open.body.data).toMatchObject({ coach: [], stands: [] });

    seed(false);
    const hidden = await request(
      "GET",
      "/leagues/seasons/season-1/predictions/leaderboard",
      { token: tokenFor(STRANGER) },
    );
    expect(hidden.status).toBe(404);
  });
});

describe("PUT /leagues/pairings/:pairingId/prediction", () => {
  const path = "/leagues/pairings/pairing-1/prediction";

  it("exige un compte (401)", async () => {
    seed(true);
    const res = await request("PUT", path, { json: { pick: "home" } });
    expect(res.status).toBe(401);
  });

  it("valide la forme du corps (400)", async () => {
    seed(true);
    const res = await request("PUT", path, {
      token: tokenFor(MEMBER),
      json: { pick: "win" },
    });
    expect(res.status).toBe(400);
    expect(db.competitionPrediction.upsert).not.toHaveBeenCalled();
  });

  it("enregistre le pronostic d'un coach sur la rencontre des autres", async () => {
    seed(true);
    const res = await request("PUT", path, {
      token: tokenFor(MEMBER),
      json: { pick: "home", homeScore: 2, awayScore: 1 },
    });
    expect(res.status).toBe(200);
    expect(res.body.data?.prediction).toEqual({
      pick: "home",
      homeScore: 2,
      awayScore: 1,
    });
    expect(db.competitionPrediction.upsert).toHaveBeenCalled();
  });

  it("refuse un score incohérent avec le vainqueur (400)", async () => {
    seed(true);
    const res = await request("PUT", path, {
      token: tokenFor(MEMBER),
      json: { pick: "away", homeScore: 2, awayScore: 1 },
    });
    expect(res.status).toBe(400);
  });

  it.each([
    ["sa propre rencontre", HOME, "Impossible de pronostiquer"],
    ["un spectateur en portée membres", STRANGER, "réservés à ses membres"],
  ])("refuse %s (403)", async (_label, userId, message) => {
    seed(true);
    const res = await request("PUT", path, {
      token: tokenFor(userId),
      json: { pick: "home" },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain(message);
  });

  it("refuse des pronostics coupés (403)", async () => {
    seed(true, null);
    const res = await request("PUT", path, {
      token: tokenFor(MEMBER),
      json: { pick: "home" },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("désactivés");
  });

  it("refuse une rencontre fermée (409)", async () => {
    seed(true);
    db.leaguePairing.findUnique.mockResolvedValue(
      pairingContext(true, "members", {
        predictionsClosedAt: new Date("2026-01-01T00:00:00Z"),
      }),
    );
    const res = await request("PUT", path, {
      token: tokenFor(MEMBER),
      json: { pick: "home" },
    });
    expect(res.status).toBe(409);
  });

  it("cache une ligue privée à un tiers, même en portée ouverte (404)", async () => {
    seed(false, "open");
    const res = await request("PUT", path, {
      token: tokenFor(STRANGER),
      json: { pick: "home" },
    });
    expect(res.status).toBe(404);
    expect(db.competitionPrediction.upsert).not.toHaveBeenCalled();
  });

  it("ouvre une ligue publique en portée ouverte à un spectateur", async () => {
    seed(true, "open");
    const res = await request("PUT", path, {
      token: tokenFor(STRANGER),
      json: { pick: "draw" },
    });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /leagues/pairings/:pairingId/prediction", () => {
  it("retire son pronostic d'une rencontre ouverte", async () => {
    seed(true);
    const res = await request(
      "DELETE",
      "/leagues/pairings/pairing-1/prediction",
      { token: tokenFor(MEMBER) },
    );
    expect(res.status).toBe(200);
    expect(db.competitionPrediction.deleteMany).toHaveBeenCalledWith({
      where: { pairingId: "pairing-1", userId: MEMBER },
    });
  });
});

describe("clôtures manuelles", () => {
  it("un coach de la rencontre la ferme ; un autre coach, non", async () => {
    seed(true);
    const ok = await request(
      "POST",
      "/leagues/pairings/pairing-1/predictions/close",
      { token: tokenFor(AWAY) },
    );
    expect(ok.status).toBe(200);

    const denied = await request(
      "POST",
      "/leagues/pairings/pairing-1/predictions/close",
      { token: tokenFor(MEMBER) },
    );
    expect(denied.status).toBe(403);
  });

  it("le commissaire ferme une journée ; un coach, non", async () => {
    seed(true);
    const ok = await request("POST", "/leagues/rounds/round-1/predictions/close", {
      token: tokenFor(COMMISH),
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual({ closed: 1 });

    const denied = await request(
      "POST",
      "/leagues/rounds/round-1/predictions/close",
      { token: tokenFor(HOME) },
    );
    expect(denied.status).toBe(403);
  });
});

describe("PATCH /leagues/:id/predictions-scope", () => {
  const path = "/leagues/league-1/predictions-scope";

  it("exige une portée connue (400)", async () => {
    seed(true);
    const res = await request("PATCH", path, {
      token: tokenFor(COMMISH),
      json: {},
    });
    expect(res.status).toBe(400);
  });

  it("laisse le commissaire et un admin régler la portée", async () => {
    seed(true);
    const commish = await request("PATCH", path, {
      token: tokenFor(COMMISH),
      json: { scope: "open" },
    });
    expect(commish.status).toBe(200);
    expect(commish.body.data).toEqual({ predictionsScope: "open" });

    const admin = await request("PATCH", path, {
      token: tokenFor(ADMIN, ["user", "admin"]),
      json: { scope: "off" },
    });
    expect(admin.status).toBe(200);
  });

  it("refuse un coach (403) et cache une ligue privée à un tiers (404)", async () => {
    seed(true);
    const coach = await request("PATCH", path, {
      token: tokenFor(MEMBER),
      json: { scope: "open" },
    });
    expect(coach.status).toBe(403);

    seed(false);
    const stranger = await request("PATCH", path, {
      token: tokenFor(STRANGER),
      json: { scope: "open" },
    });
    expect(stranger.status).toBe(404);
    expect(db.league.update).not.toHaveBeenCalled();
  });
});
