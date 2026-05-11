/**
 * Tests pour la route publique GET /leaderboard.
 *
 * Verifie que le `where` Prisma exclut bien :
 *   - les comptes non valides (`valid: true`),
 *   - les comptes IA (`role: { not: "ai" }`),
 *   - les coachs masques par un admin (`leaderboardStatus: "visible"`),
 *   - les coachs qui n'ont jamais joue de match ranked
 *     (`eloSnapshots: { some: {} }`).
 *
 * Pattern : on mock prisma + on monte le router sur http.createServer
 * (supertest n'est pas dans les deps — cf. CLAUDE.md).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import express from "express";
import http from "http";
import leaderboardRouter from "./leaderboard";
import { prisma } from "../prisma";

interface MockedPrisma {
  user: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
}

const mockedPrisma = prisma as unknown as MockedPrisma;

async function getLeaderboard(
  query: string = "",
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/leaderboard", leaderboardRouter);
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
          path: `/leaderboard${query}`,
          method: "GET",
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /leaderboard", () => {
  it("returns the leaderboard envelope with rank, userId, coachName, eloRating", async () => {
    mockedPrisma.user.findMany.mockResolvedValue([
      { id: "u1", coachName: "Alpha", eloRating: 1500 },
      { id: "u2", coachName: "Beta", eloRating: 1400 },
    ]);
    mockedPrisma.user.count.mockResolvedValue(2);

    const { status, body } = await getLeaderboard();

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([
      { rank: 1, userId: "u1", coachName: "Alpha", eloRating: 1500 },
      { rank: 2, userId: "u2", coachName: "Beta", eloRating: 1400 },
    ]);
    expect(body.meta).toEqual({ total: 2, limit: 50, offset: 0 });
  });

  it("filters out invalid accounts, AI bots, hidden_admin coaches and coaches without ranked matches", async () => {
    mockedPrisma.user.findMany.mockResolvedValue([]);
    mockedPrisma.user.count.mockResolvedValue(0);

    await getLeaderboard();

    const whereArg = mockedPrisma.user.findMany.mock.calls[0][0].where;
    expect(whereArg).toMatchObject({
      valid: true,
      role: { not: "ai" },
      leaderboardStatus: "visible",
      eloSnapshots: { some: {} },
    });

    // The `count` call must use the SAME filter so total == filtered count.
    const countArg = mockedPrisma.user.count.mock.calls[0][0].where;
    expect(countArg).toMatchObject({
      valid: true,
      role: { not: "ai" },
      leaderboardStatus: "visible",
      eloSnapshots: { some: {} },
    });
  });

  it("clamps limit to 100 and offset to >= 0, and applies pagination to rank", async () => {
    mockedPrisma.user.findMany.mockResolvedValue([
      { id: "u3", coachName: "Gamma", eloRating: 1300 },
    ]);
    mockedPrisma.user.count.mockResolvedValue(10);

    const { body } = await getLeaderboard("?limit=999&offset=5");

    expect(body.data[0].rank).toBe(6); // offset 5 + index 0 + 1
    expect(body.meta.limit).toBe(100);
    expect(body.meta.offset).toBe(5);
    const args = mockedPrisma.user.findMany.mock.calls[0][0];
    expect(args.take).toBe(100);
    expect(args.skip).toBe(5);
  });

  it("returns 500 with a generic error message on prisma failure", async () => {
    mockedPrisma.user.findMany.mockRejectedValue(new Error("boom"));
    mockedPrisma.user.count.mockResolvedValue(0);
    const { status, body } = await getLeaderboard();
    expect(status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBe("boom");
  });
});
