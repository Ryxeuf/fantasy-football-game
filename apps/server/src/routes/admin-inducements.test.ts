/**
 * Lot 6.1 — CRUD admin du catalogue de Coups de Pouce.
 *
 * Ce que l'API doit protéger : un coût négatif offrirait de l'argent au
 * coach, un plafond nul ferait disparaître la ligne du panier sans le dire,
 * et le slug — contrat de code — ne se renomme pas (les feuilles de match
 * validées le référencent).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response } from "express";

const db = vi.hoisted(() => ({
  inducement: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("../prisma", () => ({ prisma: db }));
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));
vi.mock("../services/audit-log", () => ({
  safeRecordAdminActionFromRequest: vi.fn(),
}));
vi.mock("../services/inducement-repository", () => ({
  invalidateInducementCache: vi.fn(),
}));
vi.mock("../seeders/sync-inducements", () => ({
  syncInducements: vi.fn().mockResolvedValue({ write: true, created: [] }),
}));
vi.mock("../middleware/authUser", () => ({
  authUser: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../middleware/adminOnly", () => ({
  adminOnly: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { invalidateInducementCache } from "../services/inducement-repository";
import router from "./admin-inducements";

/**
 * Le middleware `validate(schema)` fait partie du contrat : on rejoue la
 * chaîne complète (validation + handler), sinon le test passerait sur des
 * corps que la route refuse en vrai.
 */
async function callRoute(method: string, path: string, req: any) {
  const layer = (
    router as unknown as {
      stack: Array<{
        route?: {
          path: string;
          methods: Record<string, boolean>;
          stack: Array<{ handle: any }>;
        };
      }>;
    }
  ).stack.find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`Route ${method} ${path} introuvable`);
  const res = createRes();
  for (const { handle } of layer.route.stack) {
    let advanced = false;
    await handle(req, res as Response, () => {
      advanced = true;
    });
    if (!advanced) break;
  }
  return res;
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

const BODY = {
  nameFr: "Pots-de-vin",
  nameEn: "Bribes",
  descriptionFr: "…",
  baseCost: 70_000,
  maxQuantity: 3,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /", () => {
  it("signale les slugs dont le comportement n'est pas câblé", async () => {
    db.inducement.findMany.mockResolvedValue([
      { id: "i1", slug: "bribe" },
      { id: "i2", slug: "coup_de_pouce_maison" },
    ]);
    const res = await callRoute("get", "/", { query: {} });
    expect(res.payload.inducements).toEqual([
      expect.objectContaining({ slug: "bribe", wired: true }),
      expect.objectContaining({ slug: "coup_de_pouce_maison", wired: false }),
    ]);
  });
});

describe("POST /", () => {
  it("crée et invalide le cache du catalogue", async () => {
    db.inducement.findUnique.mockResolvedValue(null);
    db.inducement.create.mockResolvedValue({ id: "i9", slug: "bribe" });
    const res = await callRoute("post", "/", {
      body: { ...BODY, slug: "bribe", ruleset: "season_3" },
    });
    expect(res.statusCode).toBe(201);
    expect(invalidateInducementCache).toHaveBeenCalled();
  });

  it("refuse un coût négatif", async () => {
    const res = await callRoute("post", "/", {
      body: { ...BODY, slug: "bribe", ruleset: "season_3", baseCost: -1 },
    });
    expect(res.statusCode).toBe(400);
    expect(db.inducement.create).not.toHaveBeenCalled();
  });

  it("refuse un plafond nul (le coup de pouce disparaîtrait du panier)", async () => {
    const res = await callRoute("post", "/", {
      body: { ...BODY, slug: "bribe", ruleset: "season_3", maxQuantity: 0 },
    });
    expect(res.statusCode).toBe(400);
    expect(db.inducement.create).not.toHaveBeenCalled();
  });

  it("refuse un slug non conforme au contrat de code", async () => {
    const res = await callRoute("post", "/", {
      body: { ...BODY, slug: "Pots De Vin", ruleset: "season_3" },
    });
    expect(res.statusCode).toBe(400);
    expect(db.inducement.create).not.toHaveBeenCalled();
  });

  it("refuse un slug déjà pris pour l'édition", async () => {
    db.inducement.findUnique.mockResolvedValue({ id: "i1" });
    const res = await callRoute("post", "/", {
      body: { ...BODY, slug: "bribe", ruleset: "season_3" },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe("PUT /:id", () => {
  it("n'écrit ni le slug ni l'édition", async () => {
    db.inducement.findUnique.mockResolvedValue({ id: "i1", slug: "bribe" });
    db.inducement.update.mockResolvedValue({ id: "i1", slug: "bribe" });
    const res = await callRoute("put", "/:id", {
      params: { id: "i1" },
      body: { ...BODY, slug: "autre", ruleset: "season_2" },
    });
    expect(res.statusCode).toBe(200);
    const data = db.inducement.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("slug");
    expect(data).not.toHaveProperty("ruleset");
  });

  it("404 sur un coup de pouce absent", async () => {
    db.inducement.findUnique.mockResolvedValue(null);
    const res = await callRoute("put", "/:id", {
      params: { id: "nope" },
      body: BODY,
    });
    expect(res.statusCode).toBe(404);
    expect(db.inducement.update).not.toHaveBeenCalled();
  });
});
