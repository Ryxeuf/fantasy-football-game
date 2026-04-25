import { describe, it, expect, beforeEach } from "vitest";
import { rawGet, rawPost, rawDelete, get, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec /local-match/* (O.4 expansion E2E).
 *
 * Le routeur `apps/server/src/routes/local-match.ts` expose ~16
 * endpoints pour gerer les parties offline (table-top numerique) :
 * creation, listing, mise a jour d'etat, completion, suppression,
 * et partage via token.
 *
 * Ce spec couvre les contrats critiques sans dependre du seeding
 * complexe d'une vraie equipe (modeles `TeamPlayer` + relations
 * non triviales en SQLite). On se concentre sur :
 *
 *  - L'auth gate (401) sur les routes protegees par `authUser`
 *  - La validation Zod (`localMatchListQuerySchema`,
 *    `createLocalMatchSchema`) — 400 sur payloads invalides
 *  - Les not-found (404) sur les ressources inexistantes
 *  - Le contrat "user neuf voit une liste vide"
 *  - L'absence de fuite (route publique `/share/:token` retourne
 *    404 generique sur token invalide, pas d'info DB)
 *
 * Aucun seed metier n'est necessaire : les cas couverts sont les
 * branches negatives qui rejettent avant d'aller en DB ou sur des
 * IDs forges.
 */

interface ListResponse {
  localMatches: unknown[];
}

interface ErrorResponse {
  error?: string;
}

describe("E2E API — /local-match/* (auth + validation)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  // ── Auth gate (401) ──

  it("GET /local-match sans token -> 401", async () => {
    const res = await rawGet("/local-match", null);
    expect(res.status).toBe(401);
  });

  it("GET /local-match/:id sans token -> 401", async () => {
    const res = await rawGet("/local-match/some-fake-id", null);
    expect(res.status).toBe(401);
  });

  it("POST /local-match sans token -> 401", async () => {
    const res = await rawPost("/local-match", null, { teamAId: "x" });
    expect(res.status).toBe(401);
  });

  it("DELETE /local-match/:id sans token -> 401", async () => {
    const res = await rawDelete("/local-match/some-fake-id", null);
    expect(res.status).toBe(401);
  });

  it("GET /local-match/:id/actions sans token -> 401", async () => {
    const res = await rawGet("/local-match/some-fake-id/actions", null);
    expect(res.status).toBe(401);
  });

  // ── List : user neuf voit une liste vide ──

  it("GET /local-match avec user neuf -> 200 + { localMatches: [] }", async () => {
    const { token } = await seedAndLogin(
      "lm-user@e2e.test",
      "password-lm",
      "LocalMatchUser",
    );
    const json = await get<ListResponse>("/local-match", token);
    expect(json).toHaveProperty("localMatches");
    expect(Array.isArray(json.localMatches)).toBe(true);
    expect(json.localMatches).toHaveLength(0);
  });

  it("GET /local-match?scope=invalid -> 400 (validateQuery rejette)", async () => {
    const { token } = await seedAndLogin(
      "lm-user-invalid@e2e.test",
      "password-lm",
      "LocalMatchInvalidQuery",
    );
    const res = await rawGet("/local-match?scope=not-a-real-scope", token);
    expect(res.status).toBe(400);
  });

  // ── Detail : 404 sur id inexistant ──

  it("GET /local-match/:id avec id inexistant -> 404", async () => {
    const { token } = await seedAndLogin(
      "lm-user-404@e2e.test",
      "password-lm",
      "LocalMatch404",
    );
    const res = await rawGet("/local-match/this-id-does-not-exist", token);
    expect(res.status).toBe(404);
  });

  // ── Create : validation + 404 ──

  it("POST /local-match sans payload -> 400 (teamAId requis)", async () => {
    const { token } = await seedAndLogin(
      "lm-create-empty@e2e.test",
      "password-lm",
      "LocalMatchEmpty",
    );
    const res = await rawPost("/local-match", token, {});
    expect(res.status).toBe(400);
  });

  it("POST /local-match avec teamAId vide -> 400 (min 1)", async () => {
    const { token } = await seedAndLogin(
      "lm-create-empty-id@e2e.test",
      "password-lm",
      "LocalMatchEmptyId",
    );
    const res = await rawPost("/local-match", token, { teamAId: "" });
    expect(res.status).toBe(400);
  });

  it("POST /local-match avec teamAId inexistant -> 404", async () => {
    const { token } = await seedAndLogin(
      "lm-create-fake@e2e.test",
      "password-lm",
      "LocalMatchFake",
    );
    const res = await rawPost("/local-match", token, {
      teamAId: "this-team-does-not-exist",
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error).toBeDefined();
  });

  // ── Share token (route publique) ──

  it("GET /local-match/share/:token avec token invalide -> 404 (pas d'auth)", async () => {
    const res = await rawGet(
      "/local-match/share/this-token-does-not-exist",
      null,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorResponse;
    expect(body.error).toBeDefined();
  });

  it("le body 401 (auth gate) ne contient que `{ error }`", async () => {
    const res = await rawGet("/local-match", null);
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("error");
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("isolation : deux users distincts voient chacun leur propre liste vide", async () => {
    const [a, b] = await Promise.all([
      seedAndLogin("lm-iso-a@e2e.test", "password-a", "LocalMatchIsoA"),
      seedAndLogin("lm-iso-b@e2e.test", "password-b", "LocalMatchIsoB"),
    ]);
    const [listA, listB] = await Promise.all([
      get<ListResponse>("/local-match", a.token),
      get<ListResponse>("/local-match", b.token),
    ]);
    expect(listA.localMatches).toHaveLength(0);
    expect(listB.localMatches).toHaveLength(0);
  });
});
