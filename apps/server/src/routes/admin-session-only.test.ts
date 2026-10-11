/**
 * Routes admin réservées à une session interactive (change OpenSpec
 * `admin-api-keys`, D7) : tout ce par quoi une clé API fuitée se
 * perpétuerait après sa révocation — impersonner, promouvoir un compte,
 * rendre un mot de passe en clair, désactiver le propriétaire.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ apiKey: undefined as unknown }));

vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
  },
}));

vi.mock("../middleware/authUser", () => ({
  authUser: (req: any, _res: any, next: any) => {
    req.user = {
      id: "admin-1",
      role: "admin",
      roles: ["admin"],
      ...(authState.apiKey ? { apiKey: authState.apiKey } : {}),
    };
    return next();
  },
}));

vi.mock("../middleware/adminOnly", () => ({
  adminOnly: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../services/audit-log", () => ({
  safeRecordAdminActionFromRequest: vi.fn(async () => {}),
}));

vi.mock("./auth", async () => ({
  getRefreshTokenStore: () => ({ revokeAllForUser: vi.fn(async () => {}) }),
}));

import express from "express";
import http from "http";
import adminRouter from "./admin";
import { prisma } from "../prisma";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";

const mockedPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};
const mockedAudit = vi.mocked(safeRecordAdminActionFromRequest);

async function call(method: string, path: string, body?: unknown) {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRouter);
  const server = http.createServer(app);
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const request = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method,
          headers: { "Content-Type": "application/json", Authorization: "Bearer dummy" },
        },
        (res) => {
          let buf = "";
          res.on("data", (c) => (buf += c));
          res.on("end", () => {
            server.close();
            try {
              resolve({ status: res.statusCode ?? 0, body: buf ? JSON.parse(buf) : {} });
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      request.on("error", (e) => {
        server.close();
        reject(e);
      });
      if (body !== undefined) request.write(JSON.stringify(body));
      request.end();
    });
  });
}

const WRITE_KEY = { id: "key-1", name: "CI", keyPrefix: "nak_x", scope: "write" };

const ROUTES = [
  ["PATCH", "/admin/users/user-99/role", { role: "admin" }],
  ["PATCH", "/admin/users/user-99/valid", { valid: false }],
  ["POST", "/admin/users/user-99/password-reset", {}],
  ["POST", "/admin/users/user-99/impersonate", {}],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  authState.apiKey = undefined;
});

describe("routes admin réservées à une session interactive", () => {
  it.each(ROUTES)("%s %s ⇒ 403 avec une clé API en écriture, sans rien lire ni écrire", async (method, path, body) => {
    authState.apiKey = WRITE_KEY;
    const res = await call(method, path, body);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("interactive_session_required");
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain("tempPassword");
  });

  it("une session interactive passe la garde (rôle modifié)", async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ role: "user", roles: ["user"] });
    mockedPrisma.user.update.mockResolvedValue({
      id: "user-99",
      email: "x@x",
      name: null,
      role: "admin",
      roles: ["admin"],
      patreon: false,
      valid: true,
    });
    const res = await call("PATCH", "/admin/users/user-99/role", { role: "admin" });
    expect(res.status).not.toBe(403);
    expect(mockedPrisma.user.update).toHaveBeenCalled();
  });
});
