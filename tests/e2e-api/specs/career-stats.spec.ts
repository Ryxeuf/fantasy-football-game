import { describe, it, expect, beforeEach } from "vitest";
import { get, rawGet, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

/**
 * Spec /career-stats/team/:teamId (O.4 expansion E2E).
 *
 * La route `GET /career-stats/team/:teamId` renvoie l'historique de
 * matchs + stats de carriere par equipe (Sprint 16 N.6). Elle exige
 * un token JWT et l'equipe doit etre detenue par l'utilisateur.
 *
 * Ce spec couvre :
 *
 *  - Auth gate : sans token -> 401
 *  - 404 si l'equipe n'existe pas
 *  - 404 si l'equipe existe mais n'appartient pas au caller (isolation)
 *  - 200 + payload carriere pour le proprietaire (shape minimale :
 *    team record + history [] + players [] — equipe toute neuve donc
 *    aucun match termine, stats a zero)
 *  - Format stable : les cles top-level attendues sont presentes
 *
 * Le spec utilise le helper `createTeam` qui seed une equipe via
 * /__test/seed-team (reseed automatique des rosters fait par
 * setup.ts). Pas de dependance sur des models absents du schema
 * sqlite.
 */

interface CareerStatsResponse {
  team: {
    id: string;
    name: string;
    roster: string;
    ruleset: string;
  };
  record: {
    wins: number;
    losses: number;
    draws: number;
    touchdownsFor: number;
    touchdownsAgainst: number;
    casualtiesInflicted: number;
    casualtiesSuffered: number;
  };
  history: unknown[];
  players: unknown[];
}

describe("E2E API — /career-stats/team/:teamId", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("GET /career-stats/team/:teamId sans token -> 401", async () => {
    const res = await rawGet("/career-stats/team/dummy-team-id", null);
    expect(res.status).toBe(401);
  });

  it("GET /career-stats/team/:teamId sur team inexistante -> 404", async () => {
    const { token } = await seedAndLogin(
      "career-a@e2e.test",
      "password-a",
      "CareerA",
    );
    const res = await rawGet(
      "/career-stats/team/nonexistent-team-id",
      token,
    );
    expect(res.status).toBe(404);
  });

  it("GET /career-stats/team/:teamId sur equipe d'un autre coach -> 404", async () => {
    const alice = await seedAndLogin(
      "career-alice@e2e.test",
      "password-a",
      "Alice",
    );
    const bob = await seedAndLogin(
      "career-bob@e2e.test",
      "password-b",
      "Bob",
    );
    const bobTeam = await createTeam(bob.userId, "Bob's Team", "skaven");
    // Alice tente de lire la team de Bob -> 404 (isolation par ownerId).
    const res = await rawGet(
      `/career-stats/team/${bobTeam.teamId}`,
      alice.token,
    );
    expect(res.status).toBe(404);
  });

  it("GET /career-stats/team/:teamId sur propre equipe -> 200 + shape stable", async () => {
    const owner = await seedAndLogin(
      "career-owner@e2e.test",
      "password-o",
      "Owner",
    );
    const team = await createTeam(owner.userId, "My Team", "skaven");
    const stats = await get<CareerStatsResponse>(
      `/career-stats/team/${team.teamId}`,
      owner.token,
    );
    expect(stats).toHaveProperty("team");
    expect(stats).toHaveProperty("record");
    expect(stats).toHaveProperty("history");
    expect(stats).toHaveProperty("players");
    expect(stats.team.id).toBe(team.teamId);
    expect(Array.isArray(stats.history)).toBe(true);
    expect(Array.isArray(stats.players)).toBe(true);
  });

  it("team neuve sans match : record a zero, history vide", async () => {
    const owner = await seedAndLogin(
      "career-fresh@e2e.test",
      "password-f",
      "Fresh",
    );
    const team = await createTeam(owner.userId, "Fresh Team", "lizardmen");
    const stats = await get<CareerStatsResponse>(
      `/career-stats/team/${team.teamId}`,
      owner.token,
    );
    expect(stats.record.wins).toBe(0);
    expect(stats.record.losses).toBe(0);
    expect(stats.record.draws).toBe(0);
    expect(stats.record.touchdownsFor).toBe(0);
    expect(stats.record.casualtiesInflicted).toBe(0);
    expect(stats.history.length).toBe(0);
  });
});
