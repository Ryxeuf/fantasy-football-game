/**
 * Tests de `GET /admin/teams/:id` — la fiche d'équipe de la console admin.
 *
 * Ce que la route doit garantir pour que la page web puisse afficher les
 * mêmes informations que la fiche coach :
 *  - les Star Players sont ENRICHIS par le catalogue (nom, carac, compétences)
 *    et pas réduits à leur slug ;
 *  - un slug absent du catalogue ne casse pas la réponse ;
 *  - `ownerTeams` liste toutes les équipes du propriétaire (soft-deletées
 *    comprises, marquées comme telles) pour la navigation latérale.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    team: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
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

vi.mock("../utils/star-player-repository", () => ({
  getStarPlayerBySlugDb: vi.fn(),
}));

vi.mock("../services/audit-log", () => ({
  safeRecordAdminActionFromRequest: vi.fn(async () => {}),
}));

vi.mock("./auth", () => ({
  getRefreshTokenStore: () => ({ revokeAllForUser: vi.fn(async () => {}) }),
}));

import express from "express";
import http from "http";
import adminRouter from "./admin";
import { prisma } from "../prisma";
import { getStarPlayerBySlugDb } from "../utils/star-player-repository";

const mockedPrisma = prisma as unknown as {
  team: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};
const mockedStarPlayer = vi.mocked(getStarPlayerBySlugDb);

function get(path: string): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRouter);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: `/admin${path}`,
          method: "GET",
          headers: { Authorization: "Bearer dummy" },
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
      req.end();
    });
  });
}

const TEAM = {
  id: "team-1",
  ownerId: "user-1",
  name: "Les Gones Kass'Krânes",
  roster: "black_orc",
  ruleset: "season_3",
  treasury: 505000,
  teamValue: 1000000,
  currentValue: 1000000,
  owner: {
    id: "user-1",
    email: "coach@example.com",
    name: "Davouille",
    coachName: "Davouille",
  },
  players: [
    {
      id: "p1",
      name: "Juninhorc",
      position: "black_orc_orque_noir",
      number: 2,
      skills: "brawler,grab",
    },
  ],
  starPlayers: [
    { id: "sp1", starPlayerSlug: "griff_oberwald", cost: 280000, hiredAt: new Date(0) },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /admin/teams/:id", () => {
  it("enrichit les Star Players avec le catalogue", async () => {
    mockedPrisma.team.findUnique.mockResolvedValue(TEAM);
    mockedPrisma.team.findMany.mockResolvedValue([]);
    mockedStarPlayer.mockResolvedValue({
      slug: "griff_oberwald",
      displayName: "Griff Oberwald",
      cost: 280000,
      ma: 7,
      st: 4,
      ag: 2,
      pa: 3,
      av: 10,
      skills: "block,dodge,fend,sprint,sure_feet",
      hirableBy: [],
    } as any);

    const res = await get("/teams/team-1");

    expect(res.status).toBe(200);
    expect(res.body.team.starPlayers).toHaveLength(1);
    expect(res.body.team.starPlayers[0]).toMatchObject({
      id: "sp1",
      slug: "griff_oberwald",
      cost: 280000,
      displayName: "Griff Oberwald",
      skills: "block,dodge,fend,sprint,sure_feet",
    });
    expect(mockedStarPlayer).toHaveBeenCalledWith("griff_oberwald", "season_3");
  });

  it("retombe sur slug + coût quand le catalogue ne connaît pas le Star Player", async () => {
    mockedPrisma.team.findUnique.mockResolvedValue(TEAM);
    mockedPrisma.team.findMany.mockResolvedValue([]);
    mockedStarPlayer.mockResolvedValue(null);

    const res = await get("/teams/team-1");

    expect(res.status).toBe(200);
    expect(res.body.team.starPlayers[0]).toMatchObject({
      slug: "griff_oberwald",
      cost: 280000,
    });
    expect(res.body.team.starPlayers[0].displayName).toBeUndefined();
  });

  it("liste les autres équipes du propriétaire, soft-deletées marquées", async () => {
    mockedPrisma.team.findUnique.mockResolvedValue(TEAM);
    mockedStarPlayer.mockResolvedValue(null);
    mockedPrisma.team.findMany.mockResolvedValue([
      {
        id: "team-1",
        name: "Les Gones Kass'Krânes",
        roster: "black_orc",
        ruleset: "season_3",
        teamValue: 1000000,
        currentValue: 1000000,
        createdAt: new Date("2026-08-26T23:36:50.000Z"),
        deletedAt: null,
        _count: { players: 12 },
      },
      {
        id: "team-2",
        name: "NOr VP",
        roster: "norse",
        ruleset: "season_3",
        teamValue: 990000,
        currentValue: 990000,
        createdAt: new Date("2026-08-25T10:00:00.000Z"),
        deletedAt: new Date("2026-08-26T10:00:00.000Z"),
        _count: { players: 11 },
      },
    ]);

    const res = await get("/teams/team-1");

    expect(res.status).toBe(200);
    expect(mockedPrisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: "user-1" } }),
    );
    expect(res.body.ownerTeams).toHaveLength(2);
    expect(res.body.ownerTeams[0]).toMatchObject({
      id: "team-1",
      playerCount: 12,
      deletedAt: null,
    });
    expect(res.body.ownerTeams[1].deletedAt).not.toBeNull();
  });

  it("404 quand l'équipe n'existe pas", async () => {
    mockedPrisma.team.findUnique.mockResolvedValue(null);

    const res = await get("/teams/nope");

    expect(res.status).toBe(404);
    expect(mockedPrisma.team.findMany).not.toHaveBeenCalled();
  });
});
