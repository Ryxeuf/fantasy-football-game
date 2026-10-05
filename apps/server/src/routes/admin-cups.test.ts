/**
 * GET /admin/cups — liste admin des coupes (filtres serveur, pagination,
 * compteurs globaux).
 *
 * Chaîne Express réelle, Prisma mocké (cf. `admin-leagues-standings-order`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    cup: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

vi.mock("../middleware/authUser", () => ({
  authUser: (req: any, _res: any, next: any) => {
    req.user = { id: "admin-1", role: "admin", roles: ["admin"] };
    return next();
  },
}));

vi.mock("../middleware/adminOnly", () => ({
  adminOnly: (_req: any, _res: any, next: any) => next(),
}));

import express from "express";
import http from "http";
import adminCupsRouter, { buildAdminCupsWhere } from "./admin-cups";
import { prisma } from "../prisma";

interface MockedPrisma {
  cup: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
}

const mockedPrisma = prisma as unknown as MockedPrisma;

async function get(path: string): Promise<{ status: number; body: any }> {
  const app = express();
  app.use("/admin/cups", adminCupsRouter);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      http
        .get(
          { hostname: "127.0.0.1", port: addr.port, path },
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
        )
        .on("error", (e) => {
          server.close();
          reject(e);
        });
    });
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("buildAdminCupsWhere", () => {
  it("sans filtre : tout le parc, privées et archivées comprises", () => {
    expect(buildAdminCupsWhere({})).toEqual({});
  });

  it("combine statut, visibilité et recherche (nom ou créateur)", () => {
    expect(
      buildAdminCupsWhere({
        status: "en_cours",
        visibility: "private",
        search: " chaos ",
      }),
    ).toEqual({
      status: "en_cours",
      isPublic: false,
      OR: [
        { name: { contains: "chaos", mode: "insensitive" } },
        { creator: { coachName: { contains: "chaos", mode: "insensitive" } } },
        { creator: { email: { contains: "chaos", mode: "insensitive" } } },
      ],
    });
    expect(buildAdminCupsWhere({ visibility: "public" })).toEqual({
      isPublic: true,
    });
  });
});

describe("GET /admin/cups", () => {
  it("liste les coupes avec leur nombre d'équipes et les compteurs", async () => {
    mockedPrisma.cup.findMany.mockResolvedValue([
      {
        id: "c1",
        name: "Coupe du Chaos",
        description: null,
        ruleset: "season_3",
        format: "bb11",
        status: "ouverte",
        validated: false,
        isPublic: false,
        creatorId: "u1",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
        creator: { id: "u1", coachName: "Coach", email: "c@x.io" },
        _count: { participants: 4 },
      },
    ]);
    mockedPrisma.cup.count.mockResolvedValue(1);
    mockedPrisma.cup.groupBy
      .mockResolvedValueOnce([
        { status: "ouverte", _count: { _all: 3 } },
        { status: "archivee", _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { isPublic: true, _count: { _all: 3 } },
        { isPublic: false, _count: { _all: 1 } },
      ]);

    const res = await get("/admin/cups?visibility=private&limit=10");

    expect(res.status).toBe(200);
    expect(mockedPrisma.cup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isPublic: false },
        take: 10,
        skip: 0,
      }),
    );
    expect(res.body.data.cups).toEqual([
      expect.objectContaining({ id: "c1", participantCount: 4 }),
    ]);
    expect(res.body.data.cups[0]._count).toBeUndefined();
    expect(res.body.data.counts).toEqual({
      total: 4,
      status: { ouverte: 3, archivee: 1 },
      public: 3,
      private: 1,
    });
    expect(res.body.meta).toEqual({ total: 1, limit: 10, page: 0 });
  });

  it("400 sur un statut ou une visibilité inconnus", async () => {
    expect((await get("/admin/cups?status=nope")).status).toBe(400);
    expect((await get("/admin/cups?visibility=hidden")).status).toBe(400);
    expect(mockedPrisma.cup.findMany).not.toHaveBeenCalled();
  });
});
