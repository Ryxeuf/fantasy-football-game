import { describe, it, expect, beforeEach } from "vitest";
import {
  get,
  post,
  rawGet,
  rawPost,
  rawDelete,
  resetDb,
} from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec /friends/* (O.4 expansion E2E).
 *
 * Les routes `/friends/*` implementent le systeme d'amis (Sprint 16
 * N.5) : envoyer une demande, accepter/refuser, lister ses relations,
 * supprimer une relation. Toutes les routes exigent un token JWT.
 *
 * Ce spec couvre :
 *
 *  - Auth gates : chaque endpoint sans token -> 401
 *  - Happy path complet :
 *      A -> B: sendRequest (POST /friends) renvoie 201 + friendship
 *              en status pending
 *      B: voit la demande recue (GET /friends avec token B)
 *      B: accepte (POST /friends/:id/respond {action: "accept"})
 *      A et B: voient la relation en status "accepted"
 *      A: supprime la relation (DELETE /friends/:id) -> 200
 *      A: la relation n'apparait plus dans GET /friends
 *
 *  - Validation : POST /friends sans receiverId -> 400
 *
 * Les tests reposent sur le model `Friendship` present dans le
 * schema sqlite e2e-api.
 */

interface FriendshipEntity {
  id: string;
  requesterId: string;
  receiverId: string;
  status: "pending" | "accepted" | "declined" | "blocked";
}

interface FriendshipResponse {
  success: boolean;
  data: FriendshipEntity;
  error?: string;
}

interface FriendshipListResponse {
  success: boolean;
  data: FriendshipEntity[];
  error?: string;
}

describe("E2E API — /friends/*", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("auth gates", () => {
    it("GET /friends sans token -> 401", async () => {
      const res = await rawGet("/friends", null);
      expect(res.status).toBe(401);
    });

    it("POST /friends sans token -> 401", async () => {
      const res = await rawPost("/friends", null, { receiverId: "x" });
      expect(res.status).toBe(401);
    });

    it("POST /friends/:id/respond sans token -> 401", async () => {
      const res = await rawPost("/friends/dummy-id/respond", null, {
        action: "accept",
      });
      expect(res.status).toBe(401);
    });
  });

  describe("happy path : envoi, acceptation, liste, suppression", () => {
    it("flow complet A->B->accept->delete", async () => {
      const alice = await seedAndLogin(
        "alice-friends@e2e.test",
        "password-a",
        "Alice",
      );
      const bob = await seedAndLogin(
        "bob-friends@e2e.test",
        "password-b",
        "Bob",
      );

      // Alice -> Bob : envoi de la demande.
      const sent = await post<FriendshipResponse>(
        "/friends",
        alice.token,
        { receiverId: bob.userId },
      );
      expect(sent.success).toBe(true);
      expect(sent.data.requesterId).toBe(alice.userId);
      expect(sent.data.receiverId).toBe(bob.userId);
      expect(sent.data.status).toBe("pending");

      // Bob voit la demande dans sa liste.
      const bobList = await get<FriendshipListResponse>(
        "/friends",
        bob.token,
      );
      expect(bobList.success).toBe(true);
      const bobsView = bobList.data.find((f) => f.id === sent.data.id);
      expect(bobsView).toBeDefined();
      expect(bobsView!.status).toBe("pending");

      // Bob accepte.
      const accepted = await post<FriendshipResponse>(
        `/friends/${sent.data.id}/respond`,
        bob.token,
        { action: "accept" },
      );
      expect(accepted.success).toBe(true);
      expect(accepted.data.status).toBe("accepted");

      // Alice voit aussi la relation acceptee.
      const aliceList = await get<FriendshipListResponse>(
        "/friends",
        alice.token,
      );
      const aliceView = aliceList.data.find((f) => f.id === sent.data.id);
      expect(aliceView).toBeDefined();
      expect(aliceView!.status).toBe("accepted");

      // Alice supprime la relation.
      const removedRes = await rawDelete(
        `/friends/${sent.data.id}`,
        alice.token,
      );
      expect(removedRes.status).toBe(200);
      const removed = (await removedRes.json()) as { success: boolean };
      expect(removed.success).toBe(true);

      // Alice ne voit plus la relation.
      const aliceAfter = await get<FriendshipListResponse>(
        "/friends",
        alice.token,
      );
      const goneForAlice = aliceAfter.data.find(
        (f) => f.id === sent.data.id,
      );
      expect(goneForAlice).toBeUndefined();
    });
  });

  describe("validation", () => {
    it("POST /friends sans receiverId -> 400", async () => {
      const alice = await seedAndLogin(
        "alice-validation@e2e.test",
        "password-v",
        "AliceV",
      );
      const res = await rawPost("/friends", alice.token, {});
      expect(res.status).toBe(400);
    });

    it("GET /friends pour user sans amis -> data: []", async () => {
      const solo = await seedAndLogin(
        "solo@e2e.test",
        "password-s",
        "Solo",
      );
      const list = await get<FriendshipListResponse>("/friends", solo.token);
      expect(list.success).toBe(true);
      expect(Array.isArray(list.data)).toBe(true);
      expect(list.data.length).toBe(0);
    });
  });
});
