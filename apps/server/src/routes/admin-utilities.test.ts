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

const syncRosters = vi.fn();

vi.mock("../seeders/sync-rosters", () => ({
  syncRosters: (opts: unknown) => syncRosters(opts),
}));

import express from "express";
import http from "http";
import utilitiesRouter from "./admin-utilities";
import { prisma } from "../prisma";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";

const mockedAudit = vi.mocked(safeRecordAdminActionFromRequest);

/** POST générique vers un utilitaire avec un body JSON arbitraire. */
async function postUtility(
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/admin/utilities", utilitiesRouter);
  const server = http.createServer(app);
  const payload = JSON.stringify(body);
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
          path,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload).toString(),
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
      req.write(payload);
      req.end();
    });
  });
}

const DRY_RUN_RESULT = {
  write: false,
  upserted: 2,
  pruned: 1,
  skillLinks: 2,
  upsertedPositions: [],
  prunedPositions: [
    {
      roster: "high_elf",
      ruleset: "season_3",
      slug: "high_elf_blitzer_old",
      displayName: "Blitzer Haut Elfe",
    },
  ],
  missingSkills: [],
  missingRosters: [],
};

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

describe("POST /admin/utilities/sync-rosters", () => {
  it("dry-run par défaut (body vide) : renvoie le diff, n'écrit pas, pas d'audit", async () => {
    syncRosters.mockResolvedValueOnce(DRY_RUN_RESULT);

    const res = await postUtility("/admin/utilities/sync-rosters", {});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.write).toBe(false);
    expect(res.body.pruned).toBe(1);
    expect(res.body.prunedPositions).toHaveLength(1);
    expect(res.body.message).toMatch(/Dry-run/i);
    // Le service est appelé avec write=false (défaut Zod).
    expect(syncRosters).toHaveBeenCalledWith(
      expect.objectContaining({ write: false }),
    );
    // CRITIQUE : pas d'audit log pour un dry-run (aucun effet de bord).
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("write=true : applique et trace un audit log", async () => {
    syncRosters.mockResolvedValueOnce({
      ...DRY_RUN_RESULT,
      write: true,
    });

    const res = await postUtility("/admin/utilities/sync-rosters", {
      write: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.write).toBe(true);
    expect(res.body.message).toMatch(/Appliqué/i);
    expect(syncRosters).toHaveBeenCalledWith(
      expect.objectContaining({ write: true }),
    );
    expect(mockedAudit).toHaveBeenCalledWith(
      prisma,
      expect.anything(),
      expect.objectContaining({
        action: "utility.sync-rosters.run",
        entity: "Position",
        newValue: expect.objectContaining({ upserted: 2, pruned: 1 }),
      }),
    );
  });

  it("transmet les filtres ruleset / roster au service", async () => {
    syncRosters.mockResolvedValueOnce(DRY_RUN_RESULT);

    await postUtility("/admin/utilities/sync-rosters", {
      ruleset: "season_3",
      roster: "high_elf",
    });

    expect(syncRosters).toHaveBeenCalledWith(
      expect.objectContaining({
        write: false,
        ruleset: "season_3",
        roster: "high_elf",
      }),
    );
  });

  it("400 si le body est invalide (write non booléen)", async () => {
    const res = await postUtility("/admin/utilities/sync-rosters", {
      write: "oui",
    });

    expect(res.status).toBe(400);
    expect(syncRosters).not.toHaveBeenCalled();
  });
});
