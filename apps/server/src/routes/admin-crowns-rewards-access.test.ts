/**
 * Accès à la lecture admin du registre des récompenses (`crowns-earning`) :
 * chaîne Express réelle, vrais JWT et VRAI `adminOnly` (rôle relu en base,
 * Prisma mocké). Un coach non admin reçoit 403, sans que le registre soit lu.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";

vi.mock("../prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("../services/crowns-rewards", () => ({ listCrownsRewardsForAdmin: vi.fn() }));
vi.mock("../services/dice-theme-admin", () => ({ DiceThemeAdminError: class extends Error {} }));
vi.mock("../services/audit-log", () => ({ safeRecordAdminActionFromRequest: vi.fn() }));
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), log: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { prisma } from "../prisma";
import { listCrownsRewardsForAdmin } from "../services/crowns-rewards";
import { JWT_SECRET } from "../config";
import router from "./admin-dice-themes";

type Mock = ReturnType<typeof vi.fn>;
const findUser = (prisma as unknown as { user: { findUnique: Mock } }).user.findUnique;
const rewards = listCrownsRewardsForAdmin as unknown as Mock;

let server: http.Server;
let port: number;

function get(path: string, token: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path, method: "GET", headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: raw ? JSON.parse(raw) : null }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

beforeEach(async () => {
  vi.resetAllMocks();
  const app = express();
  app.use("/admin", router);
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

describe("GET /admin/coach-cosmetics/:userId/crowns-rewards — accès", () => {
  it("coach non admin : 403, registre non lu", async () => {
    findUser.mockResolvedValue({ role: "user", roles: ["user"] });
    const res = await get("/admin/coach-cosmetics/u2/crowns-rewards", jwt.sign({ sub: "u1" }, JWT_SECRET));
    expect(res.status).toBe(403);
    expect(rewards).not.toHaveBeenCalled();
  });

  it("admin : 200", async () => {
    findUser.mockResolvedValue({ role: "admin", roles: ["admin"] });
    rewards.mockResolvedValue([]);
    const res = await get("/admin/coach-cosmetics/u2/crowns-rewards", jwt.sign({ sub: "a1" }, JWT_SECRET));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ rewards: [] });
  });
});
