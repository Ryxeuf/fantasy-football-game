/**
 * Pronostics de coupe — la VRAIE chaîne Express : routeur monté sur `/cup`,
 * `authUser` avec de vrais JWT, service RÉEL, Prisma mocké. Sous test : les
 * codes de réponse que l'écran exploite (401, 403, 404, 409, 400) et les
 * règles propres à la coupe — un exempt n'est pas une rencontre, un bracket
 * non publié ne fuit pas, rien des autres avant la clôture.
 *
 * Pattern `http.createServer(express())` + `http.request` natif : supertest
 * n'est pas dans les dépendances (cf. `routes/league-predictions.test.ts`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";

vi.mock("../prisma", () => ({
  prisma: {
    cup: { findUnique: vi.fn(), update: vi.fn() },
    cupRound: { findMany: vi.fn(), findUnique: vi.fn() },
    cupPairing: { findUnique: vi.fn(), updateMany: vi.fn() },
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

import router from "./cup-predictions";
import { prisma } from "../prisma";
import { JWT_SECRET } from "../config";

type MockFn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  cup: { findUnique: MockFn; update: MockFn };
  cupRound: { findMany: MockFn; findUnique: MockFn };
  cupPairing: { findUnique: MockFn; updateMany: MockFn };
  competitionPrediction: { upsert: MockFn; deleteMany: MockFn; findMany: MockFn };
};

const COMMISH = "commish";
const HOME = "coach-home";
const AWAY = "coach-away";
const MEMBER = "coach-member";
const STRANGER = "stranger";
const ADMIN = "admin-1";

function tokenFor(userId: string, roles: readonly string[] = ["user"]): string {
  return jwt.sign({ sub: userId, roles: [...roles] }, JWT_SECRET);
}

function cupRow(predictionsScope: string | null, overrides: Record<string, unknown> = {}) {
  return {
    id: "cup-1",
    name: "Coupe du Chaos",
    creatorId: COMMISH,
    status: "en_cours",
    predictionsScope,
    playoffsPublished: null,
    participants: [HOME, AWAY, MEMBER].map((ownerId) => ({ team: { ownerId } })),
    ...overrides,
  };
}

function team(id: string, ownerId: string) {
  return {
    id,
    name: `Équipe ${id}`,
    roster: "orc",
    logoUrl: null,
    ownerId,
    owner: { coachName: ownerId },
  };
}

function prediction(userId: string, pick = "home") {
  return {
    userId,
    pick,
    homeScore: null,
    awayScore: null,
    result: null,
    resultHomeScore: null,
    resultAwayScore: null,
    user: { coachName: userId, privateProfile: false },
  };
}

function pairingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pairing-1",
    status: "scheduled",
    scheduledAt: null,
    predictionsClosedAt: null,
    homeTeamId: "t-home",
    awayTeamId: "t-away",
    homeTeam: team("t-home", HOME),
    awayTeam: team("t-away", AWAY),
    matchSheet: null,
    predictions: [prediction(MEMBER)],
    ...overrides,
  };
}

const BYE = pairingRow({
  id: "bye-1",
  awayTeamId: null,
  awayTeam: null,
  predictions: [],
});

function roundRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "round-1",
    roundNumber: 1,
    name: null,
    status: "in_progress",
    kind: "swiss",
    bracketSlot: null,
    pairings: [pairingRow(), BYE],
    ...overrides,
  };
}

function pairingContext(scope: string | null, overrides: Record<string, unknown> = {}) {
  return {
    id: "pairing-1",
    status: "scheduled",
    scheduledAt: null,
    predictionsClosedAt: null,
    homeTeamId: "t-home",
    awayTeamId: "t-away",
    homeTeam: { ownerId: HOME },
    awayTeam: { ownerId: AWAY },
    round: { id: "round-1", kind: "swiss", bracketSlot: null, cup: cupRow(scope) },
    ...overrides,
  };
}

function seed(scope: string | null = "members") {
  db.cup.findUnique.mockResolvedValue(cupRow(scope));
  db.cup.update.mockResolvedValue({});
  db.cupRound.findMany.mockResolvedValue([roundRow()]);
  db.cupRound.findUnique.mockResolvedValue({
    id: "round-1",
    kind: "swiss",
    bracketSlot: null,
    cup: cupRow(scope),
    pairings: [
      { id: "pairing-1", status: "scheduled", scheduledAt: null, predictionsClosedAt: null },
    ],
  });
  db.cupPairing.findUnique.mockResolvedValue(pairingContext(scope));
  db.cupPairing.updateMany.mockResolvedValue({ count: 1 });
  db.competitionPrediction.upsert.mockResolvedValue({});
  db.competitionPrediction.deleteMany.mockResolvedValue({ count: 1 });
  db.competitionPrediction.findMany.mockResolvedValue([]);
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
  app.use("/cup", router);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const payload = Buffer.from(options.json ? JSON.stringify(options.json) : "");
      const req = http.request(
        {
          host: "127.0.0.1",
          port: addr.port,
          method,
          path: routePath,
          headers: {
            "content-type": "application/json",
            "content-length": payload.length,
            ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : {} });
          });
        },
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      req.end(payload);
    });
  });
}

type PairingView = {
  id: string;
  eligibility: string;
  closed: boolean;
  predictions: unknown[] | null;
  distribution: unknown;
  canClose: boolean;
};
type RoundView = { id: string; canClose: boolean; pairings: PairingView[] };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /cup/:id/predictions", () => {
  it("401 sans compte", async () => {
    seed();
    const res = await request("GET", "/cup/cup-1/predictions");
    expect(res.status).toBe(401);
  });

  it("404 pour une coupe inconnue", async () => {
    seed();
    db.cup.findUnique.mockResolvedValueOnce(null);
    const res = await request("GET", "/cup/nope/predictions", { token: tokenFor(MEMBER) });
    expect(res.status).toBe(404);
  });

  it("un membre : éligible ailleurs que sur son match, rien des autres avant la clôture, l'exempt écarté", async () => {
    seed();
    const res = await request("GET", "/cup/cup-1/predictions", { token: tokenFor(MEMBER) });
    expect(res.status).toBe(200);
    const data = res.body.data as {
      scope: string;
      viewer: { isMember: boolean; group: string };
      rounds: RoundView[];
    };
    expect(data.scope).toBe("members");
    expect(data.viewer).toMatchObject({ isMember: true, group: "coach" });
    const pairings = data.rounds[0].pairings;
    expect(pairings.map((p) => p.id)).toEqual(["pairing-1"]);
    expect(pairings[0]).toMatchObject({
      eligibility: "ok",
      closed: false,
      predictions: null,
      distribution: null,
      canClose: false,
    });
  });

  it("le coach de la rencontre ne la pronostique pas, mais peut la fermer", async () => {
    seed();
    const res = await request("GET", "/cup/cup-1/predictions", { token: tokenFor(HOME) });
    const pairing = (res.body.data as { rounds: RoundView[] }).rounds[0].pairings[0];
    expect(pairing).toMatchObject({ eligibility: "own-match", canClose: true });
  });

  it("une rencontre close montre les pronostics des autres", async () => {
    seed();
    db.cupRound.findMany.mockResolvedValueOnce([
      roundRow({ pairings: [pairingRow({ predictionsClosedAt: new Date("2026-10-01") })] }),
    ]);
    const res = await request("GET", "/cup/cup-1/predictions", { token: tokenFor(STRANGER) });
    const pairing = (res.body.data as { rounds: RoundView[] }).rounds[0].pairings[0];
    expect(pairing.closed).toBe(true);
    expect(pairing.predictions).toHaveLength(1);
    expect(pairing.distribution).toMatchObject({ home: 1, total: 1 });
  });

  it("un bracket non publié ne fuit pas, sauf pour le commissaire", async () => {
    seed();
    db.cup.findUnique.mockResolvedValue(cupRow("members", { playoffsPublished: false }));
    db.cupRound.findMany.mockResolvedValue([
      roundRow({ id: "final", kind: "playoff", bracketSlot: "final" }),
    ]);
    const member = await request("GET", "/cup/cup-1/predictions", { token: tokenFor(MEMBER) });
    expect((member.body.data as { rounds: RoundView[] }).rounds).toEqual([]);
    const commish = await request("GET", "/cup/cup-1/predictions", { token: tokenFor(COMMISH) });
    const rounds = (commish.body.data as { rounds: RoundView[] }).rounds;
    expect(rounds.map((r) => r.id)).toEqual(["final"]);
    // Une rencontre de bracket non publié est close.
    expect(rounds[0].pairings[0].closed).toBe(true);
  });

  it("coupe antérieure : pronostics coupés, rien n'est lu", async () => {
    seed(null);
    const res = await request("GET", "/cup/cup-1/predictions", { token: tokenFor(COMMISH) });
    expect(res.body.data).toMatchObject({ scope: "off", scopeConfigured: false, rounds: [] });
    expect(db.cupRound.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /cup/:id/predictions/leaderboard", () => {
  it("classe Coachs et Tribunes, le lecteur marqué", async () => {
    seed("open");
    db.competitionPrediction.findMany.mockResolvedValue([
      {
        ...prediction(MEMBER),
        result: "home",
        resultHomeScore: 2,
        resultAwayScore: 0,
        cupPairing: { status: "played" },
      },
      { ...prediction(STRANGER, "away"), result: "home", cupPairing: { status: "played" } },
    ]);
    const res = await request("GET", "/cup/cup-1/predictions/leaderboard", {
      token: tokenFor(STRANGER),
    });
    expect(res.status).toBe(200);
    const data = res.body.data as {
      coach: Array<{ userId: string; points: number }>;
      stands: Array<{ userId: string; points: number; isViewer: boolean }>;
    };
    expect(data.coach).toEqual([expect.objectContaining({ userId: MEMBER, points: 3 })]);
    expect(data.stands).toEqual([
      expect.objectContaining({ userId: STRANGER, points: 0, isViewer: true }),
    ]);
  });
});

describe("PUT /cup/pairings/:id/prediction", () => {
  it("un membre pronostique", async () => {
    seed();
    const res = await request("PUT", "/cup/pairings/pairing-1/prediction", {
      token: tokenFor(MEMBER),
      json: { pick: "home", homeScore: 2, awayScore: 1 },
    });
    expect(res.status).toBe(200);
    expect(db.competitionPrediction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cupPairingId_userId: { cupPairingId: "pairing-1", userId: MEMBER } },
      }),
    );
  });

  it.each([
    ["son propre match", HOME, "members", {}, 403],
    ["un non-membre en portée membres", STRANGER, "members", {}, 403],
    ["pronostics coupés", MEMBER, "off", {}, 403],
    ["rencontre close", MEMBER, "members", { predictionsClosedAt: new Date("2026-10-01") }, 409],
  ] as const)("refuse %s", async (_label, userId, scope, overrides, status) => {
    seed(scope);
    db.cupPairing.findUnique.mockResolvedValue(pairingContext(scope, overrides));
    const res = await request("PUT", "/cup/pairings/pairing-1/prediction", {
      token: tokenFor(userId),
      json: { pick: "home" },
    });
    expect(res.status).toBe(status);
    expect(db.competitionPrediction.upsert).not.toHaveBeenCalled();
  });

  it("un non-membre pronostique en portée « tout le monde »", async () => {
    seed("open");
    const res = await request("PUT", "/cup/pairings/pairing-1/prediction", {
      token: tokenFor(STRANGER),
      json: { pick: "draw" },
    });
    expect(res.status).toBe(200);
  });

  it("400 pour un score qui contredit l'issue", async () => {
    seed();
    const res = await request("PUT", "/cup/pairings/pairing-1/prediction", {
      token: tokenFor(MEMBER),
      json: { pick: "home", homeScore: 0, awayScore: 1 },
    });
    expect(res.status).toBe(400);
  });

  it("404 pour un exempt : ce n'est pas une rencontre", async () => {
    seed();
    db.cupPairing.findUnique.mockResolvedValue(
      pairingContext("members", { awayTeamId: null, awayTeam: null }),
    );
    const res = await request("PUT", "/cup/pairings/pairing-1/prediction", {
      token: tokenFor(MEMBER),
      json: { pick: "home" },
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /cup/pairings/:id/prediction", () => {
  it("retire son pronostic, 404 s'il n'y en a pas", async () => {
    seed();
    const ok = await request("DELETE", "/cup/pairings/pairing-1/prediction", {
      token: tokenFor(MEMBER),
    });
    expect(ok.status).toBe(200);
    db.competitionPrediction.deleteMany.mockResolvedValueOnce({ count: 0 });
    const none = await request("DELETE", "/cup/pairings/pairing-1/prediction", {
      token: tokenFor(MEMBER),
    });
    expect(none.status).toBe(404);
  });
});

describe("clôtures manuelles", () => {
  it("une rencontre : ses coachs et le commissaire, pas un autre membre", async () => {
    seed();
    const refused = await request("POST", "/cup/pairings/pairing-1/predictions/close", {
      token: tokenFor(MEMBER),
    });
    expect(refused.status).toBe(403);
    const ok = await request("POST", "/cup/pairings/pairing-1/predictions/close", {
      token: tokenFor(AWAY),
    });
    expect(ok.status).toBe(200);
    expect(db.cupPairing.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pairing-1", predictionsClosedAt: null } }),
    );
  });

  it("une ronde : le commissaire ou un admin seulement", async () => {
    seed();
    const refused = await request("POST", "/cup/rounds/round-1/predictions/close", {
      token: tokenFor(HOME),
    });
    expect(refused.status).toBe(403);
    const ok = await request("POST", "/cup/rounds/round-1/predictions/close", {
      token: tokenFor(ADMIN, ["admin"]),
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual({ closed: 1 });
  });
});

describe("PATCH /cup/:id/predictions-scope", () => {
  it("le commissaire règle la portée, pas un coach ; une valeur inconnue est refusée", async () => {
    seed();
    const refused = await request("PATCH", "/cup/cup-1/predictions-scope", {
      token: tokenFor(MEMBER),
      json: { scope: "open" },
    });
    expect(refused.status).toBe(403);
    const invalid = await request("PATCH", "/cup/cup-1/predictions-scope", {
      token: tokenFor(COMMISH),
      json: { scope: "everyone" },
    });
    expect(invalid.status).toBe(400);
    const ok = await request("PATCH", "/cup/cup-1/predictions-scope", {
      token: tokenFor(COMMISH),
      json: { scope: "open" },
    });
    expect(ok.status).toBe(200);
    expect(db.cup.update).toHaveBeenCalledWith({
      where: { id: "cup-1" },
      data: { predictionsScope: "open" },
    });
  });
});
