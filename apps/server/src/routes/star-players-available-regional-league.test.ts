/**
 * `GET /star-players/available/:roster` doit se limiter a la Ligue regionale
 * choisie (`?regionalLeague=`).
 *
 * Bug corrige : la route servait l'union de TOUTES les Ligues du roster. Un
 * coach Halfling qui choisissait la Ligue Sylvestre se voyait donc proposer
 * Cindy Piewhistle (Coupe De a Coudre / Classique du Vieux Monde), pouvait la
 * cocher… et la creation d'equipe echouait ensuite cote serveur.
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

vi.mock("../utils/roster-helpers", () => ({
  getRosterFromDb: vi.fn(async () => ({
    // Ligues DECLAREES par le roster Halfling (Saison 3).
    regionalRules: [
      "halfling_thimble_cup",
      "old_world_classic",
      "woodland_league",
    ],
  })),
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import express from "express";
import http from "http";
import starPlayersRouter from "./star-players";
import { prisma } from "../prisma";

interface Row {
  slug: string;
  ruleset: string;
  displayName: string;
  cost: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  specialRule: string | null;
  imageUrl: string | null;
  isMegaStar: boolean;
  skills: Array<{ skill: { slug: string } }>;
  hirableBy: Array<{ rule: string; roster: { slug: string } | null }>;
}

function makeRow(slug: string, rules: string[]): Row {
  return {
    slug,
    ruleset: "season_3",
    displayName: slug,
    cost: 130000,
    ma: 5,
    st: 2,
    ag: 3,
    pa: 4,
    av: 7,
    specialRule: null,
    imageUrl: null,
    isMegaStar: false,
    skills: [],
    hirableBy: rules.map((rule) => ({ rule, roster: null })),
  };
}

/** Cindy : hors Ligue Sylvestre. Willow : Ligue Sylvestre. */
const ROWS: Row[] = [
  makeRow("cindy_piewhistle", ["halfling_thimble_cup", "old_world_classic"]),
  makeRow("willow_rosebark", ["woodland_league"]),
];

const mocked = prisma as unknown as {
  starPlayer: { findMany: ReturnType<typeof vi.fn> };
  roster: { findFirst: ReturnType<typeof vi.fn> };
};

/**
 * Reproduit le `OR` de la route : un star sort si l'une de ses regles
 * `hirableBy` figure dans les regles regionales passees a la requete.
 */
function seed(): void {
  mocked.roster.findFirst.mockResolvedValue({ slug: "halfling" });
  mocked.starPlayer.findMany.mockImplementation(
    ({ where }: { where: { OR: Array<Record<string, any>> } }) => {
      const rules = new Set<string>();
      let anyRoster = false;
      for (const clause of where.OR) {
        const rule = clause.hirableBy?.some?.rule;
        if (typeof rule === "string") rules.add(rule);
        if (clause.hirableBy?.some?.roster) anyRoster = true;
      }
      return Promise.resolve(
        ROWS.filter(
          (r) =>
            r.hirableBy.some((h) => rules.has(h.rule)) ||
            (anyRoster && r.hirableBy.some((h) => h.roster !== null)),
        ),
      );
    },
  );
}

interface AvailableResponse {
  success?: boolean;
  regionalLeague?: string | null;
  regionalRules?: string[];
  starPlayers?: Array<{ slug: string }>;
}

async function getAvailable(
  path: string,
): Promise<{ status: number; body: AvailableResponse }> {
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
              resolve({
                status: res.statusCode ?? 0,
                body: buf ? JSON.parse(buf) : {},
              });
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

describe("GET /star-players/available/:roster — filtre par Ligue régionale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seed();
  });

  it("exclut les Star Players hors de la Ligue choisie", async () => {
    const { status, body } = await getAvailable(
      "/available/halfling?ruleset=season_3&regionalLeague=woodland_league",
    );

    expect(status).toBe(200);
    expect(body.regionalLeague).toBe("woodland_league");
    expect(body.regionalRules).toEqual(["woodland_league"]);
    expect(body.starPlayers?.map((sp) => sp.slug)).toEqual(["willow_rosebark"]);
  });

  it("garde l'union des Ligues du roster quand aucune n'est demandée", async () => {
    const { status, body } = await getAvailable(
      "/available/halfling?ruleset=season_3",
    );

    expect(status).toBe(200);
    expect(body.regionalLeague).toBeNull();
    expect(body.starPlayers?.map((sp) => sp.slug).sort()).toEqual([
      "cindy_piewhistle",
      "willow_rosebark",
    ]);
  });

  it("ignore une Ligue qui n'est pas ouverte à ce roster", async () => {
    const { body } = await getAvailable(
      "/available/halfling?ruleset=season_3&regionalLeague=chaos_clash",
    );

    // Choix invalide ⇒ repli sur l'union déclarée, jamais sur une liste vide.
    expect(body.regionalRules).toEqual([
      "halfling_thimble_cup",
      "old_world_classic",
      "woodland_league",
    ]);
  });
});
