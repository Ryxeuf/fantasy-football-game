/**
 * Retrait d'une équipe d'une coupe — la VRAIE chaîne Express : routeur
 * `/cup`, `authUser` avec de vrais JWT, `validate(schema)`, service
 * `cup-team-removal` réel, Prisma mocké. Sous test :
 *
 *   - le commissaire retire l'équipe d'un AUTRE coach, y compris une fois
 *     les inscriptions closes (c'était impossible : seul le propriétaire
 *     pouvait, et seulement coupe ouverte) ;
 *   - le propriétaire garde son retrait coupe ouverte, mais plus après ;
 *   - un tiers est refusé, une rencontre ouverte bloque le retrait.
 *
 * Pattern `http.createServer(express())` + `http.request` natif
 * (cf. `routes/league-access.test.ts`) : supertest n'est pas dans les deps.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";

vi.mock("../prisma", () => ({
  prisma: {
    cup: { findUnique: vi.fn() },
    cupParticipant: { findUnique: vi.fn(), delete: vi.fn() },
    cupPairing: { count: vi.fn() },
  },
}));

vi.mock("../services/in-app-notifications", () => ({
  createInAppNotification: vi.fn(),
}));

import router from "./cup";
import { prisma } from "../prisma";
import { createInAppNotification } from "../services/in-app-notifications";
import { JWT_SECRET } from "../config";

type MockFn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  cup: { findUnique: MockFn };
  cupParticipant: { findUnique: MockFn; delete: MockFn };
  cupPairing: { count: MockFn };
};
const notify = createInAppNotification as unknown as MockFn;

const COMMISH = "commish";
const COACH = "coach-1";

function tokenFor(userId: string, roles: readonly string[] = ["user"]): string {
  return jwt.sign({ sub: userId, roles: [...roles] }, JWT_SECRET);
}

function post(
  path: string,
  body: unknown,
  token: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = express();
  app.use(express.json());
  app.use("/cup", router);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      const payload = JSON.stringify(body);
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path,
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
            authorization: `Bearer ${token}`,
          },
        },
        (res) => {
          let raw = "";
          res.on("data", (c) => (raw += c));
          res.on("end", () => {
            server.close();
            resolve({
              status: res.statusCode ?? 0,
              body: raw ? (JSON.parse(raw) as Record<string, unknown>) : {},
            });
          });
        },
      );
      req.on("error", (e) => {
        server.close();
        reject(e);
      });
      req.end(payload);
    });
  });
}

/**
 * `cup.findUnique` sert deux lectures : l'en-tête du service (`select`) puis
 * la coupe rechargée par la route (`include`), désormais sans l'équipe.
 */
function serveCup(status: string, validated: boolean) {
  const header = {
    id: "cup-1",
    name: "Coupe du Chaos",
    creatorId: COMMISH,
    status,
    validated,
  };
  db.cup.findUnique.mockImplementation(async (args: { include?: unknown }) =>
    args?.include
      ? {
          ...header,
          isPublic: true,
          creator: { id: COMMISH, coachName: "Commish" },
          participants: [],
          createdAt: new Date(0),
          updatedAt: new Date(0),
        }
      : header,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  serveCup("en_cours", true);
  db.cupParticipant.findUnique.mockResolvedValue({
    id: "part-1",
    team: { name: "Les Rats", ownerId: COACH },
  });
  db.cupPairing.count.mockResolvedValue(0);
  db.cupParticipant.delete.mockResolvedValue({ id: "part-1" });
  notify.mockResolvedValue({ id: "n-1" });
});

describe("POST /cup/:id/unregister", () => {
  it("le commissaire retire l'équipe d'un coach d'une coupe en cours", async () => {
    const res = await post(
      "/cup/cup-1/unregister",
      { teamId: "team-1" },
      tokenFor(COMMISH),
    );

    expect(res.status).toBe(200);
    expect(db.cupParticipant.delete).toHaveBeenCalledWith({ where: { id: "part-1" } });
    expect((res.body.cup as { participantCount: number }).participantCount).toBe(0);
    expect(notify.mock.calls[0][0]).toMatchObject({
      userId: COACH,
      kind: "cup.team_removed",
    });
  });

  it("le propriétaire retire son équipe tant que la coupe est ouverte", async () => {
    serveCup("ouverte", false);
    const res = await post(
      "/cup/cup-1/unregister",
      { teamId: "team-1" },
      tokenFor(COACH),
    );
    expect(res.status).toBe(200);
    expect(notify).not.toHaveBeenCalled();
  });

  it("refuse le propriétaire une fois les inscriptions closes (400)", async () => {
    const res = await post(
      "/cup/cup-1/unregister",
      { teamId: "team-1" },
      tokenFor(COACH),
    );
    expect(res.status).toBe(400);
    expect(db.cupParticipant.delete).not.toHaveBeenCalled();
  });

  it("refuse un tiers (403)", async () => {
    const res = await post(
      "/cup/cup-1/unregister",
      { teamId: "team-1" },
      tokenFor("intrus"),
    );
    expect(res.status).toBe(403);
    expect(db.cupParticipant.delete).not.toHaveBeenCalled();
  });

  it("refuse tant qu'une rencontre de l'équipe est ouverte (409)", async () => {
    db.cupPairing.count.mockResolvedValue(1);
    const res = await post(
      "/cup/cup-1/unregister",
      { teamId: "team-1" },
      tokenFor(COMMISH),
    );
    expect(res.status).toBe(409);
    expect(String(res.body.error)).toMatch(/forfait/);
    expect(db.cupParticipant.delete).not.toHaveBeenCalled();
  });

  it("refuse une coupe terminée, sauf administrateur avec `force`", async () => {
    serveCup("terminee", true);
    const refused = await post(
      "/cup/cup-1/unregister",
      { teamId: "team-1" },
      tokenFor(COMMISH),
    );
    expect(refused.status).toBe(409);

    const forced = await post(
      "/cup/cup-1/unregister",
      { teamId: "team-1", force: true },
      tokenFor("admin-1", ["admin"]),
    );
    expect(forced.status).toBe(200);
  });

  it("refuse un corps sans équipe (400, validation Zod)", async () => {
    const res = await post("/cup/cup-1/unregister", {}, tokenFor(COMMISH));
    expect(res.status).toBe(400);
    expect(db.cup.findUnique).not.toHaveBeenCalled();
  });
});
