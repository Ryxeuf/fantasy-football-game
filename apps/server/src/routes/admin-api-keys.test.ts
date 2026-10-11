/**
 * Clés API d'administration — routes `/admin/api-keys` et effets de bord
 * sur `/auth` (change OpenSpec `admin-api-keys`).
 *
 * Chaîne Express RÉELLE (`authUser` → `adminOnly` → `sessionOnly` →
 * handler), JWT réels signés avec `JWT_SECRET`, service de clés réel sur un
 * Prisma mocké : une clé créée par une session est ensuite PRÉSENTÉE au
 * serveur, comme le ferait un client automatisé.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import http from "http";
import jwt from "jsonwebtoken";

vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    apiKey: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("../services/audit-log", () => ({
  safeRecordAdminActionFromRequest: vi.fn(async () => {}),
}));

import { prisma } from "../prisma";
import { JWT_SECRET } from "../config";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import { hashApiKey } from "../services/api-key-rules";
import adminApiKeysRouter from "./admin-api-keys";
import authRouter from "./auth";

const db = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  apiKey: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};
const mockedAudit = vi.mocked(safeRecordAdminActionFromRequest);

const ADMIN = { id: "admin-1", coachName: "Nuffle", email: "admin@example.test" };

function sessionToken(userId = "admin-1", roles = ["admin"]): string {
  return jwt.sign({ sub: userId, roles }, JWT_SECRET);
}

interface CallResult {
  status: number;
  body: any;
}

async function call(
  method: string,
  path: string,
  options: { auth?: string; body?: unknown } = {},
): Promise<CallResult> {
  const app = express();
  app.use(express.json());
  app.use("/admin/api-keys", adminApiKeysRouter);
  app.use("/auth", authRouter);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
      const request = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method,
          headers: {
            "Content-Type": "application/json",
            ...(options.auth ? { Authorization: `Bearer ${options.auth}` } : {}),
          },
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
      if (payload) request.write(payload);
      request.end();
    });
  });
}

function viewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "key-1",
    name: "Claude Code",
    keyPrefix: "nak_Ab12Cd34",
    scope: "read",
    createdAt: new Date("2026-10-11T12:00:00.000Z"),
    expiresAt: null,
    lastUsedAt: null,
    lastUsedIp: null,
    revokedAt: null,
    revokedById: null,
    user: ADMIN,
    ...overrides,
  };
}

/** Ligne vue par `authenticateApiKey` pour une clé valide d'un admin. */
function authRow(scope: "read" | "write") {
  return {
    id: "key-1",
    name: "Claude Code",
    keyPrefix: "nak_Ab12Cd34",
    scope,
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: new Date(),
    user: {
      id: "admin-1",
      role: "admin",
      roles: ["admin"],
      valid: true,
      deletedAt: null,
      bannedUntil: null,
    },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  // adminOnly relit le rôle ; /auth/me relit le profil.
  db.user.findUnique.mockResolvedValue({
    ...ADMIN,
    role: "admin",
    roles: ["admin"],
    valid: true,
    _count: { teams: 0, matches: 0, createdMatches: 0, teamSelections: 0, createdLocalMatches: 0 },
  });
  mockedAudit.mockResolvedValue(undefined);
});

