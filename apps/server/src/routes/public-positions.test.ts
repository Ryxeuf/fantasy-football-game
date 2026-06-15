/**
 * Tests du routeur public `/api/positions` (liste + détail).
 *
 * Handler isolé via `http.createServer(express())` + `http.request` natif
 * (supertest n'est pas une dépendance) ; `prisma` mocké. Le cache mémoïsé
 * est vidé entre chaque test (`invalidateAllMemo`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    position: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import express from "express";
import http from "http";
import positionsRouter from "./public-positions";
import { prisma } from "../prisma";
import { invalidateAllMemo } from "../utils/memoize-async";

interface MockedPrisma {
  position: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
}

const mockedPrisma = prisma as unknown as MockedPrisma;

interface PositionRowLike {
  slug: string;
  displayName: string;
  cost: number;
  min: number;
  max: number;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  primarySkills: string | null;
  secondarySkills: string | null;
  roster: { slug: string; name: string; nameEn: string };
  skills: Array<{ skill: { slug: string } }>;
}

function makePositionRow(over: Partial<PositionRowLike> = {}): PositionRowLike {
  return {
    slug: "skaven_gutter_runner",
    displayName: "Gutter Runner",
    cost: 85,
    min: 0,
    max: 4,
    ma: 9,
    st: 2,
    ag: 2,
    pa: 4,
    av: 8,
    primarySkills: "A",
    secondarySkills: "G",
    roster: { slug: "skaven", name: "Skavens", nameEn: "Skaven" },
    skills: [{ skill: { slug: "dodge" } }],
    ...over,
  };
}

interface JsonResult {
  status: number;
  // Réponse JSON non typée (forme dépend de la route testée).
  body: Record<string, unknown> & { positions?: any[]; position?: any };
}

async function get(path: string): Promise<JsonResult> {
  const app = express();
  app.use("/api", positionsRouter);
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
        { hostname: "127.0.0.1", port: addr.port, path, method: "GET" },
        (res) => {
          let buf = "";
          res.on("data", (chunk) => (buf += chunk));
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
  vi.resetAllMocks();
  invalidateAllMemo();
});

describe("GET /api/positions", () => {
  it("liste les positions transformées (skills CSV, roster FR)", async () => {
    mockedPrisma.position.findMany.mockResolvedValue([makePositionRow()]);
    const { status, body } = await get("/api/positions?ruleset=season_3");
    expect(status).toBe(200);
    expect(body.ruleset).toBe("season_3");
    expect(body.positions).toHaveLength(1);
    expect(body.positions?.[0]).toMatchObject({
      slug: "skaven_gutter_runner",
      skills: "dodge",
      rosterSlug: "skaven",
      rosterName: "Skavens",
      primarySkills: "A",
    });
  });

  it("utilise le nom de roster anglais avec ?lang=en", async () => {
    mockedPrisma.position.findMany.mockResolvedValue([makePositionRow()]);
    const { body } = await get("/api/positions?ruleset=season_3&lang=en");
    expect(body.positions?.[0].rosterName).toBe("Skaven");
  });

  it("filtre par rosterSlug", async () => {
    mockedPrisma.position.findMany.mockResolvedValue([]);
    await get("/api/positions?ruleset=season_3&rosterSlug=skaven");
    const arg = mockedPrisma.position.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({
      roster: { slug: "skaven", ruleset: "season_3" },
    });
  });

  it("expose displayNameEn (nom anglais officiel) pour un slug connu", async () => {
    mockedPrisma.position.findMany.mockResolvedValue([
      makePositionRow({
        slug: "skaven_coureur_d_egouts",
        displayName: "Coureur d'Égouts",
      }),
    ]);
    const { body } = await get("/api/positions?ruleset=season_3");
    expect(body.positions?.[0].displayName).toBe("Coureur d'Égouts");
    expect(body.positions?.[0].displayNameEn).toBe("Gutter Runner");
  });

  it("displayNameEn = null pour un slug non mappé", async () => {
    mockedPrisma.position.findMany.mockResolvedValue([
      makePositionRow({ slug: "skaven_slug_inexistant" }),
    ]);
    const { body } = await get("/api/positions?ruleset=season_3");
    expect(body.positions?.[0].displayNameEn).toBeNull();
  });
});

describe("GET /api/positions/:slug", () => {
  it("retourne la position par slug", async () => {
    mockedPrisma.position.findFirst.mockResolvedValue(makePositionRow());
    const { status, body } = await get(
      "/api/positions/skaven_gutter_runner?ruleset=season_3",
    );
    expect(status).toBe(200);
    expect(body.position?.slug).toBe("skaven_gutter_runner");
    expect(body.position?.skills).toBe("dodge");
  });

  it("404 si introuvable (après repli sur l'édition par défaut)", async () => {
    mockedPrisma.position.findFirst.mockResolvedValue(null);
    const { status, body } = await get(
      "/api/positions/inconnu?ruleset=season_2",
    );
    expect(status).toBe(404);
    expect(body.error).toBeTruthy();
    // findFirst appelé 2x : season_2 puis repli season_3.
    expect(mockedPrisma.position.findFirst).toHaveBeenCalledTimes(2);
  });
});
