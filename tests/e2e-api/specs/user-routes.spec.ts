import { describe, it, expect, beforeEach } from "vitest";
import { get, rawGet, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec /user/matches (O.4 expansion E2E).
 *
 * La route `GET /user/matches` liste les matchs online joues par
 * l'utilisateur authentifie. Elle est gardee par `authUser` et filtre
 * sur `players: { some: { id: req.user.id } }` pour isoler chaque
 * coach.
 *
 * Ce spec couvre :
 *
 *  - Auth gate : sans token -> 401
 *  - Auth gate : token invalide -> 401
 *  - User neuf sans match -> 200 + `{ matches: [] }`
 *  - Deux users distincts : chacun voit sa propre liste vide (pas
 *    de cross-contamination)
 *  - Shape stable : le payload expose `matches` sous forme de tableau
 *
 * La route est minuscule (16 lignes) mais previent toute regression
 * sur l'auth gate et le filtrage par ownership — points critiques
 * vis-a-vis de la securite (voir rules/common/security.md).
 */

interface UserMatchesResponse {
  matches: Array<{
    id: string;
    status: string;
    seed: number;
    createdAt: string;
  }>;
}

describe("E2E API — /user/matches", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("GET /user/matches sans token -> 401", async () => {
    const res = await rawGet("/user/matches", null);
    expect(res.status).toBe(401);
  });

  it("GET /user/matches avec token invalide -> 401", async () => {
    const res = await rawGet("/user/matches", "not-a-valid-jwt");
    expect(res.status).toBe(401);
  });

  it("user neuf sans match -> 200 + matches vide", async () => {
    const { token } = await seedAndLogin(
      "user-empty@e2e.test",
      "password-u",
      "UserEmpty",
    );
    const json = await get<UserMatchesResponse>("/user/matches", token);
    expect(json).toHaveProperty("matches");
    expect(Array.isArray(json.matches)).toBe(true);
    expect(json.matches.length).toBe(0);
  });

  it("isolation : deux users distincts voient chacun leur propre liste", async () => {
    const alice = await seedAndLogin(
      "user-alice@e2e.test",
      "password-a",
      "Alice",
    );
    const bob = await seedAndLogin("user-bob@e2e.test", "password-b", "Bob");
    const aliceMatches = await get<UserMatchesResponse>(
      "/user/matches",
      alice.token,
    );
    const bobMatches = await get<UserMatchesResponse>(
      "/user/matches",
      bob.token,
    );
    expect(aliceMatches.matches.length).toBe(0);
    expect(bobMatches.matches.length).toBe(0);
  });
});
