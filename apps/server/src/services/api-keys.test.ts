import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    apiKey: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  ApiKeyError,
  authenticateApiKey,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "./api-keys";
import { generateApiKey, hashApiKey } from "./api-key-rules";

const db = prisma as unknown as {
  apiKey: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

const NOW = new Date("2026-10-11T12:00:00.000Z");
const OWNER = { id: "admin-1", coachName: "Nuffle", email: "admin@example.test" };

function viewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "key-1",
    name: "Recette prod",
    keyPrefix: "nak_Ab12Cd34",
    scope: "read",
    createdAt: NOW,
    expiresAt: null,
    lastUsedAt: null,
    lastUsedIp: null,
    revokedAt: null,
    revokedById: null,
    user: OWNER,
    ...overrides,
  };
}

function authRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "key-1",
    name: "Recette prod",
    keyPrefix: "nak_Ab12Cd34",
    scope: "write",
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    user: {
      id: "admin-1",
      role: "admin",
      roles: ["admin"],
      valid: true,
      deletedAt: null,
      bannedUntil: null,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("createApiKey", () => {
  it("ne stocke que l'empreinte et rend le secret une seule fois", async () => {
    db.apiKey.create.mockImplementation(async ({ data }) =>
      viewRow({ keyPrefix: data.keyPrefix, scope: data.scope, expiresAt: data.expiresAt }),
    );

    const { key, secret } = await createApiKey(
      { userId: "admin-1", name: "Recette prod", scope: "read", expiresInDays: 90 },
      NOW,
    );

    const data = db.apiKey.create.mock.calls[0][0].data;
    expect(data.keyHash).toBe(hashApiKey(secret));
    expect(JSON.stringify(data)).not.toContain(secret);
    expect(data.keyPrefix).toBe(secret.slice(0, 12));
    expect(data.userId).toBe("admin-1");
    expect(data.expiresAt.toISOString()).toBe("2027-01-09T12:00:00.000Z");
    expect(key).not.toHaveProperty("keyHash");
    expect(key.status).toBe("active");
    expect(key.expiresAt).toBe("2027-01-09T12:00:00.000Z");
  });

  it("pose une clé sans expiration quand expiresInDays est null", async () => {
    db.apiKey.create.mockImplementation(async ({ data }) => viewRow({ expiresAt: data.expiresAt }));
    await createApiKey(
      { userId: "admin-1", name: "CI", scope: "write", expiresInDays: null },
      NOW,
    );
    expect(db.apiKey.create.mock.calls[0][0].data.expiresAt).toBeNull();
  });
});

describe("listApiKeys", () => {
  it("sert les statuts dérivés, sans secret ni empreinte", async () => {
    db.apiKey.findMany.mockResolvedValueOnce([
      viewRow({ id: "a" }),
      viewRow({ id: "b", revokedAt: NOW, revokedById: "admin-2" }),
      viewRow({ id: "c", expiresAt: new Date("2026-01-01") }),
    ]);
    const keys = await listApiKeys(NOW);
    expect(keys.map((k) => k.status)).toEqual(["active", "revoked", "expired"]);
    expect(db.apiKey.findMany.mock.calls[0][0].select).not.toHaveProperty("keyHash");
  });
});

describe("revokeApiKey", () => {
  it("révoque une clé active", async () => {
    db.apiKey.updateMany.mockResolvedValueOnce({ count: 1 });
    db.apiKey.findUnique.mockResolvedValueOnce(viewRow({ revokedAt: NOW, revokedById: "admin-1" }));
    const result = await revokeApiKey({ id: "key-1", revokedById: "admin-1" }, NOW);
    expect(result.alreadyRevoked).toBe(false);
    expect(result.key.status).toBe("revoked");
    expect(db.apiKey.updateMany).toHaveBeenCalledWith({
      where: { id: "key-1", revokedAt: null },
      data: { revokedAt: NOW, revokedById: "admin-1" },
    });
  });

  it("est idempotente sur une clé déjà révoquée", async () => {
    db.apiKey.updateMany.mockResolvedValueOnce({ count: 0 });
    db.apiKey.findUnique.mockResolvedValueOnce(viewRow({ revokedAt: new Date("2026-10-01") }));
    const result = await revokeApiKey({ id: "key-1", revokedById: "admin-2" }, NOW);
    expect(result.alreadyRevoked).toBe(true);
  });

  it("lève not_found sur un id inconnu", async () => {
    db.apiKey.updateMany.mockResolvedValueOnce({ count: 0 });
    db.apiKey.findUnique.mockResolvedValueOnce(null);
    await expect(
      revokeApiKey({ id: "nope", revokedById: "admin-1" }, NOW),
    ).rejects.toBeInstanceOf(ApiKeyError);
  });
});

describe("authenticateApiKey", () => {
  it("refuse un secret mal formé sans toucher la base", async () => {
    const result = await authenticateApiKey("nak_court", { ip: null, now: NOW });
    expect(result).toEqual({ ok: false, reason: "unknown" });
    expect(db.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it("cherche par empreinte et rend l'identité du propriétaire", async () => {
    const { secret } = generateApiKey();
    db.apiKey.findUnique.mockResolvedValueOnce(authRow());
    db.apiKey.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await authenticateApiKey(secret, { ip: "203.0.113.7", now: NOW });

    expect(db.apiKey.findUnique.mock.calls[0][0].where).toEqual({ keyHash: hashApiKey(secret) });
    expect(result).toEqual({
      ok: true,
      identity: expect.objectContaining({ apiKeyId: "key-1", userId: "admin-1", scope: "write" }),
    });
    // Dernier usage : écriture conditionnelle, hors chemin critique.
    await vi.waitFor(() => expect(db.apiKey.updateMany).toHaveBeenCalledTimes(1));
    expect(db.apiKey.updateMany.mock.calls[0][0].data).toEqual({
      lastUsedAt: NOW,
      lastUsedIp: "203.0.113.7",
    });
  });

  it("n'écrit pas le dernier usage dans la fenêtre d'une minute", async () => {
    db.apiKey.findUnique.mockResolvedValueOnce(
      authRow({ lastUsedAt: new Date(NOW.getTime() - 5_000) }),
    );
    await authenticateApiKey(generateApiKey().secret, { ip: null, now: NOW });
    expect(db.apiKey.updateMany).not.toHaveBeenCalled();
  });

  it("une écriture du dernier usage qui échoue ne fait pas échouer l'authentification", async () => {
    db.apiKey.findUnique.mockResolvedValueOnce(authRow());
    db.apiKey.updateMany.mockRejectedValueOnce(new Error("db down"));
    const result = await authenticateApiKey(generateApiKey().secret, { ip: null, now: NOW });
    expect(result.ok).toBe(true);
  });

  it("refuse une clé révoquée", async () => {
    db.apiKey.findUnique.mockResolvedValueOnce(authRow({ revokedAt: NOW }));
    const result = await authenticateApiKey(generateApiKey().secret, { ip: null, now: NOW });
    expect(result).toEqual({ ok: false, reason: "revoked" });
    expect(db.apiKey.updateMany).not.toHaveBeenCalled();
  });

  it("refuse un secret inconnu", async () => {
    db.apiKey.findUnique.mockResolvedValueOnce(null);
    const result = await authenticateApiKey(generateApiKey().secret, { ip: null, now: NOW });
    expect(result).toEqual({ ok: false, reason: "unknown" });
  });
});