describe("POST /admin/api-keys", () => {
  it("crée une clé pour l'admin courant et rend le secret une seule fois", async () => {
    db.apiKey.create.mockImplementation(async ({ data }) =>
      viewRow({ keyPrefix: data.keyPrefix, scope: data.scope, expiresAt: data.expiresAt }),
    );

    const res = await call("POST", "/admin/api-keys", {
      auth: sessionToken(),
      body: { name: "Claude Code", scope: "read", expiresInDays: 30 },
    });

    expect(res.status).toBe(201);
    expect(res.body.secret).toMatch(/^nak_[A-Za-z0-9_-]{43}$/);
    expect(res.body.key.keyPrefix).toBe(res.body.secret.slice(0, 12));
    expect(res.body.key).not.toHaveProperty("keyHash");

    const data = db.apiKey.create.mock.calls[0][0].data;
    expect(data.userId).toBe("admin-1");
    expect(data.keyHash).toBe(hashApiKey(res.body.secret));

    expect(mockedAudit).toHaveBeenCalledTimes(1);
    const audit = mockedAudit.mock.calls[0][2];
    expect(audit.action).toBe("api-key.create");
    expect(JSON.stringify(audit)).not.toContain(res.body.secret);
  });

  it("par défaut : lecture seule, 90 jours", async () => {
    db.apiKey.create.mockImplementation(async ({ data }) =>
      viewRow({ scope: data.scope, expiresAt: data.expiresAt }),
    );
    const before = Date.now();
    const res = await call("POST", "/admin/api-keys", {
      auth: sessionToken(),
      body: { name: "Recette" },
    });
    expect(res.status).toBe(201);
    const data = db.apiKey.create.mock.calls[0][0].data;
    expect(data.scope).toBe("read");
    const days = (data.expiresAt.getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(89.9);
    expect(days).toBeLessThan(90.1);
  });

  it("accepte une clé sans expiration demandée explicitement", async () => {
    db.apiKey.create.mockImplementation(async ({ data }) => viewRow({ expiresAt: data.expiresAt }));
    const res = await call("POST", "/admin/api-keys", {
      auth: sessionToken(),
      body: { name: "CI", scope: "write", expiresInDays: null },
    });
    expect(res.status).toBe(201);
    expect(db.apiKey.create.mock.calls[0][0].data.expiresAt).toBeNull();
  });

  it.each([
    [{ name: "" }],
    [{ name: "x", scope: "admin" }],
    [{ name: "x", expiresInDays: 0 }],
    [{ name: "x", expiresInDays: 366 }],
    [{ name: "x".repeat(81) }],
  ])("refuse un corps invalide (%j)", async (body) => {
    const res = await call("POST", "/admin/api-keys", { auth: sessionToken(), body });
    expect(res.status).toBe(400);
    expect(db.apiKey.create).not.toHaveBeenCalled();
  });

  it("refuse un non-admin", async () => {
    db.user.findUnique.mockResolvedValue({ role: "user", roles: ["user"] });
    const res = await call("POST", "/admin/api-keys", {
      auth: sessionToken("coach-1", ["user"]),
      body: { name: "x" },
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /admin/api-keys", () => {
  it("liste les clés sans secret ni empreinte", async () => {
    db.apiKey.findMany.mockResolvedValueOnce([viewRow(), viewRow({ id: "key-2", revokedAt: new Date() })]);
    const res = await call("GET", "/admin/api-keys", { auth: sessionToken() });
    expect(res.status).toBe(200);
    expect(res.body.keys).toHaveLength(2);
    expect(res.body.keys[1].status).toBe("revoked");
    expect(JSON.stringify(res.body)).not.toContain("keyHash");
  });
});

describe("POST /admin/api-keys/:id/revoke", () => {
  it("révoque et journalise", async () => {
    db.apiKey.updateMany.mockResolvedValueOnce({ count: 1 });
    db.apiKey.findUnique.mockResolvedValueOnce(viewRow({ revokedAt: new Date(), revokedById: "admin-1" }));
    const res = await call("POST", "/admin/api-keys/key-1/revoke", { auth: sessionToken() });
    expect(res.status).toBe(200);
    expect(res.body.alreadyRevoked).toBe(false);
    expect(res.body.key.status).toBe("revoked");
    expect(mockedAudit.mock.calls[0][2].action).toBe("api-key.revoke");
  });

  it("est idempotente et ne rejournalise pas", async () => {
    db.apiKey.updateMany.mockResolvedValueOnce({ count: 0 });
    db.apiKey.findUnique.mockResolvedValueOnce(viewRow({ revokedAt: new Date() }));
    const res = await call("POST", "/admin/api-keys/key-1/revoke", { auth: sessionToken() });
    expect(res.status).toBe(200);
    expect(res.body.alreadyRevoked).toBe(true);
    expect(mockedAudit).not.toHaveBeenCalled();
  });

  it("rend 404 sur une clé inconnue", async () => {
    db.apiKey.updateMany.mockResolvedValueOnce({ count: 0 });
    db.apiKey.findUnique.mockResolvedValueOnce(null);
    const res = await call("POST", "/admin/api-keys/nope/revoke", { auth: sessionToken() });
    expect(res.status).toBe(404);
  });
});

describe("une clé API ne gère pas les clés", () => {
  const SECRET = `nak_${"A".repeat(43)}`;

  it.each([
    ["GET", "/admin/api-keys"],
    ["POST", "/admin/api-keys"],
    ["POST", "/admin/api-keys/key-1/revoke"],
  ])("%s %s ⇒ 403 même avec une clé en écriture", async (method, path) => {
    db.apiKey.findUnique.mockResolvedValue(authRow("write"));
    const body = method === "GET" ? undefined : { name: "x" };
    const res = await call(method, path, { auth: SECRET, body });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("interactive_session_required");
    expect(db.apiKey.create).not.toHaveBeenCalled();
    expect(db.apiKey.findMany).not.toHaveBeenCalled();
  });
});

describe("/auth avec une clé API", () => {
  const SECRET = `nak_${"B".repeat(43)}`;

  it("GET /auth/me décrit le propriétaire et annonce la clé, sans secret", async () => {
    db.apiKey.findUnique.mockResolvedValueOnce(authRow("read"));
    const res = await call("GET", "/auth/me", { auth: SECRET });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe("admin-1");
    expect(res.body.user.apiKey).toEqual({
      name: "Claude Code",
      keyPrefix: "nak_Ab12Cd34",
      scope: "read",
    });
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
  });

  it("GET /auth/me en session n'annonce aucune clé", async () => {
    const res = await call("GET", "/auth/me", { auth: sessionToken() });
    expect(res.status).toBe(200);
    expect(res.body.user.apiKey).toBeNull();
  });

  it.each([
    ["PUT", "/auth/me/password", { currentPassword: "a", newPassword: "abcdefgh1" }],
    ["PUT", "/auth/me", { coachName: "Pirate" }],
    ["DELETE", "/auth/me", undefined],
  ])("%s %s ⇒ 403 avec une clé en écriture", async (method, path, body) => {
    db.apiKey.findUnique.mockResolvedValueOnce(authRow("write"));
    const res = await call(method, path, { auth: SECRET, body });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("interactive_session_required");
  });

  it("une clé révoquée est refusée en 401", async () => {
    db.apiKey.findUnique.mockResolvedValueOnce({ ...authRow("read"), revokedAt: new Date() });
    const res = await call("GET", "/auth/me", { auth: SECRET });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("api_key_invalid");
  });
});
