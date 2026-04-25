import { describe, it, expect, beforeEach } from "vitest";
import { rawGet, rawPost, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec validations Zod sur /friends/* — O.4 expansion E2E.
 *
 * `friends.spec.ts` couvre auth gates et happy path (envoi/reponse/
 * suppression). Ce spec verifie en plus que les schemas Zod
 * (cf. apps/server/src/schemas/friendship.schemas.ts) rejettent
 * bien les payloads invalides en E2E :
 *
 *  - sendFriendRequestSchema       (receiverId requis)
 *  - respondFriendRequestSchema    (action enum)
 *  - listFriendshipsQuerySchema    (status enum optionnel)
 *
 * Le `validate` middleware fire AVANT toute lecture Prisma, donc on
 * peut tester sans creer de friendship en base.
 */

const FRIENDSHIP_ID = "fictional-friendship-id";

describe("E2E API — /friends/* validations Zod (post-auth)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("POST /friends (sendFriendRequestSchema)", () => {
    it("body vide -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@fv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/friends", token, {});
      expect(res.status).toBe(400);
    });

    it("receiverId vide -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@fv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/friends", token, { receiverId: "" });
      expect(res.status).toBe(400);
    });

    it("receiverId numerique au lieu de string -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@fv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost("/friends", token, { receiverId: 42 });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /friends/:id/respond (respondFriendRequestSchema)", () => {
    it("body vide -> 400 (action requis)", async () => {
      const { token } = await seedAndLogin(
        "alice@fv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(
        `/friends/${FRIENDSHIP_ID}/respond`,
        token,
        {},
      );
      expect(res.status).toBe(400);
    });

    it("action invalide (= 'maybe') -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@fv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(
        `/friends/${FRIENDSHIP_ID}/respond`,
        token,
        { action: "maybe" },
      );
      expect(res.status).toBe(400);
    });

    it("action vide -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@fv.test",
        "pwd",
        "Alice",
      );
      const res = await rawPost(
        `/friends/${FRIENDSHIP_ID}/respond`,
        token,
        { action: "" },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("GET /friends?status=... (listFriendshipsQuerySchema)", () => {
    it("status invalide (= 'maybe') -> 400", async () => {
      const { token } = await seedAndLogin(
        "alice@fv.test",
        "pwd",
        "Alice",
      );
      const res = await rawGet("/friends?status=maybe", token);
      expect(res.status).toBe(400);
    });

    it("status='pending' valide -> 200 (statut autorise)", async () => {
      const { token } = await seedAndLogin(
        "alice@fv.test",
        "pwd",
        "Alice",
      );
      const res = await rawGet("/friends?status=pending", token);
      expect(res.status).toBe(200);
    });

    it("status='accepted' valide -> 200", async () => {
      const { token } = await seedAndLogin(
        "alice@fv.test",
        "pwd",
        "Alice",
      );
      const res = await rawGet("/friends?status=accepted", token);
      expect(res.status).toBe(200);
    });

    it("status='blocked' valide -> 200", async () => {
      const { token } = await seedAndLogin(
        "alice@fv.test",
        "pwd",
        "Alice",
      );
      const res = await rawGet("/friends?status=blocked", token);
      expect(res.status).toBe(200);
    });

    it("sans status -> 200 (status optionnel)", async () => {
      const { token } = await seedAndLogin(
        "alice@fv.test",
        "pwd",
        "Alice",
      );
      const res = await rawGet("/friends", token);
      expect(res.status).toBe(200);
    });
  });
});
