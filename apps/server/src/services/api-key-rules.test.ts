import { describe, expect, it } from "vitest";

import {
  API_KEY_LAST_USED_WINDOW_MS,
  apiKeyStatus,
  computeApiKeyExpiry,
  evaluateApiKey,
  extractApiKey,
  generateApiKey,
  hashApiKey,
  isApiKeyFormat,
  isMethodAllowedForScope,
  parseApiKeyScope,
  shouldTouchLastUsed,
  type ApiKeyRow,
} from "./api-key-rules";

const NOW = new Date("2026-10-11T12:00:00.000Z");

function row(overrides: Partial<ApiKeyRow> = {}): ApiKeyRow {
  return {
    id: "key-1",
    name: "Recette prod",
    keyPrefix: "nak_Ab12Cd34",
    scope: "read",
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

describe("generateApiKey", () => {
  it("produit un secret nak_ de 43 caractères base64url, son préfixe et son empreinte", () => {
    const key = generateApiKey();
    expect(isApiKeyFormat(key.secret)).toBe(true);
    expect(key.secret).toHaveLength(4 + 43);
    expect(key.keyPrefix).toBe(key.secret.slice(0, 12));
    expect(key.keyHash).toBe(hashApiKey(key.secret));
    expect(key.keyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("est déterministe pour une source d'aléa donnée et différent d'un tirage à l'autre", () => {
    const fixed = () => Buffer.alloc(32, 7);
    expect(generateApiKey(fixed).secret).toBe(generateApiKey(fixed).secret);
    expect(generateApiKey().secret).not.toBe(generateApiKey().secret);
  });

  it("le préfixe stocké ne dévoile que 8 des 43 caractères aléatoires", () => {
    const key = generateApiKey();
    expect(key.secret.startsWith(key.keyPrefix)).toBe(true);
    // 35 caractères base64url restent secrets, soit 210 bits.
    expect(key.secret.length - key.keyPrefix.length).toBe(35);
  });
});

describe("extractApiKey", () => {
  const secret = generateApiKey().secret;

  it("lit Authorization: Bearer nak_…", () => {
    expect(extractApiKey({ authorization: `Bearer ${secret}` })).toBe(secret);
    expect(extractApiKey({ authorization: `bearer ${secret}` })).toBe(secret);
  });

  it("lit X-API-Key", () => {
    expect(extractApiKey({ "x-api-key": secret })).toBe(secret);
    expect(extractApiKey({ "x-api-key": [secret] })).toBe(secret);
  });

  it("laisse un JWT au chemin JWT", () => {
    expect(extractApiKey({ authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.x.y" })).toBeNull();
    expect(extractApiKey({})).toBeNull();
    expect(extractApiKey({ authorization: "" })).toBeNull();
  });

  it("ignore un X-API-Key qui n'a pas le préfixe", () => {
    expect(extractApiKey({ "x-api-key": "sk-quelconque" })).toBeNull();
  });

  it("retient un Bearer nak_ mal formé (il sera refusé, jamais retenté comme JWT)", () => {
    expect(extractApiKey({ authorization: "Bearer nak_court" })).toBe("nak_court");
    expect(isApiKeyFormat("nak_court")).toBe(false);
  });

  it("ne confond pas un autre schéma d'authentification", () => {
    expect(extractApiKey({ authorization: `Basic ${secret}` })).toBeNull();
  });
});

describe("evaluateApiKey", () => {
  it("accepte une clé active d'un admin et relit ses rôles", () => {
    const result = evaluateApiKey(row(), NOW);
    expect(result).toEqual({
      ok: true,
      identity: {
        apiKeyId: "key-1",
        name: "Recette prod",
        keyPrefix: "nak_Ab12Cd34",
        scope: "read",
        userId: "admin-1",
        roles: ["admin"],
      },
    });
  });

  it("lit les rôles sérialisés du miroir sqlite", () => {
    const result = evaluateApiKey(
      row({ user: { ...row().user!, roles: '["user","admin"]' } }),
      NOW,
    );
    expect(result.ok && result.identity.roles).toEqual(["user", "admin"]);
  });

  it.each([
    ["unknown", null],
    ["revoked", row({ revokedAt: new Date("2026-10-01") })],
    ["expired", row({ expiresAt: NOW })],
    ["owner-missing", row({ user: null })],
    ["owner-deleted", row({ user: { ...row().user!, deletedAt: new Date("2026-09-01") } })],
    ["owner-banned", row({ user: { ...row().user!, bannedUntil: new Date("2026-12-01") } })],
    ["owner-disabled", row({ user: { ...row().user!, valid: false } })],
    ["owner-not-admin", row({ user: { ...row().user!, role: "user", roles: ["user"] } })],
  ] as const)("refuse : %s", (reason, candidate) => {
    expect(evaluateApiKey(candidate, NOW)).toEqual({ ok: false, reason });
  });

  it("accepte une clé dont l'expiration est future et un bannissement échu", () => {
    const result = evaluateApiKey(
      row({
        expiresAt: new Date(NOW.getTime() + 1000),
        user: { ...row().user!, bannedUntil: new Date("2026-01-01") },
      }),
      NOW,
    );
    expect(result.ok).toBe(true);
  });

  it("suit les rôles comme la connexion : `roles` prime sur `role`", () => {
    const result = evaluateApiKey(
      row({ user: { ...row().user!, role: "admin", roles: ["user"] } }),
      NOW,
    );
    expect(result).toEqual({ ok: false, reason: "owner-not-admin" });
  });
});

describe("portée", () => {
  it("une portée inconnue se lit en lecture seule", () => {
    expect(parseApiKeyScope("write")).toBe("write");
    expect(parseApiKeyScope("read")).toBe("read");
    expect(parseApiKeyScope("admin")).toBe("read");
    expect(parseApiKeyScope(null)).toBe("read");
  });

  it("read n'autorise que GET, HEAD et OPTIONS", () => {
    for (const m of ["GET", "head", "OPTIONS"]) {
      expect(isMethodAllowedForScope("read", m)).toBe(true);
    }
    for (const m of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(isMethodAllowedForScope("read", m)).toBe(false);
    }
  });

  it("write autorise tout", () => {
    for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      expect(isMethodAllowedForScope("write", m)).toBe(true);
    }
  });
});

describe("expiration et dernier usage", () => {
  it("calcule l'échéance en jours, null = sans expiration", () => {
    expect(computeApiKeyExpiry(NOW, 90)?.toISOString()).toBe("2027-01-09T12:00:00.000Z");
    expect(computeApiKeyExpiry(NOW, null)).toBeNull();
  });

  it("n'écrit le dernier usage qu'une fois par fenêtre", () => {
    expect(shouldTouchLastUsed(null, NOW)).toBe(true);
    expect(shouldTouchLastUsed(new Date(NOW.getTime() - 10_000), NOW)).toBe(false);
    expect(
      shouldTouchLastUsed(new Date(NOW.getTime() - API_KEY_LAST_USED_WINDOW_MS), NOW),
    ).toBe(true);
  });

  it("dérive le statut affiché", () => {
    expect(apiKeyStatus({ revokedAt: null, expiresAt: null }, NOW)).toBe("active");
    expect(apiKeyStatus({ revokedAt: null, expiresAt: NOW }, NOW)).toBe("expired");
    expect(apiKeyStatus({ revokedAt: NOW, expiresAt: null }, NOW)).toBe("revoked");
  });
});
