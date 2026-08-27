/**
 * Lot 6.2 — grille admin du barème d'avancement.
 *
 * Ce que l'API protège : des paliers hors 1..6 ou un coût négatif
 * produiraient une grille que le repository refuserait de servir (donc un
 * repli silencieux sur la Saison 3), et toute écriture doit invalider le
 * cache pour que la correction s'applique au prochain calcul de VE.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response } from "express";

const db = vi.hoisted(() => ({
  advancementCost: { findMany: vi.fn(), upsert: vi.fn() },
  characteristicValue: { findMany: vi.fn(), upsert: vi.fn() },
  rulesetConfig: { findMany: vi.fn(), upsert: vi.fn() },
}));
vi.mock("../prisma", () => ({ prisma: db }));
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));
vi.mock("../services/audit-log", () => ({
  safeRecordAdminActionFromRequest: vi.fn(),
}));
vi.mock("../services/advancement-schedule-repository", () => ({
  invalidateAdvancementScheduleCache: vi.fn(),
}));
vi.mock("../seeders/sync-advancement-costs", () => ({
  syncAdvancementCosts: vi.fn().mockResolvedValue({ write: true }),
}));
vi.mock("../middleware/authUser", () => ({
  authUser: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../middleware/adminOnly", () => ({
  adminOnly: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { invalidateAdvancementScheduleCache } from "../services/advancement-schedule-repository";
import { syncAdvancementCosts } from "../seeders/sync-advancement-costs";
import router from "./admin-advancement-costs";

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

/** Rejoue la chaîne complète (validation Zod + handler). */
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

const VALID = {
  ruleset: "season_2",
  costs: [
    { kind: "secondary", step: 1, sppCost: 12, teamValueSurcharge: 40000 },
  ],
  characteristics: [{ stat: "st", surcharge: 80000 }],
  eliteSkillSurcharge: 0,
};

beforeEach(() => {
  vi.resetAllMocks();
  db.advancementCost.findMany.mockResolvedValue([]);
  db.characteristicValue.findMany.mockResolvedValue([]);
  db.rulesetConfig.findMany.mockResolvedValue([]);
});

describe("GET /", () => {
  it("renvoie la grille d'une édition", async () => {
    db.advancementCost.findMany.mockResolvedValue([{ kind: "primary" }]);
    const res = await callRoute("get", "/", { query: { ruleset: "season_3" } });
    expect(res.payload).toMatchObject({ costs: [{ kind: "primary" }] });
    expect(db.advancementCost.findMany.mock.calls[0][0].where).toEqual({
      ruleset: "season_3",
    });
  });
});

describe("PUT /", () => {
  it("enregistre la grille et invalide le cache", async () => {
    const res = await callRoute("put", "/", { body: VALID });
    expect(res.statusCode).toBe(200);
    expect(db.advancementCost.upsert).toHaveBeenCalledTimes(1);
    expect(db.characteristicValue.upsert).toHaveBeenCalledTimes(1);
    expect(db.rulesetConfig.upsert).toHaveBeenCalledTimes(1);
    expect(invalidateAdvancementScheduleCache).toHaveBeenCalled();
  });

  it("refuse un palier hors 1..6", async () => {
    const res = await callRoute("put", "/", {
      body: { ...VALID, costs: [{ ...VALID.costs[0], step: 7 }] },
    });
    expect(res.statusCode).toBe(400);
    expect(db.advancementCost.upsert).not.toHaveBeenCalled();
  });

  it("refuse un coût PSP négatif", async () => {
    const res = await callRoute("put", "/", {
      body: { ...VALID, costs: [{ ...VALID.costs[0], sppCost: -1 }] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("refuse une caractéristique inconnue", async () => {
    const res = await callRoute("put", "/", {
      body: {
        ...VALID,
        characteristics: [{ stat: "luck", surcharge: 10 }],
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /reset", () => {
  it("amorce l'édition demandée depuis le moteur", async () => {
    const res = await callRoute("post", "/reset", {
      body: { ruleset: "season_2" },
    });
    expect(res.statusCode).toBe(200);
    expect(syncAdvancementCosts).toHaveBeenCalledWith({
      write: true,
      force: true,
      rulesets: ["season_2"],
    });
  });

  it("refuse une édition inconnue", async () => {
    const res = await callRoute("post", "/reset", {
      body: { ruleset: "season_9" },
    });
    expect(res.statusCode).toBe(400);
    expect(syncAdvancementCosts).not.toHaveBeenCalled();
  });
});
