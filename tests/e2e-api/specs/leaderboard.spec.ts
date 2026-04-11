import { describe, it, expect, beforeEach } from "vitest";
import { get, resetDb } from "../helpers/api";
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
 */
describe("E2E API — /leaderboard", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("retourne un envelope standard {success, data, meta}", async () => {
    // Crée 3 coachs pour avoir un classement non vide.
    await Promise.all([
      seedAndLogin("alice@e2e.test", "password-a", "Alice"),
      seedAndLogin("bob@e2e.test", "password-b", "Bob"),
      seedAndLogin("carol@e2e.test", "password-c", "Carol"),
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
      seedAndLogin("alice@e2e.test", "password-a", "Alice"),
      seedAndLogin("bob@e2e.test", "password-b", "Bob"),
      seedAndLogin("carol@e2e.test", "password-c", "Carol"),
    ]);

    const res = await get<LeaderboardResponse>("/leaderboard?limit=2", null);
    expect(res.data.length).toBeLessThanOrEqual(2);
    expect(res.meta.limit).toBe(2);
  });

  it("retourne les coachs triés par eloRating décroissant", async () => {
    await Promise.all([
      seedAndLogin("alice@e2e.test", "password-a", "Alice"),
      seedAndLogin("bob@e2e.test", "password-b", "Bob"),
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
      seedAndLogin("alice@e2e.test", "password-a", "Alice"),
      seedAndLogin("bob@e2e.test", "password-b", "Bob"),
      seedAndLogin("carol@e2e.test", "password-c", "Carol"),
    ]);

    const res = await get<LeaderboardResponse>("/leaderboard?offset=1", null);
    expect(res.meta.offset).toBe(1);
    if (res.data.length > 0) {
      expect(res.data[0].rank).toBe(2);
    }
  });
});
