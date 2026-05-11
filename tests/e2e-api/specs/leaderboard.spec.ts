import { describe, it, expect, beforeEach } from "vitest";
import { get, post, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  coachName: string | null;
  eloRating: number;
}

interface LeaderboardResponse {
  success: boolean;
  data: LeaderboardEntry[];
  meta: { total: number; limit: number; offset: number };
}

/**
 * Spec /leaderboard : route publique (pas d'auth) qui renvoie le top
 * coachs par ELO. On valide :
 *
 *  - le contrat de réponse (success / data / meta)
 *  - la pagination via ?limit et ?offset
 *  - le tri descendant par eloRating
 *  - le filtrage : profils non validés, comptes IA, coachs masqués
 *    par un admin (`leaderboardStatus = "hidden_admin"`), et coachs
 *    sans match ranked (pas d'`EloSnapshot`) sont exclus.
 */
describe("E2E API — /leaderboard", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("retourne un envelope standard {success, data, meta}", async () => {
    // Crée 3 coachs avec au moins 1 match ranked chacun pour qu'ils
    // apparaissent dans le classement (le serveur filtre sur
    // `eloSnapshots: { some: {} }`).
    await Promise.all([
      seedAndLogin("alice@e2e.test", "password-a", "Alice", { rankedMatches: 1 }),
      seedAndLogin("bob@e2e.test", "password-b", "Bob", { rankedMatches: 1 }),
      seedAndLogin("carol@e2e.test", "password-c", "Carol", { rankedMatches: 1 }),
    ]);

    const res = await get<LeaderboardResponse>("/leaderboard", null);

    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.meta).toBeDefined();
    expect(typeof res.meta.total).toBe("number");
    expect(res.meta.total).toBeGreaterThanOrEqual(3);
    expect(res.meta.limit).toBe(50);
    expect(res.meta.offset).toBe(0);
  });

  it("respecte le paramètre ?limit", async () => {
    await Promise.all([
      seedAndLogin("alice@e2e.test", "password-a", "Alice", { rankedMatches: 1 }),
      seedAndLogin("bob@e2e.test", "password-b", "Bob", { rankedMatches: 1 }),
      seedAndLogin("carol@e2e.test", "password-c", "Carol", { rankedMatches: 1 }),
    ]);

    const res = await get<LeaderboardResponse>("/leaderboard?limit=2", null);
    expect(res.data.length).toBeLessThanOrEqual(2);
    expect(res.meta.limit).toBe(2);
  });

  it("retourne les coachs triés par eloRating décroissant", async () => {
    await Promise.all([
      seedAndLogin("alice@e2e.test", "password-a", "Alice", { rankedMatches: 1 }),
      seedAndLogin("bob@e2e.test", "password-b", "Bob", { rankedMatches: 1 }),
    ]);

    const res = await get<LeaderboardResponse>("/leaderboard", null);
    for (let i = 1; i < res.data.length; i++) {
      expect(res.data[i].eloRating).toBeLessThanOrEqual(
        res.data[i - 1].eloRating,
      );
    }
    // Le rang doit être 1, 2, 3, ... (pagination décalée par offset).
    res.data.forEach((entry, idx) => {
      expect(entry.rank).toBe(idx + 1);
    });
  });

  it("supporte ?offset pour la pagination", async () => {
    await Promise.all([
      seedAndLogin("alice@e2e.test", "password-a", "Alice", { rankedMatches: 1 }),
      seedAndLogin("bob@e2e.test", "password-b", "Bob", { rankedMatches: 1 }),
      seedAndLogin("carol@e2e.test", "password-c", "Carol", { rankedMatches: 1 }),
    ]);

    const res = await get<LeaderboardResponse>("/leaderboard?offset=1", null);
    expect(res.meta.offset).toBe(1);
    if (res.data.length > 0) {
      expect(res.data[0].rank).toBe(2);
    }
  });

  it("exclut les profils non validés et les comptes IA du classement", async () => {
    // Seed direct (sans login car `valid=false` bloque l'authentification).
    await Promise.all([
      post("/__test/seed-user", null, {
        email: "valid@e2e.test",
        password: "password",
        name: "ValidCoach",
        rankedMatches: 1,
      }),
      post("/__test/seed-user", null, {
        email: "pending@e2e.test",
        password: "password",
        name: "PendingCoach",
        valid: false,
        rankedMatches: 1,
      }),
      post("/__test/seed-user", null, {
        email: "ai@e2e.test",
        password: "password",
        name: "AiCoach",
        role: "ai",
        rankedMatches: 1,
      }),
    ]);

    const res = await get<LeaderboardResponse>("/leaderboard", null);
    const names = res.data.map((e) => e.coachName);
    expect(names).toContain("ValidCoach");
    expect(names).not.toContain("PendingCoach");
    expect(names).not.toContain("AiCoach");
    // `meta.total` reflète aussi les filtres pour garder la pagination
    // cohérente côté client.
    expect(res.meta.total).toBe(names.length);
  });

  it("exclut les coachs sans match ranked (pas d'EloSnapshot)", async () => {
    await Promise.all([
      // Coach actif (1 snapshot).
      post("/__test/seed-user", null, {
        email: "active@e2e.test",
        password: "password",
        name: "ActiveCoach",
        rankedMatches: 1,
      }),
      // Coach inactif (0 snapshot) — ne doit pas apparaitre.
      post("/__test/seed-user", null, {
        email: "fresh@e2e.test",
        password: "password",
        name: "FreshCoach",
      }),
    ]);

    const res = await get<LeaderboardResponse>("/leaderboard", null);
    const names = res.data.map((e) => e.coachName);
    expect(names).toContain("ActiveCoach");
    expect(names).not.toContain("FreshCoach");
  });

  it("exclut les coachs masques par un admin (leaderboardStatus = hidden_admin)", async () => {
    await Promise.all([
      post("/__test/seed-user", null, {
        email: "shown@e2e.test",
        password: "password",
        name: "ShownCoach",
        rankedMatches: 1,
      }),
      post("/__test/seed-user", null, {
        email: "hidden@e2e.test",
        password: "password",
        name: "HiddenCoach",
        rankedMatches: 1,
        leaderboardStatus: "hidden_admin",
      }),
    ]);

    const res = await get<LeaderboardResponse>("/leaderboard", null);
    const names = res.data.map((e) => e.coachName);
    expect(names).toContain("ShownCoach");
    expect(names).not.toContain("HiddenCoach");
  });
});
