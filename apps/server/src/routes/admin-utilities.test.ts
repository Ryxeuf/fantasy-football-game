/**
 * Tests d'integration POST /admin/utilities/seed/pro-league.
 *
 * Couvre : succes (durationMs + counts), erreur seeder, audit log strict.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeague: { count: vi.fn(async () => 1) },
    proTeam: { count: vi.fn(async () => 16) },
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

vi.mock("../services/audit-log", () => ({
  safeRecordAdminActionFromRequest: vi.fn(async () => {}),
}));

const seedProLeague = vi.fn(async () => {});

vi.mock("../seeders/pro-league", () => ({
  seedProLeague: () => seedProLeague(),
}));

import express from "express";
import http from "http";
import utilitiesRouter from "./admin-utilities";
import { prisma } from "../prisma";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";

const mockedAudit = vi.mocked(safeRecordAdminActionFromRequest);

async function postSeed(): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/admin/utilities", utilitiesRouter);
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
          path: "/admin/utilities/seed/pro-league",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": "2",
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
      req.write("{}");
      req.end();
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /admin/utilities/seed/pro-league", () => {
  it("execute seedProLeague + retourne counts + audit log", async () => {
    seedProLeague.mockResolvedValueOnce(undefined);

    const res = await postSeed();

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.leagueCount).toBe(1);
    expect(res.body.teamCount).toBe(16);
    expect(typeof res.body.durationMs).toBe("number");
    expect(res.body.durationMs).toBeGreaterThanOrEqual(0);
    expect(res.body.message).toMatch(/16 equipes/i);
    expect(seedProLeague).toHaveBeenCalledTimes(1);
    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({
        action: "utility.seed.pro-league.run",
        entity: "ProLeague",
        newValue: expect.objectContaining({
          leagueCount: 1,
          teamCount: 16,
        }),
      }),
    );
  });

  it("500 si le seeder throw, message d'erreur lisible, durationMs present", async () => {
    seedProLeague.mockRejectedValueOnce(new Error("DB connection lost"));

    const res = await postSeed();

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/DB connection lost/);
    expect(typeof res.body.durationMs).toBe("number");
    // Pas d'audit log sur echec (l'action n'a pas reussi).
    expect(mockedAudit).not.toHaveBeenCalled();
  });
});
