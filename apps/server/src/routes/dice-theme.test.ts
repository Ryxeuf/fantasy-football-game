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

vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("../services/featureFlags", () => ({
  DICE_THEMES_FLAG: "dice_themes",
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

const findUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const updateMany = prisma.user.updateMany as unknown as ReturnType<typeof vi.fn>;
const mockedIsEnabled = isEnabled as unknown as ReturnType<typeof vi.fn>;

let server: http.Server;
let port: number;

function token(userId = "u1"): string {
  return jwt.sign({ sub: userId, roles: ["user"] }, JWT_SECRET);
}

function call(
  method: "GET" | "PUT",
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

  it("jamais choisi (null) => thème par défaut + catalogue possédé", async () => {
    findUnique.mockResolvedValue({ diceTheme: null });
    const res = await call("GET", "/dice-themes/me", { auth: token("u1") });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      themeId: "nuffle",
      defaultThemeId: "nuffle",
      themes: [{ id: "nuffle", priceCrowns: null, owned: true }],
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { diceTheme: true },
    });
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
