import { describe, it, expect, beforeEach } from "vitest";
import { get, rawGet, resetDb } from "../helpers/api";

/**
 * Spec /star-players/regional-rules/:roster (O.4 expansion E2E).
 *
 * La route `GET /star-players/regional-rules/:roster` expose la
 * liste des regles regionales applicables a un roster donne. Elle
 * s'appuie sur `getRegionalRulesForTeam()` du game-engine (pure
 * fonction, aucune dependance DB) — contrairement aux autres
 * endpoints `/star-players/*` qui requierent le model `StarPlayer`
 * absent du schema SQLite de test.
 *
 * Ce spec couvre :
 *
 *  - Pas d'authentification requise : rawGet sans token -> 200
 *  - Roster connu (ex: lizardmen) -> tableau de regles regionales
 *    non vide
 *  - Roster avec ruleset explicite (?ruleset=season_3) -> meme
 *    contrat
 *  - Shape stable : `{ success: true, roster, regionalRules: [] }`
 *  - Ruleset invalide (?ruleset=unknown) -> pas de 500, fallback
 *    gracieux (resolveRuleset renvoie DEFAULT_RULESET)
 *
 * Ce spec vise deux objectifs :
 *  1. Garantir que les pages SEO `/star-players` et `/teams/[slug]`
 *     qui consomment cette route restent fonctionnelles
 *  2. Couvrir au moins un endpoint de `/star-players/*`, qui etait
 *     un trou de couverture E2E avant O.4
 */

interface RegionalRulesResponse {
  success: boolean;
  roster: string;
  regionalRules: string[];
}

describe("E2E API — /star-players/regional-rules/:roster (public)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("GET sans token -> 200 (route publique)", async () => {
    const res = await rawGet("/star-players/regional-rules/lizardmen", null);
    expect(res.status).toBe(200);
  });

  it("roster connu (lizardmen) -> regles regionales non vides", async () => {
    const json = await get<RegionalRulesResponse>(
      "/star-players/regional-rules/lizardmen",
      null,
    );
    expect(json.success).toBe(true);
    expect(json.roster).toBe("lizardmen");
    expect(Array.isArray(json.regionalRules)).toBe(true);
    // Les lizardmen appartiennent a la Lustrian Superleague BB3.
    expect(json.regionalRules.length).toBeGreaterThan(0);
  });

  it("roster inconnu -> 200 + regles vides (array, pas null)", async () => {
    // Le code route retourne 404 si `!regionalRules`, mais
    // getRegionalRulesForTeam renvoie toujours un array (jamais
    // null) — y compris [] pour un roster inconnu. Le contrat
    // est donc 200 + array vide. On teste ce contrat pour capter
    // toute regression (return `null` par erreur, etc.).
    const res = await rawGet(
      "/star-players/regional-rules/this-roster-does-not-exist",
      null,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as RegionalRulesResponse;
    expect(Array.isArray(json.regionalRules)).toBe(true);
    expect(json.regionalRules.length).toBe(0);
  });

  it("ruleset=season_3 retourne toujours un array", async () => {
    const json = await get<RegionalRulesResponse>(
      "/star-players/regional-rules/skaven?ruleset=season_3",
      null,
    );
    expect(json.success).toBe(true);
    expect(Array.isArray(json.regionalRules)).toBe(true);
  });

  it("ruleset=unknown fallback gracieux (pas de 500)", async () => {
    // resolveRuleset retourne DEFAULT_RULESET pour toute valeur
    // non listee, donc le endpoint doit rester 200.
    const res = await rawGet(
      "/star-players/regional-rules/skaven?ruleset=not-a-real-ruleset",
      null,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as RegionalRulesResponse;
    expect(json.success).toBe(true);
  });

  it("shape stable : keys success / roster / regionalRules", async () => {
    const json = await get<RegionalRulesResponse>(
      "/star-players/regional-rules/skaven",
      null,
    );
    expect(json).toHaveProperty("success");
    expect(json).toHaveProperty("roster");
    expect(json).toHaveProperty("regionalRules");
  });
});
