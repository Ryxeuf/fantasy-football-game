import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({ prisma: {} }));

vi.mock("../middleware/authUser", () => ({
  authUser: (req: any, _res: any, next: any) => {
    req.user = { id: "admin-1", role: "admin", roles: ["admin"] };
    return next();
  },
}));

vi.mock("../middleware/adminOnly", () => ({
  adminOnly: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../services/audit-log", () => ({
  safeRecordAdminActionFromRequest: vi.fn(async () => {}),
}));

vi.mock("../services/crowns-admin", () => {
  class CrownsAdminError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "CrownsAdminError";
    }
  }
  return {
    CrownsAdminError,
    createCoachWallet: vi.fn(),
    createMissingWallets: vi.fn(),
    getCrownsOverview: vi.fn(),
    listCoachWallets: vi.fn(),
    listCrownsLedger: vi.fn(),
  };
});

import express from "express";
import http from "http";
import router from "./admin-crowns";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import * as service from "../services/crowns-admin";

const svc = vi.mocked(service);
const audit = vi.mocked(safeRecordAdminActionFromRequest);

async function request(method: "GET" | "POST", path: string): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/admin", router);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const req = http.request(
        { hostname: "127.0.0.1", port: addr.port, path: `/admin${path}`, method },
        (res) => {
          let buf = "";
          res.on("data", (c) => (buf += c));
          res.on("end", () => {
            server.close();
            resolve({ status: res.statusCode ?? 0, body: buf ? JSON.parse(buf) : null });
          });
        },
      );
      req.on("error", (e) => {
        server.close();
        reject(e);
      });
      req.end();
    });
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /admin/wallets", () => {
  it("passe la query parsée (défauts compris) au service", async () => {
    svc.listCoachWallets.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 25,
      counts: { all: 0, with: 0, without: 0 },
    });
    const res = await request("GET", "/wallets?status=without&search=bob");
    expect(res.status).toBe(200);
    expect(svc.listCoachWallets).toHaveBeenCalledWith({ status: "without", search: "bob", page: 1, limit: 25 });
  });

  it("statut inconnu => 400", async () => {
    const res = await request("GET", "/wallets?status=maybe");
    expect(res.status).toBe(400);
    expect(svc.listCoachWallets).not.toHaveBeenCalled();
  });
});

describe("POST /admin/wallets/:userId", () => {
  it("201 + audit à la création", async () => {
    svc.createCoachWallet.mockResolvedValueOnce({
      created: true,
      wallet: { userId: "u1", crowns: 0, createdAt: "2026-10-05T00:00:00.000Z" },
    });
    const res = await request("POST", "/wallets/u1");
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "wallet.create", entity: "ProWallet", entityId: "u1" }),
    );
  });

  it("200 sans audit si le wallet existait", async () => {
    svc.createCoachWallet.mockResolvedValueOnce({
      created: false,
      wallet: { userId: "u1", crowns: 50, createdAt: "2026-10-05T00:00:00.000Z" },
    });
    const res = await request("POST", "/wallets/u1");
    expect(res.status).toBe(200);
    expect(audit).not.toHaveBeenCalled();
  });

  it("404 sur un coach inconnu", async () => {
    svc.createCoachWallet.mockRejectedValueOnce(new service.CrownsAdminError("user-not-found", "Utilisateur introuvable"));
    const res = await request("POST", "/wallets/ghost");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("user-not-found");
  });
});

describe("POST /admin/wallets/create-missing", () => {
  it("n'est pas lu comme un id de coach", async () => {
    svc.createMissingWallets.mockResolvedValueOnce({ created: 3, remaining: 0 });
    const res = await request("POST", "/wallets/create-missing");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ created: 3, remaining: 0 });
    expect(svc.createCoachWallet).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "wallet.create-missing", newValue: { created: 3, remaining: 0 } }),
    );
  });

  it("aucun wallet créé => pas d'audit", async () => {
    svc.createMissingWallets.mockResolvedValueOnce({ created: 0, remaining: 0 });
    await request("POST", "/wallets/create-missing");
    expect(audit).not.toHaveBeenCalled();
  });

  it("erreur inattendue => 500", async () => {
    svc.createMissingWallets.mockRejectedValueOnce(new Error("boom"));
    const res = await request("POST", "/wallets/create-missing");
    expect(res.status).toBe(500);
  });
});

describe("Couronnes", () => {
  it("overview : fenêtre par défaut de 30 jours", async () => {
    svc.getCrownsOverview.mockResolvedValueOnce({} as never);
    const res = await request("GET", "/crowns/overview");
    expect(res.status).toBe(200);
    expect(svc.getCrownsOverview).toHaveBeenCalledWith(30);
  });

  it("overview : fenêtre hors bornes => 400", async () => {
    const res = await request("GET", "/crowns/overview?days=1000");
    expect(res.status).toBe(400);
  });

  it("journal : filtre par type", async () => {
    svc.listCrownsLedger.mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 50 });
    const res = await request("GET", "/crowns/transactions?type=SINK");
    expect(res.status).toBe(200);
    expect(svc.listCrownsLedger).toHaveBeenCalledWith({ type: "SINK", page: 1, limit: 50 });
  });

  it("journal : type inconnu => 400", async () => {
    const res = await request("GET", "/crowns/transactions?type=STEAL");
    expect(res.status).toBe(400);
  });
});
