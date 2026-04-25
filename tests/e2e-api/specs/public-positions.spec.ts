import { describe, it, expect, beforeEach } from "vitest";
import { get, rawGet, resetDb } from "../helpers/api";
import { API_BASE } from "../helpers/env";

/**
 * Spec /api/positions (route publique, O.4 expansion E2E).
 *
 * La route publique `/api/positions` sert la liste des positions
 * (lineman, blitzer, ...) avec support des params `lang`, `ruleset`
 * et `rosterSlug`. Ce spec valide :
 *
 *  - reponse 200 + enveloppe `{ positions, ruleset }`
 *  - filtrage `?rosterSlug=skaven` ne retourne que ce roster
 *  - parametre `?lang=en` renvoie le nom du roster en anglais
 *  - parametre `?ruleset=unknown` fallback gracefully (pas de 500)
 *  - GET /api/positions/:slug renvoie 200 + position attendue
 *  - GET /api/positions/:slug inconnu renvoie 404
 *  - pas d'authentification requise (rawGet sans token)
 *
 * Ce spec complete la couverture E2E API : `public-positions.ts`
 * etait la derniere route publique de reference data sans spec.
 * Les rosters + position lineman sont pre-seeds par le helper
 * /__test/seed-rosters utilise par la suite (skaven + lizardmen,
 * sur season_2 et season_3).
 */

interface PublicPosition {
  slug: string;
  displayName: string;
  cost: number;
  min: number;
  max: number;
  ma: number;
  st: number;
  ag: number;
  pa: number;
  av: number;
  skills: string;
  rosterSlug: string;
  rosterName: string;
}

interface PositionListResponse {
  positions: PublicPosition[];
  ruleset: string;
}

interface PositionDetailResponse {
  position: PublicPosition;
  ruleset: string;
}

async function reseedRosters(): Promise<void> {
  // Le setup e2e-api seed les rosters une fois au boot. `resetDb` les
  // supprime. On les recree avant chaque test pour garantir des donnees
  // deterministes sans interferer avec les autres specs.
  await fetch(`${API_BASE}/__test/seed-rosters`, { method: "POST" });
}

describe("E2E API — /api/positions (public)", () => {
  beforeEach(async () => {
    await resetDb();
    await reseedRosters();
  });

  it("GET /api/positions renvoie 200 + enveloppe standard sans auth", async () => {
    const res = await rawGet("/api/positions", null);
    expect(res.status).toBe(200);
    const json = (await res.json()) as PositionListResponse;
    expect(json).toHaveProperty("positions");
    expect(json).toHaveProperty("ruleset");
    expect(Array.isArray(json.positions)).toBe(true);
    expect(json.positions.length).toBeGreaterThan(0);
  });

  it("GET /api/positions renvoie les linemen seeded (skaven + lizardmen)", async () => {
    const json = await get<PositionListResponse>("/api/positions", null);
    const slugs = json.positions.map((p) => p.slug);
    expect(slugs).toContain("skaven_lineman");
    expect(slugs).toContain("lizardmen_lineman");
  });

  it("GET /api/positions?rosterSlug=skaven ne retourne que les positions skaven", async () => {
    const json = await get<PositionListResponse>(
      "/api/positions?rosterSlug=skaven",
      null,
    );
    expect(json.positions.length).toBeGreaterThan(0);
    for (const position of json.positions) {
      expect(position.rosterSlug).toBe("skaven");
    }
  });

  it("GET /api/positions?ruleset=season_3 retourne uniquement des positions S3", async () => {
    const json = await get<PositionListResponse>(
      "/api/positions?ruleset=season_3",
      null,
    );
    expect(json.ruleset).toBe("season_3");
    expect(json.positions.length).toBeGreaterThan(0);
  });

  it("GET /api/positions?lang=en renvoie les noms de roster en anglais", async () => {
    const enJson = await get<PositionListResponse>(
      "/api/positions?lang=en&rosterSlug=skaven",
      null,
    );
    const frJson = await get<PositionListResponse>(
      "/api/positions?lang=fr&rosterSlug=skaven",
      null,
    );
    const skavenEn = enJson.positions.find(
      (p) => p.slug === "skaven_lineman",
    );
    const skavenFr = frJson.positions.find(
      (p) => p.slug === "skaven_lineman",
    );
    expect(skavenEn).toBeDefined();
    expect(skavenFr).toBeDefined();
    // Le seed pose name="Skavens" (fr) et nameEn="Skaven" (en).
    expect(skavenEn!.rosterName).toBe("Skaven");
    expect(skavenFr!.rosterName).toBe("Skavens");
  });

  it("GET /api/positions?ruleset=unknown fallback sur le ruleset par defaut sans 500", async () => {
    const res = await rawGet("/api/positions?ruleset=unknown", null);
    expect(res.status).toBe(200);
    const json = (await res.json()) as PositionListResponse;
    // `resolveRuleset` renvoie DEFAULT_RULESET si la valeur n'est pas
    // dans RULESETS, donc pas de 500 par construction.
    expect(typeof json.ruleset).toBe("string");
    expect(json.ruleset.length).toBeGreaterThan(0);
  });

  it("chaque entree contient les stats numeriques attendues", async () => {
    const json = await get<PositionListResponse>("/api/positions", null);
    for (const position of json.positions) {
      expect(typeof position.slug).toBe("string");
      expect(typeof position.displayName).toBe("string");
      expect(typeof position.cost).toBe("number");
      expect(typeof position.ma).toBe("number");
      expect(typeof position.st).toBe("number");
      expect(typeof position.ag).toBe("number");
      expect(typeof position.av).toBe("number");
      expect(typeof position.rosterSlug).toBe("string");
      expect(typeof position.rosterName).toBe("string");
    }
  });

  it("GET /api/positions/:slug renvoie 200 + la position attendue", async () => {
    const json = await get<PositionDetailResponse>(
      "/api/positions/skaven_lineman",
      null,
    );
    expect(json).toHaveProperty("position");
    expect(json).toHaveProperty("ruleset");
    expect(json.position.slug).toBe("skaven_lineman");
    expect(json.position.rosterSlug).toBe("skaven");
    expect(json.position.cost).toBe(50_000);
  });

  it("GET /api/positions/:slug inconnu renvoie 404", async () => {
    const res = await rawGet("/api/positions/this-position-does-not-exist", null);
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBeDefined();
  });
});
