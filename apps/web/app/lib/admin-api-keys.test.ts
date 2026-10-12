import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api-client", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "./api-client";
import {
  adminCreateApiKey,
  adminListApiKeys,
  adminRevokeApiKey,
  apiKeyEnvSnippet,
  apiKeyExpiryLabel,
  apiKeyLastUsedLabel,
  apiKeyScopeLabel,
  apiKeyStatusLabel,
  API_KEY_EXPIRY_OPTIONS,
  DEFAULT_API_KEY_EXPIRY_DAYS,
  expiryOptionValue,
  parseExpiryOption,
} from "./admin-api-keys";

const api = apiRequest as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("wrappers admin des clés API", () => {
  it("liste : déballe { keys }", async () => {
    api.mockResolvedValueOnce({ keys: [{ id: "k1" }] });
    expect(await adminListApiKeys()).toEqual([{ id: "k1" }]);
    expect(api).toHaveBeenLastCalledWith("/admin/api-keys");
  });

  it("création : POST du corps tel quel", async () => {
    api.mockResolvedValueOnce({ key: { id: "k1" }, secret: "nak_x" });
    await adminCreateApiKey({ name: "CI", scope: "read", expiresInDays: null });
    expect(api).toHaveBeenLastCalledWith("/admin/api-keys", {
      method: "POST",
      body: JSON.stringify({ name: "CI", scope: "read", expiresInDays: null }),
    });
  });

  it("révocation : id échappé", async () => {
    api.mockResolvedValueOnce({});
    await adminRevokeApiKey("a b");
    expect(api).toHaveBeenLastCalledWith("/admin/api-keys/a%20b/revoke", { method: "POST" });
  });
});

describe("libellés", () => {
  it("portée et statut", () => {
    expect(apiKeyScopeLabel("read")).toBe("Lecture seule");
    expect(apiKeyScopeLabel("write")).toBe("Lecture et écriture");
    expect(apiKeyStatusLabel("active")).toBe("Active");
    expect(apiKeyStatusLabel("revoked")).toBe("Révoquée");
    expect(apiKeyStatusLabel("expired")).toBe("Expirée");
  });

  it("expiration", () => {
    expect(apiKeyExpiryLabel({ expiresAt: null, status: "active" })).toBe("Sans expiration");
    expect(apiKeyExpiryLabel({ expiresAt: "2027-01-09T12:00:00.000Z", status: "active" })).toMatch(
      /^Expire le 9 janv\.? 2027$/,
    );
    expect(apiKeyExpiryLabel({ expiresAt: "2026-01-09T12:00:00.000Z", status: "expired" })).toMatch(
      /^Expirée le /,
    );
  });

  it("dernier usage", () => {
    expect(apiKeyLastUsedLabel({ lastUsedAt: null, lastUsedIp: null })).toBe("Jamais utilisée");
    expect(
      apiKeyLastUsedLabel({ lastUsedAt: "2026-10-11T12:00:00.000Z", lastUsedIp: "203.0.113.7" }),
    ).toMatch(/2026.*\(203\.0\.113\.7\)$/);
  });

  it("options d'expiration : 90 jours présents, aller-retour de valeur", () => {
    expect(API_KEY_EXPIRY_OPTIONS.map((o) => o.value)).toContain(DEFAULT_API_KEY_EXPIRY_DAYS);
    for (const option of API_KEY_EXPIRY_OPTIONS) {
      expect(parseExpiryOption(expiryOptionValue(option.value))).toBe(option.value);
    }
    expect(parseExpiryOption("n'importe quoi")).toBe(DEFAULT_API_KEY_EXPIRY_DAYS);
  });

  it("variables d'environnement à déclarer", () => {
    expect(apiKeyEnvSnippet("https://api.nufflearena.fr/", "nak_abc")).toBe(
      "NUFFLE_API_URL=https://api.nufflearena.fr\nNUFFLE_API_KEY=nak_abc",
    );
  });
});
