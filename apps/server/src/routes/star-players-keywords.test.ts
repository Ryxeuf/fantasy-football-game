/**
 * `GET /star-players` et `GET /star-players/:slug` exposent les mots-clés
 * (lignée + type) du Star Player, comme `Position.keywords` pour les
 * positionnels : `keywords` (FR, colonne DB) + `keywordsEn` (traduction).
 *
 * Cas couvert en plus : une base pas encore re-seedée après la migration
 * (colonne `keywords` à NULL) doit quand même servir les mots-clés, via le
 * repli sur la table du game-engine.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    starPlayer: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    roster: { findFirst: vi.fn() },
  },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import express from "express";
import http from "http";
import starPlayersRouter from "./star-players";
import { prisma } from "../prisma";

const mockedPrisma = prisma as unknown as {
  starPlayer: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    slug: "griff_oberwald",
    ruleset: "season_3",
    displayName: "Griff Oberwald",
    cost: 280000,
    ma: 7,
    st: 4,
    ag: 2,
    pa: 4,
    av: 9,
    keywords: "Humain, Blitzer",
    specialRule: null,
    imageUrl: null,
    isMegaStar: false,
    skills: [{ skill: { slug: "block" } }],
    hirableBy: [{ rule: "old_world_classic", roster: null }],
    ...overrides,
  };
}

interface Payload {
  success?: boolean;
  data?: any;
}

async function get(path: string): Promise<{ status: number; body: Payload }> {
  const app = express();
  app.use("/star-players", starPlayersRouter);
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
        .request(
          {
            hostname: "127.0.0.1",
            port: addr.port,
            path: `/star-players${path}`,
            method: "GET",
          },
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
        )
        .on("error", (e) => {
          server.close();
          reject(e);
        })
        .end();
    });
  });
}

describe("mots-clés des Star Players dans l'API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("expose keywords + keywordsEn sur la liste", async () => {
    mockedPrisma.starPlayer.findMany.mockResolvedValue([makeRow()]);

    const { status, body } = await get("/");

    expect(status).toBe(200);
    expect(body.data?.[0].keywords).toBe("Humain, Blitzer");
    expect(body.data?.[0].keywordsEn).toBe("Human, Blitzer");
  });

  it("expose keywords + keywordsEn sur le détail", async () => {
    mockedPrisma.starPlayer.findFirst.mockResolvedValue(makeRow());

    const { status, body } = await get("/griff_oberwald");

    expect(status).toBe(200);
    expect(body.data?.keywords).toBe("Humain, Blitzer");
    expect(body.data?.keywordsEn).toBe("Human, Blitzer");
  });

  it("retombe sur la table du game-engine si la colonne DB est nulle", async () => {
    mockedPrisma.starPlayer.findFirst.mockResolvedValue(
      makeRow({ slug: "morg_n_thorg", keywords: null }),
    );

    const { body } = await get("/morg_n_thorg");

    expect(body.data?.keywords).toBe("Ogre, Gros Bras");
    expect(body.data?.keywordsEn).toBe("Ogre, Big Guy");
  });

  it("renvoie null quand le slug est inconnu du game-engine et de la DB", async () => {
    mockedPrisma.starPlayer.findFirst.mockResolvedValue(
      makeRow({ slug: "mercenaire_maison", keywords: null }),
    );

    const { body } = await get("/mercenaire_maison");

    expect(body.data?.keywords).toBeNull();
    expect(body.data?.keywordsEn).toBeNull();
  });
});
