import { describe, it, expect, beforeEach } from "vitest";
import {
  post,
  get,
  put,
  rawGet,
  rawPost,
  rawPut,
  resetDb,
} from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec d'authentification :
 *
 * Couvre les contrats des routes /auth/* qui n'étaient pas testés en E2E
 * jusqu'à présent. La logique métier (hashing, JWT) est validée par les
 * tests unitaires côté serveur ; ici on garantit le contrat HTTP de bout
 * en bout sur la vraie pile Express + Prisma SQLite.
 */
describe("E2E API — auth", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("POST /auth/register est désactivé en pré-alpha (403)", async () => {
    const res = await rawPost("/auth/register", null, {
      email: "newbie@e2e.test",
      password: "password-x",
      coachName: "Newbie",
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
  });

  it("POST /auth/login refuse un payload invalide (400)", async () => {
    // email manquant → middleware validate() renvoie 400
    const res = await rawPost("/auth/login", null, { password: "password-a" });
    expect(res.status).toBe(400);
  });

  it("POST /auth/login refuse un email inconnu (401)", async () => {
    const res = await rawPost("/auth/login", null, {
      email: "nobody@e2e.test",
      password: "password-x",
    });
    expect(res.status).toBe(401);
  });

  it("POST /auth/login refuse un mauvais mot de passe (401)", async () => {
    // On crée d'abord un compte via le seed de test, puis on essaie de se
    // connecter avec un mot de passe incorrect.
    await post("/__test/seed-user", null, {
      email: "alice@e2e.test",
      password: "password-a",
      name: "Alice",
    });
    const res = await rawPost("/auth/login", null, {
      email: "alice@e2e.test",
      password: "wrong-password",
    });
    expect(res.status).toBe(401);
  });

  it("GET /auth/me sans token → 401", async () => {
    const res = await rawGet("/auth/me", null);
    expect(res.status).toBe(401);
  });

  it("GET /auth/me avec token retourne le profil courant", async () => {
    const { token, userId } = await seedAndLogin(
      "alice@e2e.test",
      "password-a",
      "Alice",
    );
    const profile = await get<{ user: { id: string; email: string } }>(
      "/auth/me",
      token,
    );
    expect(profile.user.id).toBe(userId);
    expect(profile.user.email).toBe("alice@e2e.test");
  });

  it("PUT /auth/me met à jour le coachName", async () => {
    const { token } = await seedAndLogin(
      "alice@e2e.test",
      "password-a",
      "Alice",
    );
    const updated = await put<{ user: { coachName: string } }>(
      "/auth/me",
      token,
      { coachName: "Alice The Great" },
    );
    expect(updated.user.coachName).toBe("Alice The Great");
  });

  it("PUT /auth/me/password refuse si le mot de passe actuel est faux (401)", async () => {
    const { token } = await seedAndLogin(
      "alice@e2e.test",
      "password-a",
      "Alice",
    );
    const res = await rawPut("/auth/me/password", token, {
      currentPassword: "definitely-not-the-right-one",
      newPassword: "new-secure-password",
    });
    expect(res.status).toBe(401);
  });

  it("PUT /auth/me/password refuse un nouveau mot de passe trop court (400)", async () => {
    const { token } = await seedAndLogin(
      "alice@e2e.test",
      "password-a",
      "Alice",
    );
    const res = await rawPut("/auth/me/password", token, {
      currentPassword: "password-a",
      newPassword: "short",
    });
    expect(res.status).toBe(400);
  });
});
