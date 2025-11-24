import { describe, it, expect, beforeAll } from "vitest";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";

const API_PORT = process.env.API_PORT || "18001";
const API_BASE = `http://localhost:${API_PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

describe("Statistiques liées aux matchs locaux", () => {
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let team1Id: string;
  let team2Id: string;
  let localMatchId: string;
  let adminToken: string;

  beforeAll(async () => {
    // Création du premier utilisateur
    const email1 = `coach1_${Date.now()}@example.com`;
    const password1 = "test1234";

    const reg1 = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email1, password: password1, name: "Coach One" }),
    });
    expect(reg1.status).toBe(201);
    const body1: any = await reg1.json();
    user1Token = body1.token;
    user1Id = body1.user.id;

    // Création du deuxième utilisateur
    const email2 = `coach2_${Date.now()}@example.com`;
    const password2 = "test1234";

    const reg2 = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email2, password: password2, name: "Coach Two" }),
    });
    expect(reg2.status).toBe(201);
    const body2: any = await reg2.json();
    user2Token = body2.token;

    // Création d'une équipe pour chaque utilisateur (roster Skaven, 1000k po)
    const team1Res = await fetch(`${API_BASE}/team/create-from-roster`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        name: "Test Skavens 1",
        roster: "skaven",
        teamValue: 1000,
      }),
    });
    expect(team1Res.status).toBe(201);
    const team1Body: any = await team1Res.json();
    team1Id = team1Body.team.id;

    const team2Res = await fetch(`${API_BASE}/team/create-from-roster`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user2Token}`,
      },
      body: JSON.stringify({
        name: "Test Skavens 2",
        roster: "skaven",
        teamValue: 1000,
      }),
    });
    expect(team2Res.status).toBe(201);
    const team2Body: any = await team2Res.json();
    team2Id = team2Body.team.id;

    // Création d'un match local entre les deux équipes
    const lmRes = await fetch(`${API_BASE}/local-match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        name: "Local Test Match",
        teamAId: team1Id,
        teamBId: team2Id,
        isPublic: true,
      }),
    });
    expect(lmRes.status).toBe(201);
    const lmBody: any = await lmRes.json();
    localMatchId = lmBody.localMatch.id;

    // Terminer le match avec un score 2-1 pour l'équipe 1
    const completeRes = await fetch(`${API_BASE}/local-match/${localMatchId}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        scoreTeamA: 2,
        scoreTeamB: 1,
      }),
    });
    expect(completeRes.status).toBe(200);

    // Générer un token admin pour interroger les routes /admin
    adminToken = jwt.sign(
      { sub: user1Id, role: "admin", roles: ["admin"] },
      JWT_SECRET,
      { expiresIn: "1d" },
    );
  }, 60000);

  it("expose les statistiques de matchs locaux dans /admin/stats", async () => {
    const res = await fetch(`${API_BASE}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const json: any = await res.json();

    expect(json.localMatches).toBeTruthy();
    expect(json.localMatches.total).toBeGreaterThanOrEqual(1);
    expect(json.localMatches.completed).toBeGreaterThanOrEqual(1);
  }, 20000);

  it("retourne le compteur createdLocalMatches dans /auth/me", async () => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    expect(res.status).toBe(200);
    const json: any = await res.json();

    expect(json.user).toBeTruthy();
    expect(json.user._count).toBeTruthy();
    expect(json.user._count.createdLocalMatches).toBeGreaterThanOrEqual(1);
  }, 20000);

  it("retourne les statistiques de matchs locaux dans /team/:id", async () => {
    const res = await fetch(`${API_BASE}/team/${team1Id}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    expect(res.status).toBe(200);
    const json: any = await res.json();

    expect(json.team).toBeTruthy();
    expect(json.localMatchStats).toBeTruthy();

    const stats = json.localMatchStats;
    expect(stats.total).toBeGreaterThanOrEqual(1);
    expect(stats.completed).toBeGreaterThanOrEqual(1);
    // Avec notre match 2-1, l'équipe 1 a au moins une victoire et un différentiel positif
    expect(stats.wins).toBeGreaterThanOrEqual(1);
    expect(stats.touchdownsFor).toBeGreaterThanOrEqual(2);
    expect(stats.touchdownsAgainst).toBeGreaterThanOrEqual(1);
    expect(stats.touchdownDiff).toBe(stats.touchdownsFor - stats.touchdownsAgainst);
  }, 20000);
});


