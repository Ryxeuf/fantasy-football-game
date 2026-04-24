import { describe, it, expect, beforeEach } from "vitest";
import { rawGet, rawPost, post, get, resetDb } from "../helpers/api";
import { seedAndLogin } from "../helpers/factories";

/**
 * Spec /leagues (Sprint 17, L.3 — expansion E2E O.4).
 *
 * Les routes `/leagues` gerent la creation, le listing et le detail des
 * ligues competitives. Toute la famille est authentifiee (authUser).
 * On couvre ici :
 *  - 401 sans token
 *  - creation d'une ligue minimale (201 + payload attendu)
 *  - listing (enveloppe `{ leagues: [] }` puis non-vide apres creation)
 *  - detail par id (404 inconnu, 200 existant)
 *  - validation Zod sur payload invalide (400)
 *  - isolement utilisateur : un autre coach voit la ligue publique dans la liste
 *  - format `allowedRosters` : tableau ou null (parse JSON <-> array)
 */
interface League {
  id: string;
  creatorId: string;
  name: string;
  description: string | null;
  ruleset: string;
  isPublic: boolean;
  maxParticipants: number;
  allowedRosters: string[] | null;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  forfeitPoints: number;
}

interface ListResponse {
  leagues: League[];
}

interface DetailResponse {
  league: League;
}

describe("E2E API — /leagues", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("GET /leagues sans token renvoie 401", async () => {
    const res = await rawGet("/leagues", null);
    expect(res.status).toBe(401);
  });

  it("POST /leagues sans token renvoie 401", async () => {
    const res = await rawPost("/leagues", null, { name: "Ligue de test" });
    expect(res.status).toBe(401);
  });

  it("GET /leagues avec token et DB vide renvoie { leagues: [] }", async () => {
    const { token } = await seedAndLogin(
      "lg1@e2e.test",
      "password-lg1",
      "LG1",
    );
    const json = await get<ListResponse>("/leagues", token);
    expect(json).toHaveProperty("leagues");
    expect(Array.isArray(json.leagues)).toBe(true);
    expect(json.leagues).toEqual([]);
  });

  it("POST /leagues cree une ligue avec defaults et la retrouve via GET", async () => {
    const { token, userId } = await seedAndLogin(
      "lg2@e2e.test",
      "password-lg2",
      "LG2",
    );
    const created = await post<League>("/leagues", token, {
      name: "Ligue E2E",
      description: "Creee par le spec leagues.spec.ts",
    });
    expect(created.id).toBeTruthy();
    expect(created.name).toBe("Ligue E2E");
    expect(created.creatorId).toBe(userId);
    // Defaults imposes par le service league.
    expect(created.ruleset).toBe("season_3");
    expect(created.isPublic).toBe(true);
    expect(created.maxParticipants).toBe(16);
    expect(created.winPoints).toBe(3);
    expect(created.drawPoints).toBe(1);
    expect(created.lossPoints).toBe(0);
    expect(created.forfeitPoints).toBe(-1);
    // allowedRosters par defaut = null (pas de restriction)
    expect(created.allowedRosters).toBeNull();

    const list = await get<ListResponse>("/leagues", token);
    expect(list.leagues.length).toBe(1);
    expect(list.leagues[0].id).toBe(created.id);
  });

  it("POST /leagues avec allowedRosters retourne un tableau de slugs", async () => {
    const { token } = await seedAndLogin(
      "lg3@e2e.test",
      "password-lg3",
      "LG3",
    );
    const created = await post<League>("/leagues", token, {
      name: "Open 5 Teams",
      allowedRosters: ["skaven", "lizardmen", "dwarves"],
    });
    expect(Array.isArray(created.allowedRosters)).toBe(true);
    expect(created.allowedRosters).toEqual([
      "skaven",
      "lizardmen",
      "dwarves",
    ]);
  });

  it("POST /leagues avec payload invalide renvoie 400 (Zod)", async () => {
    const { token } = await seedAndLogin(
      "lg4@e2e.test",
      "password-lg4",
      "LG4",
    );
    // `name` vide -> viole min(1).
    const res = await rawPost("/leagues", token, { name: "" });
    expect(res.status).toBe(400);
  });

  it("POST /leagues avec maxParticipants hors bornes renvoie 400", async () => {
    const { token } = await seedAndLogin(
      "lg5@e2e.test",
      "password-lg5",
      "LG5",
    );
    // maxParticipants doit etre entre 2 et 128 (schema Zod).
    const tooSmall = await rawPost("/leagues", token, {
      name: "Ligue mini",
      maxParticipants: 1,
    });
    expect(tooSmall.status).toBe(400);
    const tooLarge = await rawPost("/leagues", token, {
      name: "Ligue maxi",
      maxParticipants: 999,
    });
    expect(tooLarge.status).toBe(400);
  });

  it("GET /leagues/:id renvoie 404 pour un id inconnu", async () => {
    const { token } = await seedAndLogin(
      "lg6@e2e.test",
      "password-lg6",
      "LG6",
    );
    const res = await rawGet("/leagues/unknown-league-id", token);
    expect(res.status).toBe(404);
  });

  it("GET /leagues/:id retourne la ligue creee", async () => {
    const { token } = await seedAndLogin(
      "lg7@e2e.test",
      "password-lg7",
      "LG7",
    );
    const created = await post<League>("/leagues", token, {
      name: "Ligue detail",
      description: "Pour le test /:id",
    });
    const detail = await get<DetailResponse>(
      `/leagues/${created.id}`,
      token,
    );
    expect(detail.league.id).toBe(created.id);
    expect(detail.league.name).toBe("Ligue detail");
    expect(detail.league.description).toBe("Pour le test /:id");
  });

  it("listing par un autre coach contient la ligue publique", async () => {
    const creator = await seedAndLogin(
      "lg8a@e2e.test",
      "password-lg8a",
      "LG8A",
    );
    const viewer = await seedAndLogin(
      "lg8b@e2e.test",
      "password-lg8b",
      "LG8B",
    );
    const created = await post<League>("/leagues", creator.token, {
      name: "Ligue publique",
      isPublic: true,
    });
    const list = await get<ListResponse>(
      "/leagues?publicOnly=true",
      viewer.token,
    );
    const ids = list.leagues.map((l) => l.id);
    expect(ids).toContain(created.id);
  });
});
