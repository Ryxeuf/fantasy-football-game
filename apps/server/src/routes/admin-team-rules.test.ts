/**
 * Lot 6.5 — CRUD admin des catalogues de règles.
 *
 * Deux invariants à protéger : le slug est un contrat de code (référencé par
 * les fiches de roster, `Team.regionalLeague` et le moteur) donc il ne se
 * renomme pas, et une entrée encore référencée par un roster ne se supprime
 * pas — sinon la fiche afficherait un slug brut à la place de son libellé.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response, Router } from "express";

const db = vi.hoisted(() => ({
  teamSpecialRule: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  regionalLeague: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  roster: { findMany: vi.fn() },
}));
vi.mock("../prisma", () => ({ prisma: db }));
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));
vi.mock("../services/audit-log", () => ({
  safeRecordAdminActionFromRequest: vi.fn(),
}));
vi.mock("../services/team-rules-catalogue", () => ({
  invalidateTeamRulesCatalogueCache: vi.fn(),
}));
vi.mock("../seeders/sync-team-rules", () => ({
  syncTeamRules: vi.fn().mockResolvedValue({ write: true }),
}));
vi.mock("../middleware/authUser", () => ({
  authUser: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../middleware/adminOnly", () => ({
  adminOnly: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import {
  adminRegionalLeaguesRouter,
  adminSpecialRulesRouter,
} from "./admin-team-rules";

function handlerFor(router: Router, method: string, path: string) {
  const layer = (
    router as unknown as {
      stack: Array<{
        route?: {
          path: string;
          methods: Record<string, boolean>;
          stack: Array<{ handle: unknown }>;
        };
      }>;
    }
  ).stack.find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`Route ${method} ${path} introuvable`);
  return layer.route.stack[layer.route.stack.length - 1].handle as (
    req: unknown,
    res: Response,
  ) => Promise<void>;
}

function createRes() {
  const res: Partial<Response> & { statusCode?: number; payload?: any } = {};
  res.status = ((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as Response["status"];
  res.json = ((body: unknown) => {
    res.payload = body;
    res.statusCode = res.statusCode ?? 200;
    return res as Response;
  }) as Response["json"];
  return res as Partial<Response> & { statusCode?: number; payload?: any };
}

const VALID_BODY = {
  slug: "ligue_maison",
  ruleset: "season_3",
  nameFr: "Ligue Maison",
  nameEn: "House League",
  description: "Ligue ajoutée par le commissaire.",
  descriptionEn: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  db.roster.findMany.mockResolvedValue([]);
});

describe("GET / (liste)", () => {
  it("signale les slugs inconnus du moteur (pur libellé)", async () => {
    db.regionalLeague.findMany.mockResolvedValue([
      { id: "l1", slug: "chaos_clash", ruleset: "season_3" },
      { id: "l2", slug: "ligue_maison", ruleset: "season_3" },
    ]);
    const res = createRes();
    await handlerFor(adminRegionalLeaguesRouter, "get", "/")(
      { query: {} },
      res as Response,
    );
    expect(res.payload.rules).toEqual([
      expect.objectContaining({ slug: "chaos_clash", knownToEngine: true }),
      expect.objectContaining({ slug: "ligue_maison", knownToEngine: false }),
    ]);
  });
});

describe("POST / (création)", () => {
  it("crée une entrée et invalide le cache du catalogue", async () => {
    db.regionalLeague.findUnique.mockResolvedValue(null);
    db.regionalLeague.create.mockResolvedValue({ id: "l9", ...VALID_BODY });
    const res = createRes();
    await handlerFor(adminRegionalLeaguesRouter, "post", "/")(
      { body: VALID_BODY },
      res as Response,
    );
    expect(res.statusCode).toBe(201);
    expect(res.payload.knownToEngine).toBe(false);
    const { invalidateTeamRulesCatalogueCache } = await import(
      "../services/team-rules-catalogue"
    );
    expect(invalidateTeamRulesCatalogueCache).toHaveBeenCalled();
  });

  it("refuse un slug déjà pris pour la même édition", async () => {
    db.regionalLeague.findUnique.mockResolvedValue({ id: "l1" });
    const res = createRes();
    await handlerFor(adminRegionalLeaguesRouter, "post", "/")(
      { body: VALID_BODY },
      res as Response,
    );
    expect(res.statusCode).toBe(409);
    expect(db.regionalLeague.create).not.toHaveBeenCalled();
  });
});

describe("PUT /:id (mise à jour)", () => {
  it("n'accepte NI le slug NI l'édition : ils sont référencés ailleurs", async () => {
    db.teamSpecialRule.findUnique.mockResolvedValue({
      id: "r1",
      slug: "capitaine",
      ruleset: "season_3",
    });
    db.teamSpecialRule.update.mockResolvedValue({
      id: "r1",
      slug: "capitaine",
      ruleset: "season_3",
      nameFr: "Capitaine (corrigé)",
    });
    const res = createRes();
    await handlerFor(adminSpecialRulesRouter, "put", "/:id")(
      {
        params: { id: "r1" },
        body: {
          nameFr: "Capitaine (corrigé)",
          nameEn: "Captain",
          description: "…",
          descriptionEn: null,
        },
      },
      res as Response,
    );
    expect(res.statusCode).toBe(200);
    const data = db.teamSpecialRule.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("slug");
    expect(data).not.toHaveProperty("ruleset");
  });

  it("404 sur une entrée absente", async () => {
    db.teamSpecialRule.findUnique.mockResolvedValue(null);
    const res = createRes();
    await handlerFor(adminSpecialRulesRouter, "put", "/:id")(
      {
        params: { id: "nope" },
        body: {
          nameFr: "x",
          nameEn: "x",
          description: "x",
          descriptionEn: null,
        },
      },
      res as Response,
    );
    expect(res.statusCode).toBe(404);
    expect(db.teamSpecialRule.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /:id", () => {
  it("refuse tant qu'un roster référence le slug", async () => {
    db.teamSpecialRule.findUnique.mockResolvedValue({
      id: "r1",
      slug: "capitaine",
      ruleset: "season_3",
    });
    db.roster.findMany.mockResolvedValue([
      { specialRules: "capitaine,bagarreurs_brutaux" },
      { specialRules: null },
    ]);
    const res = createRes();
    await handlerFor(adminSpecialRulesRouter, "delete", "/:id")(
      { params: { id: "r1" } },
      res as Response,
    );
    expect(res.statusCode).toBe(409);
    expect(res.payload.usage).toEqual({ rosters: 1 });
    expect(db.teamSpecialRule.delete).not.toHaveBeenCalled();
  });

  it("supprime une entrée orpheline", async () => {
    db.teamSpecialRule.findUnique.mockResolvedValue({
      id: "r1",
      slug: "regle_orpheline",
      ruleset: "season_3",
    });
    db.roster.findMany.mockResolvedValue([{ specialRules: "capitaine" }]);
    const res = createRes();
    await handlerFor(adminSpecialRulesRouter, "delete", "/:id")(
      { params: { id: "r1" } },
      res as Response,
    );
    expect(res.payload).toEqual({ id: "r1", deleted: true });
    expect(db.teamSpecialRule.delete).toHaveBeenCalled();
  });

  it("reconnaît un slug référencé dans un JSON de Ligues", async () => {
    db.regionalLeague.findUnique.mockResolvedValue({
      id: "l1",
      slug: "chaos_clash",
      ruleset: "season_3",
    });
    db.roster.findMany.mockResolvedValue([
      { regionalRules: '["chaos_clash","badlands_brawl"]' },
    ]);
    const res = createRes();
    await handlerFor(adminRegionalLeaguesRouter, "delete", "/:id")(
      { params: { id: "l1" } },
      res as Response,
    );
    expect(res.statusCode).toBe(409);
    expect(db.regionalLeague.delete).not.toHaveBeenCalled();
  });
});
