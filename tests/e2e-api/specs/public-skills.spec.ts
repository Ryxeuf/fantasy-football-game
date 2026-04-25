import { describe, it, expect, beforeEach } from "vitest";
import { get, rawGet, resetDb } from "../helpers/api";
import { API_BASE } from "../helpers/env";

/**
 * Spec /api/skills (route publique, O.4 expansion E2E).
 *
 * `public-skills.ts` expose la liste des compétences (skills) BB3 sans
 * authentification, avec support des params `ruleset`, `category` et
 * `search`. Les requêtes sans `search` sont memoizées 5 min — ce spec
 * compte sur `invalidateAllMemo()` (déclenché dans `__test/reset` et
 * `__test/seed-skills`) pour garantir des résultats déterministes.
 *
 * Ce spec valide :
 *  - 200 + enveloppe `{ skills: [...] }` sans auth
 *  - filtrage `?category=` respecté
 *  - filtrage `?ruleset=season_3`
 *  - `?ruleset=unknown` ne fait pas 500 (fallback ruleset par défaut)
 *  - chaque entrée renvoie les colonnes attendues
 *
 * Note : la branche `?search=` n'est pas couverte ici car elle utilise
 * `mode: "insensitive"` (Prisma) qui n'est pas supporté par SQLite.
 * Couverte en prod (Postgres) via la suite manuelle.
 */

interface SkillRow {
  id: string;
  slug: string;
  ruleset: string;
  nameFr: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  category: string;
}

interface SkillListResponse {
  skills: SkillRow[];
}

async function seedSkills(): Promise<void> {
  await fetch(`${API_BASE}/__test/seed-skills`, { method: "POST" });
}

describe("E2E API — /api/skills (public)", () => {
  beforeEach(async () => {
    await resetDb();
    await seedSkills();
  });

  it("GET /api/skills renvoie 200 + enveloppe `{ skills: [...] }` sans auth", async () => {
    const res = await rawGet("/api/skills", null);
    expect(res.status).toBe(200);
    const json = (await res.json()) as SkillListResponse;
    expect(json).toHaveProperty("skills");
    expect(Array.isArray(json.skills)).toBe(true);
    expect(json.skills.length).toBeGreaterThan(0);
  });

  it("GET /api/skills retourne les skills seedés (block, dodge, tackle)", async () => {
    const json = await get<SkillListResponse>("/api/skills", null);
    const slugs = json.skills.map((s) => s.slug);
    expect(slugs).toContain("block");
    expect(slugs).toContain("dodge");
    expect(slugs).toContain("tackle");
  });

  it("GET /api/skills?category=Agility filtre côté serveur", async () => {
    const json = await get<SkillListResponse>(
      "/api/skills?category=Agility",
      null,
    );
    expect(json.skills.length).toBeGreaterThan(0);
    for (const s of json.skills) {
      expect(s.category).toBe("Agility");
    }
    const slugs = json.skills.map((s) => s.slug);
    expect(slugs).toContain("dodge");
    expect(slugs).not.toContain("block");
  });

  it("GET /api/skills?ruleset=season_3 ne renvoie que les skills S3", async () => {
    const json = await get<SkillListResponse>(
      "/api/skills?ruleset=season_3",
      null,
    );
    expect(json.skills.length).toBeGreaterThan(0);
    for (const s of json.skills) {
      expect(s.ruleset).toBe("season_3");
    }
  });

  it("GET /api/skills?ruleset=unknown fallback sur le ruleset par défaut (pas de 500)", async () => {
    const res = await rawGet("/api/skills?ruleset=unknown", null);
    expect(res.status).toBe(200);
    const json = (await res.json()) as SkillListResponse;
    expect(Array.isArray(json.skills)).toBe(true);
    // Le fallback retombe sur DEFAULT_RULESET qui contient les skills seedés.
    expect(json.skills.length).toBeGreaterThan(0);
  });

  it("chaque entrée contient slug, nameFr, nameEn, category, ruleset", async () => {
    const json = await get<SkillListResponse>("/api/skills", null);
    for (const s of json.skills) {
      expect(typeof s.slug).toBe("string");
      expect(typeof s.nameFr).toBe("string");
      expect(typeof s.nameEn).toBe("string");
      expect(typeof s.category).toBe("string");
      expect(typeof s.ruleset).toBe("string");
    }
  });
});
