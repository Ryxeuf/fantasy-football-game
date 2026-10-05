/**
 * Routes `/dice-themes/me` : chaîne Express réelle (http natif), vrais JWT,
 * Prisma mocké. Le gate du flag est posé au MONTAGE (index.ts) : il est
 * rejoué ici tel quel pour vérifier qu'un flag OFF ne touche pas la base.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";

vi.mock("../prisma", () => {
  const prisma: Record<string, any> = {
    user: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    userDiceTheme: { findMany: vi.fn(), create: vi.fn() },
    diceTheme: { findMany: vi.fn() },
    proWallet: { upsert: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    proTransaction: { create: vi.fn() },
  };
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return { prisma };
});
vi.mock("../services/featureFlags", () => ({
  DICE_THEMES_FLAG: "dice_themes",
  CROWNS_FLAG: "crowns",
  isEnabled: vi.fn(),
}));
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

import { prisma } from "../prisma";
import { isEnabled, DICE_THEMES_FLAG } from "../services/featureFlags";
import { requireFeatureFlag } from "../middleware/requireFeatureFlag";
import { JWT_SECRET } from "../config";
import router from "./dice-theme";

type Mock = ReturnType<typeof vi.fn>;
const db = prisma as unknown as Record<string, Record<string, Mock>> & { $transaction: Mock };
const findUnique = db.user.findUnique;
const updateMany = db.user.updateMany;
const mockedIsEnabled = isEnabled as unknown as ReturnType<typeof vi.fn>;

let server: http.Server;
let port: number;

function token(userId = "u1", extra: Record<string, unknown> = {}): string {
  return jwt.sign({ sub: userId, roles: ["user"], ...extra }, JWT_SECRET);
}

function call(
  method: "GET" | "PUT" | "POST",
  path: string,
  opts: { auth?: string; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = opts.body === undefined ? undefined : JSON.stringify(opts.body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method,
        headers: {
          ...(payload ? { "Content-Type": "application/json" } : {}),
          ...(opts.auth ? { Authorization: `Bearer ${opts.auth}` } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : null }),
        );
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

beforeEach(async () => {
  vi.resetAllMocks();
  mockedIsEnabled.mockResolvedValue(true);
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  db.userDiceTheme.findMany.mockResolvedValue([]);
  db.diceTheme.findMany.mockResolvedValue([]);
  const app = express();
  app.use(express.json());
  app.use("/dice-themes", requireFeatureFlag(DICE_THEMES_FLAG), router);
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

describe("GET /dice-themes/me", () => {
  it("403 quand le flag est OFF, sans lire la base", async () => {
    mockedIsEnabled.mockResolvedValue(false);
    const res = await call("GET", "/dice-themes/me", { auth: token() });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "feature_flag_disabled", flag: "dice_themes" });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("401 sans token", async () => {
    const res = await call("GET", "/dice-themes/me");
    expect(res.status).toBe(401);
  });

  it("jamais choisi (null) => dé original + boutique complète", async () => {
    findUnique.mockResolvedValue({ diceTheme: null });
    const res = await call("GET", "/dice-themes/me", { auth: token("u1") });
    expect(res.status).toBe(200);
    expect(res.body.themeId).toBe("nuffle");
    expect(res.body.defaultThemeId).toBe("nuffle");
    expect(res.body.themes).toHaveLength(36);
    expect(res.body.themes[0]).toMatchObject({
      id: "nuffle",
      collection: "classic",
      priceCrowns: null,
      owned: true,
      forSale: false,
    });
    expect(res.body.themes.find((t: { id: string }) => t.id === "orques")).toMatchObject({
      priceCrowns: 400,
      owned: false,
      forSale: true,
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { diceTheme: true },
    });
  });

  it("thème acheté et choisi => servi, marqué possédé", async () => {
    findUnique.mockResolvedValue({ diceTheme: "orques" });
    db.userDiceTheme.findMany.mockResolvedValue([{ themeId: "orques" }]);
    const res = await call("GET", "/dice-themes/me", { auth: token("u1") });
    expect(res.body.themeId).toBe("orques");
    expect(res.body.themes.find((t: { id: string }) => t.id === "orques")).toMatchObject({
      owned: true,
      forSale: false,
    });
  });

  it("thème payant choisi mais plus possédé (révoqué) => dé original", async () => {
    findUnique.mockResolvedValue({ diceTheme: "orques" });
    const res = await call("GET", "/dice-themes/me", { auth: token("u1") });
    expect(res.body.themeId).toBe("nuffle");
  });

  it("thème stocké disparu du catalogue => repli sur le défaut", async () => {
    findUnique.mockResolvedValue({ diceTheme: "retired" });
    const res = await call("GET", "/dice-themes/me", { auth: token() });
    expect(res.body.themeId).toBe("nuffle");
  });
});

describe("PUT /dice-themes/me", () => {
  it("enregistre un thème possédé", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    const res = await call("PUT", "/dice-themes/me", {
      auth: token("u1"),
      body: { themeId: "nuffle" },
    });
    expect(res.status).toBe(200);
    expect(res.body.themeId).toBe("nuffle");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { diceTheme: "nuffle" },
    });
  });

  it("400 sur un thème inconnu, sans écrire", async () => {
    const res = await call("PUT", "/dice-themes/me", {
      auth: token(),
      body: { themeId: "golden-skulls" },
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("unknown-theme");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("400 sur un corps invalide (validation Zod)", async () => {
    const res = await call("PUT", "/dice-themes/me", {
      auth: token(),
      body: { themeId: "../etc" },
    });
    expect(res.status).toBe(400);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("403 quand le flag est OFF, sans écrire", async () => {
    mockedIsEnabled.mockResolvedValue(false);
    const res = await call("PUT", "/dice-themes/me", {
      auth: token(),
      body: { themeId: "nuffle" },
    });
    expect(res.status).toBe(403);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("404 si le compte n'existe plus", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const res = await call("PUT", "/dice-themes/me", {
      auth: token(),
      body: { themeId: "nuffle" },
    });
    expect(res.status).toBe(404);
  });
});

describe("PUT /dice-themes/me — thèmes payants", () => {
  it("403 sur un thème payant non acquis, sans écrire", async () => {
    const res = await call("PUT", "/dice-themes/me", {
      auth: token(),
      body: { themeId: "orques" },
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("theme-not-owned");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("enregistre un thème acquis", async () => {
    db.userDiceTheme.findMany.mockResolvedValue([{ themeId: "orques" }]);
    updateMany.mockResolvedValue({ count: 1 });
    const res = await call("PUT", "/dice-themes/me", {
      auth: token("u1"),
      body: { themeId: "orques" },
    });
    expect(res.status).toBe(200);
    expect(res.body.themeId).toBe("orques");
  });
});

describe("POST /dice-themes/:themeId/purchase", () => {
  beforeEach(() => {
    db.proWallet.upsert.mockResolvedValue({ userId: "u1", crowns: 1000 });
  });

  it("débite, acquiert, journalise et équipe — dans une transaction", async () => {
    db.proWallet.findUnique
      .mockResolvedValueOnce({ crowns: 1000 }) // solde lu avant
      .mockResolvedValueOnce({ crowns: 600 }); // solde après débit
    db.proWallet.updateMany.mockResolvedValue({ count: 1 });
    const res = await call("POST", "/dice-themes/orques/purchase", { auth: token("u1") });
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(600);
    expect(res.body.themeId).toBe("orques");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.proWallet.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", crowns: { gte: 400 } },
      data: { crowns: { decrement: 400 } },
    });
    expect(db.userDiceTheme.create).toHaveBeenCalledWith({
      data: { userId: "u1", themeId: "orques", source: "purchase", priceCrowns: 400 },
    });
    expect(db.proTransaction.create).toHaveBeenCalledWith({
      data: { walletId: "u1", type: "SINK", amount: -400, ref: "dice-theme:orques" },
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { diceTheme: "orques" },
    });
  });

  it("402 solde insuffisant, sans transaction", async () => {
    db.proWallet.findUnique.mockResolvedValue({ crowns: 100 });
    const res = await call("POST", "/dice-themes/orques/purchase", { auth: token() });
    expect(res.status).toBe(402);
    expect(res.body.code).toBe("insufficient-funds");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("402 si le solde a fondu entre la lecture et le débit (décrément conditionnel)", async () => {
    db.proWallet.findUnique.mockResolvedValue({ crowns: 1000 });
    db.proWallet.updateMany.mockResolvedValue({ count: 0 });
    const res = await call("POST", "/dice-themes/orques/purchase", { auth: token() });
    expect(res.status).toBe(402);
    expect(db.userDiceTheme.create).not.toHaveBeenCalled();
  });

  it("409 déjà possédé (y compris course P2002)", async () => {
    db.userDiceTheme.findMany.mockResolvedValue([{ themeId: "orques" }]);
    db.proWallet.findUnique.mockResolvedValue({ crowns: 1000 });
    let res = await call("POST", "/dice-themes/orques/purchase", { auth: token() });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("theme-already-owned");

    db.userDiceTheme.findMany.mockResolvedValue([]);
    db.proWallet.updateMany.mockResolvedValue({ count: 1 });
    db.userDiceTheme.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    res = await call("POST", "/dice-themes/orques/purchase", { auth: token() });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("theme-already-owned");
  });

  it("409 thème retiré de la vente (édité en admin)", async () => {
    db.diceTheme.findMany.mockResolvedValue([
      {
        slug: "orques",
        collection: "team",
        nameFr: "Orques",
        nameEn: "Orcs",
        descriptionFr: null,
        descriptionEn: null,
        priceCrowns: 400,
        enabled: false,
        sortOrder: 120,
      },
    ]);
    db.proWallet.findUnique.mockResolvedValue({ crowns: 1000 });
    const res = await call("POST", "/dice-themes/orques/purchase", { auth: token() });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("theme-not-for-sale");
  });

  it("400 thème inconnu", async () => {
    db.proWallet.findUnique.mockResolvedValue({ crowns: 1000 });
    const res = await call("POST", "/dice-themes/ghost/purchase", { auth: token() });
    expect(res.status).toBe(400);
  });

  it("403 quand le flag `crowns` est OFF, sans lire le wallet", async () => {
    mockedIsEnabled.mockImplementation(async (key: string) => key !== "crowns");
    const res = await call("POST", "/dice-themes/orques/purchase", { auth: token() });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "feature_flag_disabled", flag: "crowns" });
    expect(db.proWallet.findUnique).not.toHaveBeenCalled();
  });

  it("403 pendant une impersonation admin", async () => {
    const res = await call("POST", "/dice-themes/orques/purchase", {
      auth: token("u1", { act: "admin-1" }),
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("impersonation-forbidden");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
