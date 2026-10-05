/**
 * GET / PATCH /admin/leagues/:id — fiche et édition d'une ligue par un
 * administrateur, sans être son commissaire.
 *
 * La visibilité se change à tout moment (règle de lecture) ; le barème reste
 * figé dès qu'un match a été scoré (même verrou que `PATCH /leagues/:id`).
 *
 * Chaîne Express réelle, Prisma mocké (cf. `admin-leagues-standings-order`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    league: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    match: {
      count: vi.fn(),
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
import adminLeaguesRouter from "./admin-leagues";
import { prisma } from "../prisma";

interface MockedPrisma {
  league: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  match: { count: ReturnType<typeof vi.fn> };
}

const mockedPrisma = prisma as unknown as MockedPrisma;

async function call(
  method: "GET" | "PATCH",
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/admin/leagues", adminLeaguesRouter);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const data = body ? JSON.stringify(body) : "";
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data).toString(),
            Authorization: "Bearer dummy",
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
      if (data) req.write(data);
      req.end();
    });
  });
}

const LEAGUE_ROW = {
  id: "l1",
  name: "Ligue du Chaudron",
  description: null,
  isPublic: true,
  maxParticipants: 8,
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  forfeitPoints: -1,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /admin/leagues/:id", () => {
  it("renvoie la fiche, les saisons avec leurs inscrits et le verrou", async () => {
    mockedPrisma.league.findUnique.mockResolvedValue({
      ...LEAGUE_ROW,
      ruleset: "season_3",
      status: "in_progress",
      isPublic: false,
      creatorId: "commish",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
      creator: { id: "commish", coachName: "Commish", email: "c@x.io" },
      seasons: [
        {
          id: "s1",
          seasonNumber: 1,
          name: "Saison 1",
          status: "in_progress",
          startDate: null,
          endDate: null,
          _count: { participants: 6 },
          participants: [
            {
              status: "active",
              team: {
                id: "t1",
                name: "Les Rats",
                roster: "skaven",
                deletedAt: null,
                owner: { id: "u2", coachName: "Ratman" },
              },
            },
          ],
        },
      ],
    });
    mockedPrisma.match.count.mockResolvedValue(2);

    const res = await call("GET", "/admin/leagues/l1");

    expect(res.status).toBe(200);
    expect(res.body.data.isPublic).toBe(false);
    expect(res.body.data.scoringLocked).toBe(true);
    expect(res.body.data.creator.email).toBe("c@x.io");
    expect(res.body.data.seasons).toEqual([
      expect.objectContaining({ id: "s1", participantsCount: 6 }),
    ]);
    expect(res.body.data.seasons[0]._count).toBeUndefined();
    expect(res.body.data.seasons[0].participants).toEqual([
      {
        teamId: "t1",
        teamName: "Les Rats",
        roster: "skaven",
        coachName: "Ratman",
        status: "active",
        deleted: false,
      },
    ]);
  });

  it("404 sur une ligue inconnue", async () => {
    mockedPrisma.league.findUnique.mockResolvedValue(null);
    const res = await call("GET", "/admin/leagues/nope");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /admin/leagues/:id", () => {
  it("change la visibilité même une fois la ligue verrouillée", async () => {
    mockedPrisma.league.findUnique.mockResolvedValue({ id: "l1" });
    mockedPrisma.match.count.mockResolvedValue(5);
    mockedPrisma.league.update.mockResolvedValue({
      ...LEAGUE_ROW,
      isPublic: false,
    });

    const res = await call("PATCH", "/admin/leagues/l1", { isPublic: false });

    expect(res.status).toBe(200);
    expect(mockedPrisma.league.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { isPublic: false },
    });
    expect(res.body.data.isPublic).toBe(false);
  });

  it("édite nom, description et capacité", async () => {
    mockedPrisma.league.findUnique.mockResolvedValue({ id: "l1" });
    mockedPrisma.league.update.mockResolvedValue({
      ...LEAGUE_ROW,
      name: "Nouveau nom",
    });

    const res = await call("PATCH", "/admin/leagues/l1", {
      name: "  Nouveau nom ",
      description: "Desc",
      maxParticipants: 12,
    });

    expect(res.status).toBe(200);
    expect(mockedPrisma.league.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { name: "Nouveau nom", description: "Desc", maxParticipants: 12 },
    });
  });

  it("409 sur le barème quand un match a été scoré, sans écrire", async () => {
    mockedPrisma.league.findUnique.mockResolvedValue({ id: "l1" });
    mockedPrisma.match.count.mockResolvedValue(1);

    const res = await call("PATCH", "/admin/leagues/l1", { winPoints: 4 });

    expect(res.status).toBe(409);
    expect(mockedPrisma.league.update).not.toHaveBeenCalled();
  });

  it("accepte le barème tant qu'aucun match n'a été scoré", async () => {
    mockedPrisma.league.findUnique.mockResolvedValue({ id: "l1" });
    mockedPrisma.match.count.mockResolvedValue(0);
    mockedPrisma.league.update.mockResolvedValue({
      ...LEAGUE_ROW,
      winPoints: 4,
    });

    const res = await call("PATCH", "/admin/leagues/l1", { winPoints: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data.winPoints).toBe(4);
  });

  it("400 sur un body vide ou hors bornes", async () => {
    expect((await call("PATCH", "/admin/leagues/l1", {})).status).toBe(400);
    expect(
      (await call("PATCH", "/admin/leagues/l1", { maxParticipants: 1 }))
        .status,
    ).toBe(400);
    expect(mockedPrisma.league.update).not.toHaveBeenCalled();
  });

  it("refuse les champs hors périmètre admin (édition, rosters)", async () => {
    mockedPrisma.league.findUnique.mockResolvedValue({ id: "l1" });
    mockedPrisma.league.update.mockResolvedValue(LEAGUE_ROW);

    const res = await call("PATCH", "/admin/leagues/l1", {
      name: "X",
      ruleset: "season_2",
    });

    // Le schéma ne retient pas `ruleset` : seul le nom est écrit.
    expect(res.status).toBe(200);
    expect(mockedPrisma.league.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { name: "X" },
    });
  });

  it("404 sur une ligue inconnue", async () => {
    mockedPrisma.league.findUnique.mockResolvedValue(null);
    const res = await call("PATCH", "/admin/leagues/nope", { isPublic: true });
    expect(res.status).toBe(404);
  });
});
