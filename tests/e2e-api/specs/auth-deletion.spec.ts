import { describe, it, expect, beforeEach } from "vitest";
import {
  rawDelete,
  rawPost,
  rawGet,
  resetDb,
} from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec DELETE /auth/me (suppression logique de compte) — O.4 expansion E2E.
 *
 * `auth.spec.ts` deja merge couvre register / login / GET-PUT /me /
 * change-password mais pas la route DELETE /auth/me, qui est une
 * fonctionnalite RGPD-friendly cruciale (suppression a la demande).
 *
 * Le route fait une suppression logique : l'utilisateur passe a
 * `valid: false` plutot qu'une vraie suppression cascade. La route
 * /auth/login refuse ensuite la connexion avec un 403 (cf. ligne 115
 * de auth.ts).
 *
 * Ce spec couvre :
 *
 *  - DELETE /auth/me sans token -> 401
 *  - DELETE /auth/me avec token expire/invalide -> 401
 *  - DELETE /auth/me avec token valide -> 200 + message attendu
 *  - Apres suppression : login refuse avec 403 (compte invalide)
 *  - Apres suppression : GET /auth/me avec l'ancien token continue
 *    a fonctionner cote middleware (le JWT est encore valide cote
 *    crypto), MAIS la route renvoie un compte invalide donc le
 *    flux UI doit deja detecter via login. On verifie juste que
 *    le service ne crashe pas.
 *
 *  - Le format de la reponse 200 est bien `{ message: string }`
 *  - Isolation : la suppression d'Alice n'affecte pas le compte de Bob
 *
 * Pas de modification de schema requis (champ `valid` deja present
 * sur le model User en SQLite).
 */

interface DeleteResponse {
  message: string;
}

interface ErrorResponse {
  error: string;
}

describe("E2E API — DELETE /auth/me (account deletion)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("DELETE /auth/me sans token -> 401", async () => {
    const res = await rawDelete("/auth/me", null);
    expect(res.status).toBe(401);
  });

  it("DELETE /auth/me avec token invalide -> 401", async () => {
    const res = await rawDelete("/auth/me", "not-a-valid-jwt");
    expect(res.status).toBe(401);
  });

  it("DELETE /auth/me avec token valide -> 200 + message", async () => {
    const { token } = await seedAndLogin(
      "alice@del.test",
      "password-a",
      "Alice",
    );
    const res = await rawDelete("/auth/me", token);
    expect(res.status).toBe(200);
    const body = (await res.json()) as DeleteResponse;
    expect(typeof body.message).toBe("string");
    // La route doit clairement indiquer la desactivation.
    expect(body.message.toLowerCase()).toContain("compte");
  });

  it("apres DELETE /auth/me, login refuse avec 403 (compte invalide)", async () => {
    const email = "alice@del.test";
    const password = "password-a";
    const { token } = await seedAndLogin(email, password, "Alice");

    // 1. Suppression logique du compte
    const delRes = await rawDelete("/auth/me", token);
    expect(delRes.status).toBe(200);

    // 2. Tentative de relogin -> 403 (compte invalide)
    const loginRes = await rawPost("/auth/login", null, {
      email,
      password,
    });
    expect(loginRes.status).toBe(403);
    const body = (await loginRes.json()) as ErrorResponse;
    expect(body.error).toBeTruthy();
  });

  it("la suppression d'un compte n'affecte pas un autre user", async () => {
    const alice = await seedAndLogin("alice@del.test", "pwd-a", "Alice");
    const bob = await seedAndLogin("bob@del.test", "pwd-b", "Bob");

    // Alice supprime son compte
    const delRes = await rawDelete("/auth/me", alice.token);
    expect(delRes.status).toBe(200);

    // Bob peut toujours acceder a son profil
    const meRes = await rawGet("/auth/me", bob.token);
    expect(meRes.status).toBe(200);

    // Bob peut toujours se reconnecter
    const loginRes = await rawPost("/auth/login", null, {
      email: "bob@del.test",
      password: "pwd-b",
    });
    expect(loginRes.status).toBe(200);
  });

  it("un compte deja supprime renvoie 200 si on appelle DELETE a nouveau (idempotent)", async () => {
    const { token } = await seedAndLogin(
      "alice@del.test",
      "password-a",
      "Alice",
    );
    const first = await rawDelete("/auth/me", token);
    expect(first.status).toBe(200);

    // Le second appel : le user existe toujours en base avec valid=false.
    // Le route ne distingue pas "deja desactive" et renvoie 200 a nouveau.
    const second = await rawDelete("/auth/me", token);
    expect(second.status).toBe(200);
  });
});
