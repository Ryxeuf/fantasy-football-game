/**
 * `GET /crowns/me` : chaîne Express réelle, vrais JWT, wallet mocké. Le gate
 * du flag est posé au MONTAGE (index.ts) et rejoué ici.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";

vi.mock("../services/pro-wallet", () => ({
  getBalance: vi.fn(),
  getRecentTransactions: vi.fn(),
}));
vi.mock("../services/crowns-rewards", () => ({
  reconcileCrownsRewards: vi.fn(),
  loadRewardBreakdowns: vi.fn(),
}));
vi.mock("../services/featureFlags", () => ({
  CROWNS_FLAG: "crowns",
  isEnabled: vi.fn(),
}));
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

import { getBalance, getRecentTransactions } from "../services/pro-wallet";
import { loadRewardBreakdowns, reconcileCrownsRewards } from "../services/crowns-rewards";
import { isEnabled, CROWNS_FLAG } from "../services/featureFlags";
import { requireFeatureFlag } from "../middleware/requireFeatureFlag";
import { JWT_SECRET } from "../config";
import router, { CROWNS_HISTORY_LIMIT } from "./crowns";
import { DEFAULT_CROWNS_REWARD_SCHEDULE } from "../services/crowns-rewards-rules";

type Mock = ReturnType<typeof vi.fn>;
const balance = getBalance as unknown as Mock;
const history = getRecentTransactions as unknown as Mock;
const enabled = isEnabled as unknown as Mock;
const reconcile = reconcileCrownsRewards as unknown as Mock;
const breakdowns = loadRewardBreakdowns as unknown as Mock;

let server: http.Server;
let port: number;

function get(path: string, auth?: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "GET",
        headers: auth ? { Authorization: `Bearer ${auth}` } : {},
      },
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
  enabled.mockResolvedValue(true);
  reconcile.mockResolvedValue({ credited: 0, written: 0, conflict: false, skipped: false });
  breakdowns.mockResolvedValue(new Map());
  const app = express();
  app.use("/crowns", requireFeatureFlag(CROWNS_FLAG), router);
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

describe("GET /crowns/me", () => {
  it("solde + historique récent du coach connecté", async () => {
    balance.mockResolvedValue(750);
    history.mockResolvedValue([{ id: "t1", type: "SINK", amount: -250, ref: "dice-theme:glace", createdAt: "x" }]);
    const res = await get("/crowns/me", jwt.sign({ sub: "u1", roles: ["user"] }, JWT_SECRET));
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(750);
    expect(res.body.transactions).toHaveLength(1);
    expect(balance).toHaveBeenCalledWith("u1");
    expect(history).toHaveBeenCalledWith("u1", CROWNS_HISTORY_LIMIT);
    expect(res.body.schedule).toEqual(DEFAULT_CROWNS_REWARD_SCHEDULE);
  });

  it("rattrape les récompenses AVANT de lire le solde", async () => {
    const order: string[] = [];
    reconcile.mockImplementation(async () => {
      order.push("reconcile");
      return { credited: 25, written: 1, conflict: false, skipped: false };
    });
    balance.mockImplementation(async () => {
      order.push("balance");
      return 25;
    });
    history.mockResolvedValue([]);
    const res = await get("/crowns/me", jwt.sign({ sub: "u1" }, JWT_SECRET));
    expect(res.status).toBe(200);
    expect(reconcile).toHaveBeenCalledWith("u1");
    expect(order).toEqual(["reconcile", "balance"]);
  });

  it("un rattrapage en échec ne fait pas échouer la lecture", async () => {
    reconcile.mockRejectedValue(new Error("db down"));
    balance.mockResolvedValue(400);
    history.mockResolvedValue([]);
    const res = await get("/crowns/me", jwt.sign({ sub: "u1" }, JWT_SECRET));
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(400);
  });

  it("sert le détail d'un passage sur son opération, et seulement elle", async () => {
    balance.mockResolvedValue(325);
    history.mockResolvedValue([
      { id: "t-pass", type: "REWARD", amount: 325, ref: "rewards:abc", createdAt: "x" },
      { id: "t-buy", type: "SINK", amount: -250, ref: "dice-theme:glace", createdAt: "y" },
    ]);
    const detail = { sheets: 1, achievements: 1, signup: true, capped: 0 };
    breakdowns.mockResolvedValue(new Map([["t-pass", detail]]));
    const res = await get("/crowns/me", jwt.sign({ sub: "u1" }, JWT_SECRET));
    expect(res.status).toBe(200);
    expect(res.body.transactions[0].rewards).toEqual(detail);
    expect(res.body.transactions[1]).not.toHaveProperty("rewards");
  });

  it("un détail indisponible ne fait pas échouer la lecture", async () => {
    balance.mockResolvedValue(10);
    history.mockResolvedValue([{ id: "t1", type: "REWARD", amount: 10, ref: "rewards:z", createdAt: "x" }]);
    breakdowns.mockRejectedValue(new Error("boom"));
    const res = await get("/crowns/me", jwt.sign({ sub: "u1" }, JWT_SECRET));
    expect(res.status).toBe(200);
    expect(res.body.transactions[0]).not.toHaveProperty("rewards");
  });

  it("401 sans token", async () => {
    expect((await get("/crowns/me")).status).toBe(401);
  });

  it("403 quand le flag est OFF, sans lire le wallet", async () => {
    enabled.mockResolvedValue(false);
    const res = await get("/crowns/me", jwt.sign({ sub: "u1" }, JWT_SECRET));
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: "feature_flag_disabled", flag: "crowns" });
    expect(balance).not.toHaveBeenCalled();
    expect(reconcile).not.toHaveBeenCalled();
  });
});
