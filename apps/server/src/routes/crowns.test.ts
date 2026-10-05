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
vi.mock("../services/featureFlags", () => ({
  CROWNS_FLAG: "crowns",
  isEnabled: vi.fn(),
}));
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

import { getBalance, getRecentTransactions } from "../services/pro-wallet";
import { isEnabled, CROWNS_FLAG } from "../services/featureFlags";
import { requireFeatureFlag } from "../middleware/requireFeatureFlag";
import { JWT_SECRET } from "../config";
import router, { CROWNS_HISTORY_LIMIT } from "./crowns";

type Mock = ReturnType<typeof vi.fn>;
const balance = getBalance as unknown as Mock;
const history = getRecentTransactions as unknown as Mock;
const enabled = isEnabled as unknown as Mock;

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
  });
});
