import { describe, it, expect, beforeAll } from "vitest";
import { get, rawGet } from "../helpers/api";

/**
 * Spec /api/skills (route publique, O.4 expansion E2E).
 *
 * La route publique `/api/skills` sert le catalogue des compétences avec
 * support des params `category`, `search` et `ruleset`. Ce spec valide :
 *
 *  - réponse 200 + enveloppe `{ skills: [...] }`
 *  - filtrage `?category=General` ne retourne que des skills de la catégorie
 *  - filtrage `?ruleset=season_3` retourne les skills S3
 *  - `?ruleset=unknown` fallback gracefully (pas de 500, ruleset par défaut)
 *  - aucune authentification requise
 *  - chaque entrée expose le contrat `{ id, slug, ruleset, nameFr, nameEn,
 *    description, descriptionEn, category }`
 *
 * Le param `?search=...` n'est pas testé ici : il s'appuie sur l'option
 * Prisma `mode: "insensitive"` qui n'est pas supportée par SQLite (suite
 * E2E). Cette limitation est documentée dans `public-skills.ts` et reste
 * couverte par les tests d'intégration sur Postgres.
 *
 * Le seed minimal (5 skills couvrant 5 catégories) est posé une fois au
 * début du describe via `/__test/seed-skills`. Skills étant des données
 * de référence (pas de FK matchs/users), on ne les reset pas entre tests.
 */

interface SkillResponseEntry {
  id: string;
  slug: string;
  ruleset: string;
  nameFr: string;
  nameEn: string;
  description: string;
  descriptionEn: string | null;
  category: string;
}

interface SkillsResponse {
  skills: SkillResponseEntry[];
}

async function seedSkills(): Promise<void> {
  const base =
    process.env.API_BASE ||
    `http://localhost:${process.env.API_PORT || "18002"}`;
  await fetch(`${base}/__test/seed-skills`, { method: "POST" });
}

describe("E2E API — /api/skills (public)", () => {
  beforeAll(async () => {
    await seedSkills();
  });

  it("GET /api/skills renvoie 200 + enveloppe { skills } sans auth", async () => {
    const res = await rawGet("/api/skills", null);
    expect(res.status).toBe(200);
    const json = (await res.json()) as SkillsResponse;
    expect(json).toHaveProperty("skills");
    expect(Array.isArray(json.skills)).toBe(true);
    expect(json.skills.length).toBeGreaterThan(0);
  });

  it("GET /api/skills retourne les skills seedés (block, dodge, ...)", async () => {
    const json = await get<SkillsResponse>("/api/skills", null);
    const slugs = json.skills.map((s) => s.slug);
    expect(slugs).toContain("block");
    expect(slugs).toContain("dodge");
    expect(slugs).toContain("mighty-blow");
    expect(slugs).toContain("pass");
    expect(slugs).toContain("sure-hands");
  });

  it("GET /api/skills?category=General ne retourne que des skills General", async () => {
    const json = await get<SkillsResponse>(
      "/api/skills?category=General",
      null,
    );
    expect(json.skills.length).toBeGreaterThan(0);
    for (const skill of json.skills) {
      expect(skill.category).toBe("General");
    }
    const slugs = json.skills.map((s) => s.slug);
    expect(slugs).toContain("block");
    expect(slugs).not.toContain("dodge"); // dodge est en Agility
  });

  it("GET /api/skills?ruleset=season_3 retourne uniquement des skills S3", async () => {
    const json = await get<SkillsResponse>(
      "/api/skills?ruleset=season_3",
      null,
    );
    expect(json.skills.length).toBeGreaterThan(0);
    for (const skill of json.skills) {
      expect(skill.ruleset).toBe("season_3");
    }
  });

  it("GET /api/skills?ruleset=unknown fallback sur le ruleset par défaut", async () => {
    const res = await rawGet("/api/skills?ruleset=unknown", null);
    expect(res.status).toBe(200);
    const json = (await res.json()) as SkillsResponse;
    expect(json.skills.length).toBeGreaterThan(0);
  });

  it("chaque entrée expose le contrat complet { id, slug, ruleset, nameFr, nameEn, description, category }", async () => {
    const json = await get<SkillsResponse>("/api/skills", null);
    for (const skill of json.skills) {
      expect(typeof skill.id).toBe("string");
      expect(typeof skill.slug).toBe("string");
      expect(typeof skill.ruleset).toBe("string");
      expect(typeof skill.nameFr).toBe("string");
      expect(typeof skill.nameEn).toBe("string");
      expect(typeof skill.description).toBe("string");
      expect(typeof skill.category).toBe("string");
      // descriptionEn peut être null pour des skills historiques
      expect(["string", "object"]).toContain(typeof skill.descriptionEn);
    }
  });

  it("GET /api/skills sans filtre couvre les 5 catégories seedées", async () => {
    const json = await get<SkillsResponse>("/api/skills", null);
    const categories = new Set(json.skills.map((s) => s.category));
    expect(categories).toContain("General");
    expect(categories).toContain("Agility");
    expect(categories).toContain("Strength");
    expect(categories).toContain("Passing");
    expect(categories).toContain("Trait");
  });
});
