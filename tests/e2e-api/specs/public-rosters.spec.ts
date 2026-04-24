import { describe, it, expect, beforeEach } from "vitest";
import { get, rawGet, resetDb } from "../helpers/api";

/**
 * Spec /api/rosters (route publique, O.4 expansion E2E).
 *
 * La route publique `/api/rosters` sert la liste des rosters (equipes)
 * avec support des params `lang` et `ruleset`. Ce spec valide :
 *
 *  - reponse 200 + enveloppe `{ rosters, ruleset, availableRulesets }`
 *  - filtrage `?ruleset=season_3` respecte
 *  - parametre `?lang=en` renvoie les noms en anglais
 *  - parametre `?ruleset=unknown` fallback gracefully (pas de 500)
 *  - pas d'authentification requise (rawGet sans token)
 *  - reseed minimal via /__test/seed-rosters (skaven + lizardmen)
 *
 * Ce spec complete la couverture E2E API en verifiant une route
 * publique non-auth non couverte jusqu'ici. Les rosters sont pre-seeds
 * par `tests/e2e-api/setup.ts` pour les deux rulesets (season_2 et
 * season_3), donc on peut asserter sur le contenu metier.
 */

interface RosterListEntry {
  slug: string;
  name: string;
  budget: number;
  tier: string;
  naf: boolean;
  _count?: { positions: number };
}

interface RosterListResponse {
  rosters: RosterListEntry[];
  ruleset: string;
  availableRulesets: string[];
}

async function reseedRosters(): Promise<void> {
  // Le setup e2e-api seed les rosters une fois au boot. `resetDb` les
  // supprime. On les recree avant chaque test pour garantir des donnees
  // deterministes sans interferer avec les autres specs.
  await fetch(
    `${process.env.API_BASE || `http://localhost:${process.env.API_PORT || "18002"}`}/__test/seed-rosters`,
    { method: "POST" },
  );
}

describe("E2E API — /api/rosters (public)", () => {
  beforeEach(async () => {
    await resetDb();
    await reseedRosters();
  });

  it("GET /api/rosters renvoie 200 + enveloppe standard sans auth", async () => {
    const res = await rawGet("/api/rosters", null);
    expect(res.status).toBe(200);
    const json = (await res.json()) as RosterListResponse;
    expect(json).toHaveProperty("rosters");
    expect(json).toHaveProperty("ruleset");
    expect(json).toHaveProperty("availableRulesets");
    expect(Array.isArray(json.rosters)).toBe(true);
    expect(Array.isArray(json.availableRulesets)).toBe(true);
  });

  it("GET /api/rosters renvoie les rosters seeded (skaven + lizardmen)", async () => {
    const json = await get<RosterListResponse>("/api/rosters", null);
    const slugs = json.rosters.map((r) => r.slug);
    expect(slugs).toContain("skaven");
    expect(slugs).toContain("lizardmen");
  });

  it("GET /api/rosters?ruleset=season_3 retourne uniquement des rosters S3", async () => {
    const json = await get<RosterListResponse>(
      "/api/rosters?ruleset=season_3",
      null,
    );
    expect(json.ruleset).toBe("season_3");
    expect(json.rosters.length).toBeGreaterThan(0);
  });

  it("GET /api/rosters?lang=en renvoie les noms en anglais", async () => {
    const enJson = await get<RosterListResponse>(
      "/api/rosters?lang=en",
      null,
    );
    const frJson = await get<RosterListResponse>(
      "/api/rosters?lang=fr",
      null,
    );
    const skavenEn = enJson.rosters.find((r) => r.slug === "skaven");
    const skavenFr = frJson.rosters.find((r) => r.slug === "skaven");
    expect(skavenEn).toBeDefined();
    expect(skavenFr).toBeDefined();
    // Le seed pose name="Skavens" (fr) et nameEn="Skaven" (en).
    expect(skavenEn!.name).toBe("Skaven");
    expect(skavenFr!.name).toBe("Skavens");
  });

  it("GET /api/rosters?ruleset=unknown fallback sur le ruleset par defaut", async () => {
    const res = await rawGet("/api/rosters?ruleset=unknown", null);
    expect(res.status).toBe(200);
    const json = (await res.json()) as RosterListResponse;
    // `resolveRuleset` renvoie DEFAULT_RULESET si la valeur n'est pas
    // dans RULESETS, donc pas de 500 ni de liste vide par construction.
    expect(json.availableRulesets.length).toBeGreaterThan(0);
    expect(json.availableRulesets).toContain(json.ruleset);
  });

  it("chaque entree contient budget, tier, naf, _count", async () => {
    const json = await get<RosterListResponse>("/api/rosters", null);
    for (const roster of json.rosters) {
      expect(typeof roster.slug).toBe("string");
      expect(typeof roster.name).toBe("string");
      expect(typeof roster.budget).toBe("number");
      expect(typeof roster.tier).toBe("string");
      expect(typeof roster.naf).toBe("boolean");
    }
  });
});
