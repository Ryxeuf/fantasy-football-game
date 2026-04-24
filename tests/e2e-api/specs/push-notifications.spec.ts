import { describe, it, expect, beforeEach } from "vitest";
import { rawGet, rawPost, resetDb } from "../helpers/api";

/**
 * Spec /push/* (routes push notifications, O.4 expansion E2E).
 *
 * Les routes `/push/*` exposent l'abonnement aux push notifications
 * (web-push + Expo). Ce spec valide :
 *
 *  - `GET /push/vapid-public-key` (no-auth, public) retourne une cle
 *    VAPID valide. Le serveur genere des cles dev si les env vars
 *    VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ne sont pas fournies (cas
 *    du test runner) — on verifie donc juste que la route renvoie
 *    200 + une cle non vide.
 *
 *  - Les endpoints avec `authUser` (POST /push/subscribe,
 *    POST /push/unsubscribe, GET /push/preferences, POST
 *    /push/expo-subscribe, etc.) refusent un appel sans token (401).
 *    Ces tests 401 ne touchent pas la DB — ils verifient que le
 *    middleware `authUser` rejette les appels anonymes sur les
 *    routes sensibles.
 *
 * Aucune de ces assertions ne depend du model `NotificationPreference`
 * (absent du schema sqlite e2e-api), ce qui garde le spec stable dans
 * l'environnement test in-memory.
 */

interface VapidKeyResponse {
  key: string;
}

describe("E2E API — /push/* (notifications)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("GET /push/vapid-public-key renvoie 200 + `{ key }` sans auth", async () => {
    const res = await rawGet("/push/vapid-public-key", null);
    expect(res.status).toBe(200);
    const json = (await res.json()) as VapidKeyResponse;
    expect(json).toHaveProperty("key");
    expect(typeof json.key).toBe("string");
    // Les cles VAPID sont des P-256 base64url-encoded ~87 chars. Dev
    // keys auto-generees sont toujours non-vides.
    expect(json.key.length).toBeGreaterThan(20);
  });

  it("POST /push/subscribe sans token -> 401", async () => {
    const res = await rawPost("/push/subscribe", null, {
      endpoint: "https://example.com/push/endpoint",
      keys: { p256dh: "dummy", auth: "dummy" },
    });
    expect(res.status).toBe(401);
  });

  it("POST /push/unsubscribe sans token -> 401", async () => {
    const res = await rawPost("/push/unsubscribe", null, {
      endpoint: "https://example.com/push/endpoint",
    });
    expect(res.status).toBe(401);
  });

  it("GET /push/preferences sans token -> 401", async () => {
    const res = await rawGet("/push/preferences", null);
    expect(res.status).toBe(401);
  });

  it("POST /push/expo-subscribe sans token -> 401", async () => {
    const res = await rawPost("/push/expo-subscribe", null, {
      token: "ExponentPushToken[dummy]",
      platform: "ios",
    });
    expect(res.status).toBe(401);
  });

  it("POST /push/expo-unsubscribe sans token -> 401", async () => {
    const res = await rawPost("/push/expo-unsubscribe", null, {
      token: "ExponentPushToken[dummy]",
    });
    expect(res.status).toBe(401);
  });

  it("GET /push/vapid-public-key est idempotent (2 appels renvoient meme cle)", async () => {
    const first = (await (await rawGet("/push/vapid-public-key", null)).json()) as VapidKeyResponse;
    const second = (await (await rawGet("/push/vapid-public-key", null)).json()) as VapidKeyResponse;
    // Les dev keys generees au boot sont memoizees module-level, donc
    // stables durant la vie du serveur.
    expect(second.key).toBe(first.key);
  });
});
