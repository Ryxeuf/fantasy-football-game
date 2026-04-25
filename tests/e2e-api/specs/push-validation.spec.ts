import { describe, it, expect, beforeEach } from "vitest";
import { rawPost, rawPut, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec validations Zod sur /push/* — O.4 expansion E2E.
 *
 * `push-notifications.spec.ts` couvre auth gates et VAPID key.
 * Ce spec verifie en plus que les schemas Zod
 * (cf. apps/server/src/schemas/push.schemas.ts) rejettent les
 * payloads invalides en E2E une fois auth franchie.
 *
 * Schemas couverts :
 *  - pushSubscribeSchema       (endpoint URL + keys.p256dh + keys.auth)
 *  - pushUnsubscribeSchema     (endpoint URL)
 *  - pushPreferencesSchema     (booleans optionnels)
 *  - expoPushSubscribeSchema   (token regex + platform enum)
 *  - expoPushUnsubscribeSchema (token regex)
 */

describe("E2E API — /push/* validations Zod (post-auth)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("POST /push/subscribe (pushSubscribeSchema)", () => {
    it("endpoint absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@pv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/push/subscribe", token, {
        keys: { p256dh: "x", auth: "y" },
      });
      expect(res.status).toBe(400);
    });

    it("endpoint non-URL -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@pv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/push/subscribe", token, {
        endpoint: "not-a-url",
        keys: { p256dh: "x", auth: "y" },
      });
      expect(res.status).toBe(400);
    });

    it("keys.p256dh vide -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@pv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/push/subscribe", token, {
        endpoint: "https://example.com/push/x",
        keys: { p256dh: "", auth: "y" },
      });
      expect(res.status).toBe(400);
    });

    it("keys.auth absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@pv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/push/subscribe", token, {
        endpoint: "https://example.com/push/x",
        keys: { p256dh: "x" },
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /push/unsubscribe (pushUnsubscribeSchema)", () => {
    it("endpoint absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@pv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/push/unsubscribe", token, {});
      expect(res.status).toBe(400);
    });

    it("endpoint non-URL -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@pv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/push/unsubscribe", token, {
        endpoint: "not-a-url",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /push/preferences (pushPreferencesSchema)", () => {
    it("pushEnabled non-bool -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@pv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPut("/push/preferences", token, {
        pushEnabled: "yes",
      });
      expect(res.status).toBe(400);
    });

    it("turnNotification non-bool (string) -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@pv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPut("/push/preferences", token, {
        turnNotification: "true",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /push/expo-subscribe (expoPushSubscribeSchema)", () => {
    it("token absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@pv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/push/expo-subscribe", token, {
        platform: "ios",
      });
      expect(res.status).toBe(400);
    });

    it("token au mauvais format (sans crochets) -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@pv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/push/expo-subscribe", token, {
        token: "ExponentPushTokenABCD",
        platform: "ios",
      });
      expect(res.status).toBe(400);
    });

    it("platform invalide (= 'windows') -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@pv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/push/expo-subscribe", token, {
        token: "ExponentPushToken[abc]",
        platform: "windows",
      });
      expect(res.status).toBe(400);
    });

    it("token avec format ExpoPushToken (alias) accepte -> pas 400 Zod", async () => {
      const { token } = await seedAndLogin(
        "alice@pv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/push/expo-subscribe", token, {
        token: "ExpoPushToken[abc]",
        platform: "android",
      });
      // Si la validation passe, on attend 200 ou 5xx (le store en
      // memoire pourrait echouer en SQLite). Le but est juste de
      // verifier qu'on ne tombe pas sur une 400 Zod.
      expect(res.status).not.toBe(400);
    });
  });

  describe("POST /push/expo-unsubscribe (expoPushUnsubscribeSchema)", () => {
    it("token absent -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@pv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/push/expo-unsubscribe", token, {});
      expect(res.status).toBe(400);
    });

    it("token au mauvais format -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@pv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/push/expo-unsubscribe", token, {
        token: "random-string",
      });
      expect(res.status).toBe(400);
    });
  });
});
