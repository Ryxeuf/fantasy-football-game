import { describe, it, expect, beforeEach } from "vitest";
import { rawGet, get, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec /achievements (route authentifiee, O.4 expansion E2E).
 *
 * La route `/achievements` renvoie le catalogue complet des succes avec le
 * statut verrouille/deverouille pour l'utilisateur courant. Les succes sont
 * calcules lazy a chaque appel (stats agregees sur matches / amities /
 * rosters joues) — voir apps/server/src/services/achievements.ts.
 *
 * On valide :
 *  - 401 sans token (authUser middleware)
 *  - 200 + enveloppe `{ success, data: { stats, achievements } }` avec token
 *  - toutes les achievements sont `unlocked=false` pour un utilisateur neuf
 *  - les stats agregees sont a 0 pour un utilisateur neuf
 *  - chaque achievement contient les champs i18n attendus (fr/en)
 *  - le catalogue contient au moins "first-match" (jalon bas)
 */
interface AchievementView {
  slug: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  category: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

interface AchievementStats {
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  touchdowns: number;
  casualties: number;
  friendsCount: number;
  rostersPlayed: string[];
  winsByRoster: Record<string, number>;
}

interface AchievementsResponse {
  success: boolean;
  data: {
    stats: AchievementStats;
    achievements: AchievementView[];
  };
}

describe("E2E API — /achievements", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("GET /achievements sans token renvoie 401", async () => {
    const res = await rawGet("/achievements", null);
    expect(res.status).toBe(401);
  });

  it("GET /achievements avec token renvoie 200 + enveloppe standard", async () => {
    const { token } = await seedAndLogin("ach@e2e.test", "password-ach", "Ach");
    const res = await rawGet("/achievements", token);
    expect(res.status).toBe(200);
    const json = (await res.json()) as AchievementsResponse;
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty("stats");
    expect(json.data).toHaveProperty("achievements");
    expect(Array.isArray(json.data.achievements)).toBe(true);
  });

  it("utilisateur neuf a toutes les achievements verrouillees", async () => {
    const { token } = await seedAndLogin(
      "ach2@e2e.test",
      "password-ach2",
      "Ach2",
    );
    const json = await get<AchievementsResponse>("/achievements", token);
    expect(json.data.achievements.length).toBeGreaterThan(0);
    for (const ach of json.data.achievements) {
      expect(ach.unlocked).toBe(false);
      expect(ach.unlockedAt).toBeNull();
    }
  });

  it("utilisateur neuf a toutes les stats a 0", async () => {
    const { token } = await seedAndLogin(
      "ach3@e2e.test",
      "password-ach3",
      "Ach3",
    );
    const json = await get<AchievementsResponse>("/achievements", token);
    expect(json.data.stats.matchesPlayed).toBe(0);
    expect(json.data.stats.wins).toBe(0);
    expect(json.data.stats.draws).toBe(0);
    expect(json.data.stats.losses).toBe(0);
    expect(json.data.stats.touchdowns).toBe(0);
    expect(json.data.stats.casualties).toBe(0);
    expect(json.data.stats.friendsCount).toBe(0);
    expect(json.data.stats.rostersPlayed).toEqual([]);
    expect(json.data.stats.winsByRoster).toEqual({});
  });

  it("chaque achievement contient les champs i18n + metadonnees", async () => {
    const { token } = await seedAndLogin(
      "ach4@e2e.test",
      "password-ach4",
      "Ach4",
    );
    const json = await get<AchievementsResponse>("/achievements", token);
    for (const ach of json.data.achievements) {
      expect(typeof ach.slug).toBe("string");
      expect(ach.slug.length).toBeGreaterThan(0);
      expect(typeof ach.nameFr).toBe("string");
      expect(typeof ach.nameEn).toBe("string");
      expect(typeof ach.descriptionFr).toBe("string");
      expect(typeof ach.descriptionEn).toBe("string");
      expect(typeof ach.category).toBe("string");
      expect(typeof ach.icon).toBe("string");
      expect(typeof ach.unlocked).toBe("boolean");
    }
  });

  it("catalogue contient le jalon 'first-match'", async () => {
    const { token } = await seedAndLogin(
      "ach5@e2e.test",
      "password-ach5",
      "Ach5",
    );
    const json = await get<AchievementsResponse>("/achievements", token);
    const slugs = json.data.achievements.map((a) => a.slug);
    expect(slugs).toContain("first-match");
  });

  it("deux utilisateurs neufs isoles : progression independante", async () => {
    const userA = await seedAndLogin(
      "achA@e2e.test",
      "password-achA",
      "AchA",
    );
    const userB = await seedAndLogin(
      "achB@e2e.test",
      "password-achB",
      "AchB",
    );
    const jsonA = await get<AchievementsResponse>(
      "/achievements",
      userA.token,
    );
    const jsonB = await get<AchievementsResponse>(
      "/achievements",
      userB.token,
    );
    // Deux utilisateurs distincts partagent le meme catalogue mais ont
    // leur propre statut d'unlock (tous verrouilles ici).
    expect(jsonA.data.achievements.length).toBe(
      jsonB.data.achievements.length,
    );
    expect(jsonA.data.stats.matchesPlayed).toBe(0);
    expect(jsonB.data.stats.matchesPlayed).toBe(0);
  });
});
