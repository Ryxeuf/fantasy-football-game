import { describe, it, expect, beforeEach } from "vitest";
import { get, rawGet, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec /api/feature-flags/me (O.4 expansion E2E).
 *
 * La route `GET /api/feature-flags/me` expose la liste des feature
 * flags actuellement actifs pour l'utilisateur authentifie. Le service
 * `listEnabledKeysForUser` retourne :
 *
 *  - tous les flags quand `FEATURE_FLAGS_FORCE_ENABLED=true` (setup
 *    e2e-api met ce flag par defaut, donc le test runner voit
 *    l'ensemble des flags declares) ;
 *  - sinon la combinaison flags globalement actives + overrides
 *    utilisateur.
 *
 * Ce spec valide :
 *
 *  - refus sans token (401) — middleware `authUser` poste en premier ;
 *  - reponse 200 + enveloppe `{ success: true, data: string[] }` avec
 *    token valide ;
 *  - le data est trie alphabetiquement (contrat de la fonction
 *    `listEnabledKeysForUser`) ;
 *  - le meme user vu deux fois renvoie la meme liste (stabilite sans
 *    effet de bord).
 */

interface FeatureFlagsResponse {
  success: boolean;
  data: string[];
  error?: string;
}

describe("E2E API — /api/feature-flags/me", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("GET /api/feature-flags/me sans token -> 401", async () => {
    const res = await rawGet("/api/feature-flags/me", null);
    expect(res.status).toBe(401);
  });

  it("GET /api/feature-flags/me avec token -> 200 + `{ success, data: string[] }`", async () => {
    const { token } = await seedAndLogin(
      "flags-a@e2e.test",
      "password-flags",
      "FlagsUser",
    );
    const json = await get<FeatureFlagsResponse>(
      "/api/feature-flags/me",
      token,
    );
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    // Chaque entree est une cle string non vide.
    for (const key of json.data) {
      expect(typeof key).toBe("string");
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it("le tableau data est trie alphabetiquement", async () => {
    const { token } = await seedAndLogin(
      "flags-b@e2e.test",
      "password-flags",
      "FlagsSortCheck",
    );
    const json = await get<FeatureFlagsResponse>(
      "/api/feature-flags/me",
      token,
    );
    const sorted = [...json.data].sort();
    expect(json.data).toEqual(sorted);
  });

  it("deux appels consecutifs renvoient la meme liste (stabilite)", async () => {
    const { token } = await seedAndLogin(
      "flags-c@e2e.test",
      "password-flags",
      "FlagsStability",
    );
    const first = await get<FeatureFlagsResponse>(
      "/api/feature-flags/me",
      token,
    );
    const second = await get<FeatureFlagsResponse>(
      "/api/feature-flags/me",
      token,
    );
    expect(second.data).toEqual(first.data);
  });

  it("GET /api/feature-flags/me avec token invalide -> 401", async () => {
    const res = await rawGet(
      "/api/feature-flags/me",
      "invalid.jwt.token",
    );
    expect(res.status).toBe(401);
  });
});
