/**
 * Le CRUD admin refuse tout ce que le parser refuse, AVANT d'écrire, et
 * protège les deux invariants qui pourraient casser l'existant : le slug ne
 * se renomme pas, un règlement utilisé ne se supprime pas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response } from "express";

// `vi.mock` est hissé en tête de fichier : le mock doit être construit dans
// un `vi.hoisted` pour être défini au moment où la factory s'exécute.
const db = vi.hoisted(() => ({
  tournamentRuleset: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  team: { count: vi.fn() },
  league: { count: vi.fn() },
  cup: { count: vi.fn() },
}));
vi.mock("../prisma", () => ({ prisma: db }));
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));
vi.mock("../services/audit-log", () => ({
  safeRecordAdminActionFromRequest: vi.fn(),
}));
vi.mock("../middleware/authUser", () => ({
  authUser: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../middleware/adminOnly", () => ({
  adminOnly: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { NAF_WORLD_CUP_2027 } from "@bb/game-engine";
import { serializeDefinition } from "../schemas/tournament-ruleset.schemas";
import { invalidateTournamentRulesetCache } from "../services/tournament-ruleset-repository";
import router from "./admin-tournament-rulesets";

/** Extrait un handler du routeur par méthode + chemin. */
function handlerFor(method: string, path: string) {
  const layer = (router as unknown as {
    stack: Array<{
      route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: unknown }> };
    }>;
  }).stack.find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`Route ${method} ${path} introuvable`);
  // Dernier maillon = le handler métier (les précédents sont les middlewares).
  return layer.route.stack[layer.route.stack.length - 1].handle as (
    req: unknown,
    res: Response,
  ) => Promise<void>;
}

function createRes() {
  const res: Partial<Response> & { statusCode?: number; payload?: unknown } = {};
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

const VALID = serializeDefinition(NAF_WORLD_CUP_2027);

beforeEach(() => {
  vi.resetAllMocks();
  invalidateTournamentRulesetCache();
  db.tournamentRuleset.findMany.mockResolvedValue([]);
});

describe("POST / (création)", () => {
  it("refuse une définition invalide avec le chemin du champ", async () => {
    const res = createRes();
    await handlerFor("post", "/")(
      { body: { definition: { ...VALID, edition: "season_9" } } },
      res as Response,
    );
    expect(res.statusCode).toBe(400);
    expect(res.payload.issues.some((i: { path: string }) => i.path === "edition")).toBe(true);
    expect(db.tournamentRuleset.create).not.toHaveBeenCalled();
  });

  it("refuse un slug déjà pris", async () => {
    db.tournamentRuleset.findUnique.mockResolvedValue({ id: "r1" });
    const res = createRes();
    await handlerFor("post", "/")({ body: { definition: VALID } }, res as Response);
    expect(res.statusCode).toBe(409);
    expect(db.tournamentRuleset.create).not.toHaveBeenCalled();
  });

  it("crée et stocke la définition sérialisée", async () => {
    db.tournamentRuleset.findUnique.mockResolvedValue(null);
    db.tournamentRuleset.create.mockResolvedValue({
      slug: VALID.slug,
      enabled: true,
    });
    const res = createRes();
    await handlerFor("post", "/")({ body: { definition: VALID } }, res as Response);
    expect(res.statusCode).toBe(201);
    const data = db.tournamentRuleset.create.mock.calls[0][0].data;
    expect(data.slug).toBe("naf_world_cup_2027");
    expect(JSON.stringify(data.definition)).toContain('"maxTotalCostK":null');
  });
});

describe("PUT /:slug (mise à jour)", () => {
  it("refuse un renommage de slug", async () => {
    const res = createRes();
    await handlerFor("put", "/:slug")(
      {
        params: { slug: "naf_world_cup_2027" },
        body: { definition: { ...VALID, slug: "autre_slug" } },
      },
      res as Response,
    );
    expect(res.statusCode).toBe(400);
    expect(res.payload.error).toMatch(/slug d'un règlement ne peut pas changer/);
    expect(db.tournamentRuleset.update).not.toHaveBeenCalled();
  });

  it("matérialise la ligne à la première édition d'un pack du moteur", async () => {
    db.tournamentRuleset.findUnique.mockResolvedValue(null);
    const res = createRes();
    await handlerFor("put", "/:slug")(
      { params: { slug: "naf_world_cup_2027" }, body: { definition: VALID } },
      res as Response,
    );
    expect(db.tournamentRuleset.create).toHaveBeenCalledTimes(1);
    expect(res.payload.slug).toBe("naf_world_cup_2027");
  });

  it("met à jour une ligne existante", async () => {
    db.tournamentRuleset.findUnique.mockResolvedValue({ enabled: true });
    const res = createRes();
    await handlerFor("put", "/:slug")(
      {
        params: { slug: "naf_world_cup_2027" },
        body: { definition: VALID, enabled: false },
      },
      res as Response,
    );
    expect(db.tournamentRuleset.update).toHaveBeenCalledTimes(1);
    expect(db.tournamentRuleset.update.mock.calls[0][0].data.enabled).toBe(false);
  });
});

describe("POST /validate", () => {
  it("valide sans écrire", async () => {
    const res = createRes();
    await handlerFor("post", "/validate")(
      { body: { definition: VALID } },
      res as Response,
    );
    expect(res.payload).toEqual({ valid: true, slug: "naf_world_cup_2027" });
    expect(db.tournamentRuleset.create).not.toHaveBeenCalled();
    expect(db.tournamentRuleset.update).not.toHaveBeenCalled();
  });

  it("renvoie les erreurs sans écrire", async () => {
    const res = createRes();
    await handlerFor("post", "/validate")(
      { body: { definition: { ...VALID, skillCosts: { ...VALID.skillCosts, firstPrimary: -1 } } } },
      res as Response,
    );
    expect(res.statusCode).toBe(400);
    expect(
      res.payload.issues.some((i: { path: string }) => i.path === "skillCosts.firstPrimary"),
    ).toBe(true);
  });
});

describe("DELETE /:slug", () => {
  it("refuse la suppression d'un règlement utilisé", async () => {
    db.team.count.mockResolvedValue(3);
    db.league.count.mockResolvedValue(1);
    db.cup.count.mockResolvedValue(0);
    const res = createRes();
    await handlerFor("delete", "/:slug")(
      { params: { slug: "naf_world_cup_2027" } },
      res as Response,
    );
    expect(res.statusCode).toBe(409);
    expect(res.payload.usage).toEqual({ teams: 3, leagues: 1, cups: 0 });
    expect(db.tournamentRuleset.delete).not.toHaveBeenCalled();
  });

  it("supprime un règlement inutilisé", async () => {
    db.team.count.mockResolvedValue(0);
    db.league.count.mockResolvedValue(0);
    db.cup.count.mockResolvedValue(0);
    db.tournamentRuleset.findUnique.mockResolvedValue({ id: "r1" });
    const res = createRes();
    await handlerFor("delete", "/:slug")(
      { params: { slug: "coupe_maison" } },
      res as Response,
    );
    expect(db.tournamentRuleset.delete).toHaveBeenCalledWith({
      where: { slug: "coupe_maison" },
    });
    expect(res.payload.deleted).toBe(true);
  });
});
