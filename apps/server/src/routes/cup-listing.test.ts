/**
 * `GET /cup` — la VRAIE chaîne Express (routeur `/cup`, `authUser` avec de
 * vrais JWT, `validateQuery(listCupsQuerySchema)`), Prisma mocké. Sous test
 * (change OpenSpec `my-competitions`) :
 *
 *   - sans `scope` : la réponse d'aujourd'hui (publiques non archivées + les
 *     miennes) ;
 *   - `scope=mine` : les seules coupes « à moi », côté serveur ;
 *   - valeur inconnue : 400 ;
 *   - `publicOnly=false` reste réservé à l'admin.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";

vi.mock("../prisma", () => ({
  prisma: {
    cup: { findMany: vi.fn(), update: vi.fn() },
    cupParticipant: { findMany: vi.fn() },
    team: { findMany: vi.fn() },
  },
}));

import router from "./cup";
import { prisma } from "../prisma";
import { JWT_SECRET } from "../config";

type MockFn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  cup: { findMany: MockFn; update: MockFn };
  cupParticipant: { findMany: MockFn };
  team: { findMany: MockFn };
};

const COACH = "coach-1";

function tokenFor(userId: string, roles: readonly string[] = ["user"]): string {
  return jwt.sign({ sub: userId, roles: [...roles] }, JWT_SECRET);
}

function get(
  path: string,
  token?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = express();
  app.use(express.json());
  app.use("/cup", router);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path,
          method: "GET",
          headers: token ? { authorization: `Bearer ${token}` } : {},
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
      req.end();
    });
  });
}

function whereOfFindMany(): Record<string, unknown> {
  return (db.cup.findMany.mock.calls[0]?.[0] as { where: Record<string, unknown> })
    .where;
}

beforeEach(() => {
  vi.resetAllMocks();
  db.cup.findMany.mockResolvedValue([]);
  db.cupParticipant.findMany.mockResolvedValue([]);
});

describe("GET /cup — scope", () => {
  it("sans scope : publiques non archivées + les miennes, sans pré-chargement d'équipes", async () => {
    const res = await get("/cup", tokenFor(COACH));
    expect(res.status).toBe(200);
    expect(whereOfFindMany()).toEqual({
      status: { not: "archivee" },
      OR: [
        { isPublic: true },
        { creatorId: COACH },
        { participants: { some: { team: { ownerId: COACH } } } },
      ],
    });
    expect(db.team.findMany).not.toHaveBeenCalled();
  });

  it("scope=mine : les seules coupes à moi", async () => {
    const res = await get("/cup?scope=mine", tokenFor(COACH));
    expect(res.status).toBe(200);
    expect(whereOfFindMany()).toEqual({
      status: { not: "archivee" },
      OR: [
        { creatorId: COACH },
        { participants: { some: { team: { ownerId: COACH } } } },
      ],
    });
  });

  it("scope=friends : 400", async () => {
    const res = await get("/cup?scope=friends", tokenFor(COACH));
    expect(res.status).toBe(400);
    expect(db.cup.findMany).not.toHaveBeenCalled();
  });

  it("publicOnly=false d'un coach : ignoré (visibilité normale)", async () => {
    await get("/cup?publicOnly=false", tokenFor(COACH));
    expect(whereOfFindMany()).toHaveProperty("OR");
  });

  it("publicOnly=false d'un admin : vue complète", async () => {
    await get("/cup?publicOnly=false", tokenFor("admin-1", ["user", "admin"]));
    expect(whereOfFindMany()).toEqual({});
  });

  it("401 sans jeton", async () => {
    const res = await get("/cup");
    expect(res.status).toBe(401);
  });
});
