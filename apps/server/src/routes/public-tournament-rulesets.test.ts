/**
 * Routes publiques des règlements de tournoi : liste (non archivés,
 * fusion DB + registre statique), détail (archivés résolus avec flag,
 * tranches de taxe ouvertes sérialisées en null), 404 slug inconnu,
 * invalidation du cache mémoire après écriture admin.
 *
 * Handler isolé via `http.createServer(express())` + `http.request` natif
 * (supertest absent des deps — cf. CLAUDE.md).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";

vi.mock("../prisma", () => ({
  prisma: {
    tournamentRuleset: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

import { prisma } from "../prisma";
import { invalidateAllMemo, memoizeAsync } from "../utils/memoize-async";
import tournamentRulesetsRouter, {
  invalidateTournamentRulesetCaches,
} from "./public-tournament-rulesets";

const findUnique = prisma.tournamentRuleset
  .findUnique as unknown as ReturnType<typeof vi.fn>;
const findMany = prisma.tournamentRuleset
  .findMany as unknown as ReturnType<typeof vi.fn>;

interface JsonResult {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, unknown> & { tournamentRulesets?: any[]; tournamentRuleset?: any };
}

async function get(path: string): Promise<JsonResult> {
  const app = express();
  app.use("/api", tournamentRulesetsRouter);
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

describe("GET /api/tournament-rulesets", () => {
  it("liste les résumés non archivés (registre statique inclus, DB vide)", async () => {
    findMany.mockResolvedValue([]);
    const { status, body } = await get("/api/tournament-rulesets");
    expect(status).toBe(200);
    const slugs = body.tournamentRulesets?.map((r) => r.slug);
    expect(slugs).toContain("naf_world_cup_2027");
    const naf = body.tournamentRulesets?.find(
      (r) => r.slug === "naf_world_cup_2027",
    );
    expect(naf).toMatchObject({
      shortLabel: "NAF World Cup 2027",
      edition: "season_3",
      format: "bb11",
      resurrection: true,
    });
    // Résumé léger : pas de règles détaillées dans la liste.
    expect(naf.rosterRules).toBeUndefined();
  });
});

describe("GET /api/tournament-rulesets/:slug", () => {
  it("renvoie la définition complète (fallback statique) avec archived=false", async () => {
    findUnique.mockResolvedValue(null);
    const { status, body } = await get(
      "/api/tournament-rulesets/naf_world_cup_2027",
    );
    expect(status).toBe(200);
    const def = body.tournamentRuleset;
    expect(def.archived).toBe(false);
    expect(def.rosterRules.orc.goldBudget).toBe(1080);
    expect(def.bannedStarPlayers).toContain("morg_n_thorg");
    // Tranche ouverte : Infinity du moteur sérialisé en null (convention DB).
    const lastBracket = def.starPlayerSppTax[def.starPlayerSppTax.length - 1];
    expect(lastBracket.maxTotalCostK).toBeNull();
    expect(lastBracket.spp).toBe(32);
  });

  it("404 pour un slug inconnu des deux sources", async () => {
    findUnique.mockResolvedValue(null);
    const { status } = await get("/api/tournament-rulesets/inconnu");
    expect(status).toBe(404);
  });
});

describe("invalidateTournamentRulesetCaches", () => {
  it("force le recalcul des valeurs mémoïsées liste + détail", async () => {
    let calls = 0;
    const compute = () => Promise.resolve(++calls);
    expect(
      await memoizeAsync("public-tournament-rulesets-list", "all", 60_000, compute),
    ).toBe(1);
    expect(
      await memoizeAsync("public-tournament-rulesets-list", "all", 60_000, compute),
    ).toBe(1);
    expect(
      await memoizeAsync(
        "public-tournament-rulesets-detail",
        "naf_world_cup_2027",
        60_000,
        compute,
      ),
    ).toBe(2);

    invalidateTournamentRulesetCaches();
    expect(
      await memoizeAsync("public-tournament-rulesets-list", "all", 60_000, compute),
    ).toBe(3);
    expect(
      await memoizeAsync(
        "public-tournament-rulesets-detail",
        "naf_world_cup_2027",
        60_000,
        compute,
      ),
    ).toBe(4);
  });
});
