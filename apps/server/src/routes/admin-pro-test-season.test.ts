/**
 * Tests integration des endpoints admin-pro-test-season.
 *
 * Couvre les 3 endpoints : POST create, GET list, DELETE :id.
 * Verifie le mapping TestFactoryError -> HTTP status + audit log.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({ prisma: {} }));

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

vi.mock("../services/pro-league-test-factory", () => {
  class TestFactoryError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "TestFactoryError";
    }
  }
  return {
    createTestSeason: vi.fn(),
    listTestSeasons: vi.fn(),
    deleteTestSeason: vi.fn(),
    TestFactoryError,
  };
});

import express from "express";
import http from "http";
import router from "./admin-pro-test-season";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import {
  createTestSeason as createMock,
  listTestSeasons as listMock,
  deleteTestSeason as deleteMock,
  TestFactoryError,
} from "../services/pro-league-test-factory";

const audit = vi.mocked(safeRecordAdminActionFromRequest);
const create = vi.mocked(createMock);
const list = vi.mocked(listMock);
const del = vi.mocked(deleteMock);

async function request(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body: Record<string, unknown> | null = null,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/admin/pro-league/test-seasons", router);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const data = body !== null ? JSON.stringify(body) : "";
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: `/admin/pro-league/test-seasons${path}`,
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /admin/pro-league/test-seasons", () => {
  it("cree une test season + log audit", async () => {
    create.mockResolvedValueOnce({
      seasonId: "s-new",
      year: 9000,
      label: "smoke",
      teamCount: 4,
      roundsCreated: 3,
      matchesSimulated: 6,
      matchesFailed: 0,
      engineVer: "1.0.0",
      driverKind: "hybrid",
    });

    const res = await request("POST", "/", { label: "smoke" });

    expect(res.status).toBe(200);
    expect(res.body.seasonId).toBe("s-new");
    expect(res.body.matchesSimulated).toBe(6);
    expect(create).toHaveBeenCalledWith({ label: "smoke" });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][2].action).toBe("pro-test-season.create");
    expect(audit.mock.calls[0][2].entityId).toBe("s-new");
  });

  it("propage TestFactoryError -> status mappe", async () => {
    create.mockRejectedValueOnce(
      new TestFactoryError("LEAGUE_NOT_FOUND", "ligue introuvable"),
    );

    const res = await request("POST", "/", {});

    expect(res.status).toBe(404);
    expect(res.body.error).toContain("ligue introuvable");
  });

  it("INVALID_INPUT -> 400", async () => {
    create.mockRejectedValueOnce(
      new TestFactoryError("INVALID_INPUT", "bad input"),
    );

    const res = await request("POST", "/", {});

    expect(res.status).toBe(400);
  });

  it("YEAR_RANGE_EXHAUSTED -> 422", async () => {
    create.mockRejectedValueOnce(
      new TestFactoryError("YEAR_RANGE_EXHAUSTED", "no slot"),
    );

    const res = await request("POST", "/", {});

    expect(res.status).toBe(422);
  });

  it("erreur inconnue -> 500", async () => {
    create.mockRejectedValueOnce(new Error("boom"));

    const res = await request("POST", "/", {});

    expect(res.status).toBe(500);
  });

  it("rejette teamSlugs < 2 via Zod schema", async () => {
    const res = await request("POST", "/", { teamSlugs: ["only-one"] });

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("GET /admin/pro-league/test-seasons", () => {
  it("liste les test seasons", async () => {
    list.mockResolvedValueOnce([
      {
        id: "s1",
        year: 9000,
        label: "smoke",
        status: "completed",
        engineVer: "1.0.0",
        driverKind: "hybrid",
        roundCount: 15,
        matchCount: 120,
        simulatedCount: 120,
        failedCount: 0,
        createdAt: "2026-05-13T00:00:00.000Z",
      },
    ]);

    const res = await request("GET", "/");

    expect(res.status).toBe(200);
    expect(res.body.seasons).toHaveLength(1);
    expect(res.body.seasons[0].id).toBe("s1");
  });

  it("erreur service -> 500", async () => {
    list.mockRejectedValueOnce(new Error("boom"));

    const res = await request("GET", "/");

    expect(res.status).toBe(500);
  });
});

describe("DELETE /admin/pro-league/test-seasons/:id", () => {
  it("delete + log audit", async () => {
    del.mockResolvedValueOnce({
      seasonId: "s1",
      deletedReplays: 120,
      deletedMatches: 120,
      deletedRounds: 15,
      deletedStandings: 16,
    });

    const res = await request("DELETE", "/s1");

    expect(res.status).toBe(200);
    expect(res.body.deletedReplays).toBe(120);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0][2].action).toBe("pro-test-season.delete");
  });

  it("SEASON_NOT_TEST -> 409 (defense-in-depth)", async () => {
    del.mockRejectedValueOnce(
      new TestFactoryError("SEASON_NOT_TEST", "not a test"),
    );

    const res = await request("DELETE", "/s1");

    expect(res.status).toBe(409);
  });

  it("SEASON_NOT_FOUND -> 404", async () => {
    del.mockRejectedValueOnce(
      new TestFactoryError("SEASON_NOT_FOUND", "ghost"),
    );

    const res = await request("DELETE", "/ghost");

    expect(res.status).toBe(404);
  });
});
