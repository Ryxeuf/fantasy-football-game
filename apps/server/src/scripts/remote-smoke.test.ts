import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_API_URL,
  formatReport,
  hasFailure,
  normalizeBaseUrl,
  redact,
  runSmoke,
  SMOKE_CHECKS,
  validateIdentity,
  type SmokeCheck,
} from "./remote-smoke";

const SECRET = `nak_${"s".repeat(43)}`;

function response(status: number, body: unknown) {
  return {
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

const ME = {
  user: {
    id: "admin-1",
    roles: ["admin"],
    apiKey: { name: "Claude Code", keyPrefix: "nak_ssssssss", scope: "read" },
  },
};

/** Serveur sain : réponses attendues de chaque vérification. */
function healthyFetch() {
  return vi.fn(async (url: string, init: { method: string }) => {
    if (url.endsWith("/auth/me")) return response(200, ME);
    if (init.method === "POST") return response(403, { code: "api_key_read_only" });
    return response(200, { ok: true });
  });
}

describe("runSmoke", () => {
  it("serveur sain : tout passe, la clé est envoyée en Bearer sur les seules vérifications authentifiées", async () => {
    const fetchImpl = healthyFetch();
    const results = await runSmoke({
      baseUrl: "https://api.example.test",
      apiKey: SECRET,
      fetchImpl,
    });

    expect(results).toHaveLength(SMOKE_CHECKS.length);
    expect(results.every((r) => r.outcome === "pass")).toBe(true);
    expect(hasFailure(results)).toBe(false);

    for (const [url, init] of fetchImpl.mock.calls as unknown as Array<
      [string, { headers: Record<string, string> }]
    >) {
      const check = SMOKE_CHECKS.find((c) => url.endsWith(c.path))!;
      if (check.auth === "key") expect(init.headers.Authorization).toBe(`Bearer ${SECRET}`);
      else expect(init.headers.Authorization).toBeUndefined();
    }
  });

  it("n'emploie que des GET, sauf le garde-fou qui doit être refusé", () => {
    const writes = SMOKE_CHECKS.filter((c) => c.method !== "GET");
    expect(writes).toEqual([
      expect.objectContaining({ path: "/admin/api-keys", expectStatus: 403 }),
    ]);
  });

  it("un statut inattendu est un échec, et le rapport ne contient jamais le secret", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith("/admin/stats")
        ? response(500, { error: `boom ${SECRET}` })
        : url.endsWith("/auth/me")
          ? response(200, ME)
          : response(url.endsWith("/admin/api-keys") ? 403 : 200, {}),
    );
    const results = await runSmoke({ baseUrl: "https://x.test", apiKey: SECRET, fetchImpl });
    const stats = results.find((r) => r.path === "/admin/stats")!;
    expect(stats.outcome).toBe("fail");
    expect(stats.detail).toContain("HTTP 500 au lieu de 200");
    expect(hasFailure(results)).toBe(true);

    const report = formatReport(results, { baseUrl: "https://x.test", hasKey: true });
    expect(report).not.toContain(SECRET);
    expect(report).toContain("nak_***");
    expect(report).toContain("1 échec(s)");
  });

  it("sans clé : les vérifications authentifiées sont ignorées sur 401, les publiques jouées", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const check = SMOKE_CHECKS.find((c) => url.endsWith(c.path))!;
      return check.auth === "key" ? response(401, { error: "Non authentifié" }) : response(200, {});
    });
    const results = await runSmoke({ baseUrl: "https://x.test", apiKey: null, fetchImpl });
    for (const r of results) {
      const check = SMOKE_CHECKS.find((c) => c.path === r.path)!;
      expect(r.outcome).toBe(check.auth === "key" ? "skip" : "pass");
    }
    expect(hasFailure(results)).toBe(false);
  });

  it("une erreur réseau est un échec sans HTTP", async () => {
    const check: SmokeCheck = { name: "x", method: "GET", path: "/health", auth: "none", expectStatus: 200 };
    const results = await runSmoke({
      baseUrl: "https://x.test",
      apiKey: SECRET,
      checks: [check],
      fetchImpl: vi.fn(async () => {
        throw new Error(`connect ECONNREFUSED (${SECRET})`);
      }),
    });
    expect(results[0]).toMatchObject({ outcome: "fail", httpStatus: null });
    expect(results[0].detail).not.toContain(SECRET);
  });
});

describe("validateIdentity", () => {
  it("exige un admin authentifié par clé", () => {
    expect(validateIdentity(ME)).toBeNull();
    expect(validateIdentity({})).toMatch(/sans `user`/);
    expect(validateIdentity({ user: { roles: ["user"], apiKey: {} } })).toMatch(/pas admin/);
    expect(validateIdentity({ user: { roles: ["admin"], apiKey: null } })).toMatch(/non reconnue/);
  });
});

describe("utilitaires", () => {
  it("normalise l'URL de base", () => {
    expect(normalizeBaseUrl(undefined)).toBe(DEFAULT_API_URL);
    expect(normalizeBaseUrl("  ")).toBe(DEFAULT_API_URL);
    expect(normalizeBaseUrl("https://api.example.test//")).toBe("https://api.example.test");
    expect(normalizeBaseUrl("https://example.test/api/")).toBe("https://example.test/api");
    expect(normalizeBaseUrl("http://localhost:18002")).toBe("http://localhost:18002");
    expect(normalizeBaseUrl("http://127.0.0.1:8201/")).toBe("http://127.0.0.1:8201");
  });

  it("refuse une URL qui enverrait la clé en clair ou à un tiers", () => {
    expect(() => normalizeBaseUrl("http://api.example.test")).toThrow(/https/);
    expect(() => normalizeBaseUrl("ftp://api.example.test")).toThrow(/https/);
    expect(() => normalizeBaseUrl("https://user:pass@api.example.test")).toThrow(/identifiants/);
    expect(() => normalizeBaseUrl("pas une url")).toThrow(/invalide/);
  });

  it("masque le secret, et rien sans secret", () => {
    expect(redact(`a ${SECRET} b ${SECRET}`, SECRET)).toBe("a nak_*** b nak_***");
    expect(redact("rien", null)).toBe("rien");
  });
});
