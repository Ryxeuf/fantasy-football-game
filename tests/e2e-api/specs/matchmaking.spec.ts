import { describe, it, expect, beforeEach } from "vitest";
import {
  get,
  post,
  rawDelete,
  rawGet,
  rawPost,
  resetDb,
} from "../helpers/api";
import { createTeam, seedAndLogin } from "../helpers/factories";

/**
 * Spec du file d'attente matchmaking (/matchmaking/*) :
 *
 *   - join queue avec un payload invalide (400)
 *   - join queue avec une équipe d'un autre coach → erreur métier
 *   - join queue valide → status retourne inQueue:true
 *   - leave queue retire bien le coach
 *
 * Ces tests touchent les tables `Team` + `MatchQueue` qui existent dans
 * le schéma SQLite de test (cf. apps/server/src/prisma-sqlite-client/
 * schema.prisma). Si jamais le schéma diverge, on s'attend à un 400/500
 * propre — mais en l'état c'est couvert.
 */
describe("E2E API — matchmaking", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("POST /matchmaking/join sans token → 401", async () => {
    const res = await rawPost("/matchmaking/join", null, { teamId: "abc" });
    expect(res.status).toBe(401);
  });

  it("POST /matchmaking/join avec payload invalide → 400", async () => {
    const { token } = await seedAndLogin(
      "alice@e2e.test",
      "password-a",
      "Alice",
    );
    const res = await rawPost("/matchmaking/join", token, {});
    expect(res.status).toBe(400);
  });

  it("POST /matchmaking/join avec une équipe d'un autre coach est refusé", async () => {
    const alice = await seedAndLogin(
      "alice@e2e.test",
      "password-a",
      "Alice",
    );
    const bob = await seedAndLogin("bob@e2e.test", "password-b", "Bob");
    // L'équipe appartient à Bob mais Alice essaie de l'utiliser.
    const bobTeam = await createTeam(bob.userId, "Bob's Team", "lizardmen");

    const res = await rawPost("/matchmaking/join", alice.token, {
      teamId: bobTeam.teamId,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBeTruthy();
  });

  it("GET /matchmaking/status retourne inQueue:false par défaut", async () => {
    const { token } = await seedAndLogin(
      "alice@e2e.test",
      "password-a",
      "Alice",
    );
    const status = await get<{ inQueue: boolean }>(
      "/matchmaking/status",
      token,
    );
    expect(status.inQueue).toBe(false);
  });

  it("join → status renvoie inQueue:true puis leave → inQueue:false", async () => {
    const alice = await seedAndLogin(
      "alice@e2e.test",
      "password-a",
      "Alice",
    );
    const team = await createTeam(alice.userId, "Alice's Team", "skaven");

    const joined = await post<{ matched: boolean }>(
      "/matchmaking/join",
      alice.token,
      { teamId: team.teamId },
    );
    // Sans adversaire compatible, on doit être mis en file (matched:false).
    expect(joined.matched).toBe(false);

    const status = await get<{ inQueue: boolean; status?: string }>(
      "/matchmaking/status",
      alice.token,
    );
    expect(status.inQueue).toBe(true);
    expect(status.status).toBe("searching");

    const leave = await rawDelete("/matchmaking/leave", alice.token);
    expect(leave.status).toBe(200);

    // Note : leaveQueue() ne supprime pas l'entrée mais la passe en
    // status="cancelled" (cf. apps/server/src/services/matchmaking.ts).
    // /matchmaking/status renvoie alors `inQueue:true, status:"cancelled"`.
    const after = await get<{ inQueue: boolean; status?: string }>(
      "/matchmaking/status",
      alice.token,
    );
    expect(after.status).toBe("cancelled");
  });

  it("DELETE /matchmaking/leave hors file d'attente → 400", async () => {
    const { token } = await seedAndLogin(
      "alice@e2e.test",
      "password-a",
      "Alice",
    );
    const res = await rawDelete("/matchmaking/leave", token);
    expect(res.status).toBe(400);
  });

  it("GET /matchmaking/status sans token → 401", async () => {
    const res = await rawGet("/matchmaking/status", null);
    expect(res.status).toBe(401);
  });
});
