/**
 * PATCH /admin/leagues/:id/standings-order — réordonnancement des critères
 * de classement par un administrateur.
 *
 * C'est le seul chemin qui reste ouvert une fois la ligue verrouillée par
 * un match joué (`PATCH /leagues/:id` répond alors 409) : l'ordre ne touche
 * à rien de persisté, le classement est trié à la lecture.
 *
 * Chaîne Express réelle, Prisma mocké (cf. `routes/admin-soft-delete.test.ts`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    league: {
      findUnique: vi.fn(),
      update: vi.fn(),
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
}

const mockedPrisma = prisma as unknown as MockedPrisma;

async function patchOrder(
  leagueId: string,
  body: Record<string, unknown>,
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
      const data = JSON.stringify(body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: `/admin/leagues/${leagueId}/standings-order`,
          method: "PATCH",
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
      req.write(data);
      req.end();
    });
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PATCH /admin/leagues/:id/standings-order", () => {
  it("persiste l'ordre saisi, sentinelle « name » comprise", async () => {
    mockedPrisma.league.findUnique.mockResolvedValue({
      id: "l1",
      tieBreakRules: null,
    });
    mockedPrisma.league.update.mockResolvedValue({ id: "l1" });

    const res = await patchOrder("l1", {
      tieBreakRules: ["points", "cas_for"],
    });

    expect(res.status).toBe(200);
    expect(mockedPrisma.league.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { tieBreakRules: JSON.stringify(["points", "cas_for", "name"]) },
    });
    expect(res.body.data.tieBreakRules).toEqual([
      "points",
      "cas_for",
      "name",
    ]);
    expect(res.body.data.effectiveTieBreakRules).toEqual([
      "points",
      "cas_for",
      "name",
    ]);
  });

  it("accepte les critères bonus et forfaits", async () => {
    mockedPrisma.league.findUnique.mockResolvedValue({
      id: "l1",
      tieBreakRules: null,
    });
    mockedPrisma.league.update.mockResolvedValue({ id: "l1" });

    const res = await patchOrder("l1", {
      tieBreakRules: ["points", "bonus_points", "forfeit_points"],
    });

    expect(res.status).toBe(200);
    expect(res.body.data.effectiveTieBreakRules).toEqual([
      "points",
      "bonus_points",
      "forfeit_points",
      "name",
    ]);
  });

  it("`null` remet la ligue sur l'ordre par défaut", async () => {
    mockedPrisma.league.findUnique.mockResolvedValue({
      id: "l1",
      tieBreakRules: JSON.stringify(["cas_for", "name"]),
    });
    mockedPrisma.league.update.mockResolvedValue({ id: "l1" });

    const res = await patchOrder("l1", { tieBreakRules: null });

    expect(res.status).toBe(200);
    expect(mockedPrisma.league.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { tieBreakRules: null },
    });
    expect(res.body.data.tieBreakRules).toBeNull();
    expect(res.body.data.effectiveTieBreakRules).toEqual([
      "points",
      "bonus_points",
      "forfeit_points",
      "td_diff",
      "cas_diff",
      "name",
    ]);
  });

  it("404 sur une ligue inconnue, sans écrire", async () => {
    mockedPrisma.league.findUnique.mockResolvedValue(null);

    const res = await patchOrder("nope", { tieBreakRules: ["points"] });

    expect(res.status).toBe(404);
    expect(mockedPrisma.league.update).not.toHaveBeenCalled();
  });

  it("400 sur un slug inconnu, sans écrire", async () => {
    mockedPrisma.league.findUnique.mockResolvedValue({
      id: "l1",
      tieBreakRules: null,
    });

    const res = await patchOrder("l1", { tieBreakRules: ["points", "elo?"] });

    expect(res.status).toBe(400);
    expect(mockedPrisma.league.update).not.toHaveBeenCalled();
  });

  it("400 quand le champ manque (le body vide n'efface rien par accident)", async () => {
    mockedPrisma.league.findUnique.mockResolvedValue({
      id: "l1",
      tieBreakRules: null,
    });

    const res = await patchOrder("l1", {});

    expect(res.status).toBe(400);
    expect(mockedPrisma.league.update).not.toHaveBeenCalled();
  });
});
