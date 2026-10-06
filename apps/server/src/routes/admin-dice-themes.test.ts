/**
 * Routes admin des thèmes de dés : mapping des erreurs métier, validation
 * Zod et trace dans le journal admin. Le service est mocké (testé à part).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";

vi.mock("../middleware/authUser", () => ({
  authUser: (req: any, _res: any, next: any) => {
    req.user = { id: "admin-1", role: "admin", roles: ["admin"] };
    next();
  },
}));
vi.mock("../middleware/adminOnly", () => ({
  adminOnly: (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../prisma", () => ({ prisma: {} }));
vi.mock("../services/audit-log", () => ({
  safeRecordAdminActionFromRequest: vi.fn(async () => {}),
}));
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));
vi.mock("../services/dice-theme-admin", () => {
  class DiceThemeAdminError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "DiceThemeAdminError";
    }
  }
  return {
    DiceThemeAdminError,
    listDiceThemesForAdmin: vi.fn(),
    updateDiceTheme: vi.fn(),
    resetDiceTheme: vi.fn(),
    listCoachCosmetics: vi.fn(),
    getCoachCosmetics: vi.fn(),
    grantDiceTheme: vi.fn(),
    revokeDiceTheme: vi.fn(),
    setCoachDiceTheme: vi.fn(),
  };
});

vi.mock("../services/crowns-rewards", () => ({ listCrownsRewardsForAdmin: vi.fn() }));

import * as svc from "../services/dice-theme-admin";
import { listCrownsRewardsForAdmin } from "../services/crowns-rewards";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import router from "./admin-dice-themes";

type Mock = ReturnType<typeof vi.fn>;
const m = svc as unknown as Record<string, Mock> & { DiceThemeAdminError: new (c: string, msg: string) => Error };
const audit = safeRecordAdminActionFromRequest as unknown as Mock;

let server: http.Server;
let port: number;

function call(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method,
        headers: {
          ...(payload
            ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
            : {}),
          Authorization: "Bearer dummy",
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : null }));
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const VIEW = { id: "orques", priceCrowns: 400, enabled: true, name: { fr: "Orques", en: "Orcs" } };

beforeEach(async () => {
  vi.resetAllMocks();
  audit.mockResolvedValue(undefined);
  const app = express();
  app.use(express.json());
  app.use("/admin", router);
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

describe("catalogue", () => {
  it("GET /admin/dice-themes", async () => {
    m.listDiceThemesForAdmin.mockResolvedValue([VIEW]);
    const res = await call("GET", "/admin/dice-themes");
    expect(res.status).toBe(200);
    expect(res.body.themes).toEqual([VIEW]);
  });

  it("PATCH édite et journalise l'avant/après", async () => {
    m.updateDiceTheme.mockResolvedValue({ before: VIEW, after: { ...VIEW, priceCrowns: 500 } });
    const res = await call("PATCH", "/admin/dice-themes/orques", { priceCrowns: 500 });
    expect(res.status).toBe(200);
    expect(res.body.theme.priceCrowns).toBe(500);
    expect(m.updateDiceTheme).toHaveBeenCalledWith("orques", { priceCrowns: 500 });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "dice-theme.update", entityId: "orques" }),
    );
  });

  it("PATCH : corps vide ou prix négatif => 400, sans appel au service", async () => {
    expect((await call("PATCH", "/admin/dice-themes/orques", {})).status).toBe(400);
    expect((await call("PATCH", "/admin/dice-themes/orques", { priceCrowns: -1 })).status).toBe(400);
    expect(m.updateDiceTheme).not.toHaveBeenCalled();
  });

  it("PATCH : le défaut verrouillé => 409", async () => {
    m.updateDiceTheme.mockRejectedValue(new m.DiceThemeAdminError("default-theme-locked", "verrou"));
    const res = await call("PATCH", "/admin/dice-themes/nuffle", { enabled: false });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("default-theme-locked");
    expect(audit).not.toHaveBeenCalled();
  });

  it("POST reset journalise", async () => {
    m.resetDiceTheme.mockResolvedValue({ before: VIEW, after: VIEW });
    const res = await call("POST", "/admin/dice-themes/orques/reset");
    expect(res.status).toBe(200);
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "dice-theme.reset" }),
    );
  });
});

describe("coachs", () => {
  it("GET liste : query parsée (défauts)", async () => {
    m.listCoachCosmetics.mockResolvedValue({ items: [], total: 0, page: 1, limit: 25 });
    const res = await call("GET", "/admin/coach-cosmetics?search=bob");
    expect(res.status).toBe(200);
    expect(m.listCoachCosmetics).toHaveBeenCalledWith({ search: "bob", page: 1, limit: 25 });
  });

  it("GET détail : 404 coach inconnu", async () => {
    m.getCoachCosmetics.mockRejectedValue(new m.DiceThemeAdminError("user-not-found", "introuvable"));
    const res = await call("GET", "/admin/coach-cosmetics/ghost");
    expect(res.status).toBe(404);
  });

  it("POST offre un thème au nom de l'admin connecté", async () => {
    m.grantDiceTheme.mockResolvedValue({ user: { id: "u1" } });
    const res = await call("POST", "/admin/coach-cosmetics/u1/dice-themes/nains");
    expect(res.status).toBe(200);
    expect(m.grantDiceTheme).toHaveBeenCalledWith("u1", "nains", "admin-1");
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "coach.dice-theme.grant", entityId: "u1" }),
    );
  });

  it("POST : déjà possédé => 409", async () => {
    m.grantDiceTheme.mockRejectedValue(new m.DiceThemeAdminError("theme-already-owned", "déjà"));
    expect((await call("POST", "/admin/coach-cosmetics/u1/dice-themes/nains")).status).toBe(409);
  });

  it("DELETE retire avec remboursement", async () => {
    m.revokeDiceTheme.mockResolvedValue({ detail: { user: { id: "u1" } }, refunded: 400 });
    const res = await call("DELETE", "/admin/coach-cosmetics/u1/dice-themes/orques", { refund: true });
    expect(res.status).toBe(200);
    expect(res.body.refunded).toBe(400);
    expect(m.revokeDiceTheme).toHaveBeenCalledWith("u1", "orques", { refund: true });
  });

  it("PUT choisit (ou remet au défaut avec null)", async () => {
    m.getCoachCosmetics.mockResolvedValue({ storedThemeId: "orques" });
    m.setCoachDiceTheme.mockResolvedValue({ storedThemeId: null });
    const res = await call("PUT", "/admin/coach-cosmetics/u1/dice-theme", { themeId: null });
    expect(res.status).toBe(200);
    expect(m.setCoachDiceTheme).toHaveBeenCalledWith("u1", null);
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        action: "coach.dice-theme.select",
        oldValue: { diceTheme: "orques" },
        newValue: { diceTheme: null },
      }),
    );
  });

  it("PUT : slug invalide => 400", async () => {
    const res = await call("PUT", "/admin/coach-cosmetics/u1/dice-theme", { themeId: "../x" });
    expect(res.status).toBe(400);
    expect(m.setCoachDiceTheme).not.toHaveBeenCalled();
  });
});

describe("récompenses en Couronnes d'un coach (crowns-earning)", () => {
  const rewards = listCrownsRewardsForAdmin as unknown as Mock;

  it("GET sert le registre du coach", async () => {
    const rows = [
      {
        id: "r1",
        sourceKey: "sheet:s1:home",
        kind: "sheet",
        periodKey: "season:x",
        amount: 25,
        baseAmount: 25,
        createdAt: "2026-10-06T10:00:00.000Z",
      },
    ];
    rewards.mockResolvedValue(rows);
    const res = await call("GET", "/admin/coach-cosmetics/u1/crowns-rewards");
    expect(res.status).toBe(200);
    expect(res.body.rewards).toEqual(rows);
    expect(rewards).toHaveBeenCalledWith("u1");
  });

  it("GET : coach inconnu => 404", async () => {
    rewards.mockResolvedValue(null);
    const res = await call("GET", "/admin/coach-cosmetics/ghost/crowns-rewards");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("user-not-found");
  });
});
