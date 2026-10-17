/**
 * E2E API — statistiques d'une coupe à la demande
 * (`GET /cup/:id/leaderboards?topN=`) : classements joueurs bornés au top N,
 * tops par équipe, dérivés des feuilles validées.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawGet, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface LeaderboardsView {
  topN: number;
  players: { topScorers: Array<{ playerId: string; value: number; teamId: string }> };
  playerCategories: Array<{ key: string }>;
  teams: {
    topScorers: Array<{ teamId: string; value: number; rank: number }>;
    bestDefenses: Array<{ teamId: string; value: number }>;
  };
  teamCategories: Array<{ key: string }>;
}
interface CupDTO {
  cup: {
    rounds: Array<{
      pairings: Array<{
        id: string;
        homeTeam: { id: string; ownerId: string };
        awayTeam: { id: string; ownerId: string } | null;
      }>;
    }>;
  };
}

describe("E2E API — statistiques de coupe", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("sert les tops joueurs et équipes au top N demandé", async () => {
    const a = await seedAndLogin("lb-a@cuplb.test", "pwd", "Lb A");
    const b = await seedAndLogin("lb-b@cuplb.test", "pwd", "Lb B");
    const teamA = await createTeam(a.userId, "Lb Alpha", "orc");
    const teamB = await createTeam(b.userId, "Lb Bravo", "skaven");
    const { cup } = await post<{ cup: { id: string } }>("/cup", a.token, {
      name: "Coupe des stats",
      ruleset: "season_3",
    });
    await post(`/cup/${cup.id}/register`, a.token, { teamId: teamA.teamId });
    await post(`/cup/${cup.id}/register`, b.token, { teamId: teamB.teamId });
    await post(`/cup/${cup.id}/validate`, a.token, {});
    await post(`/cup/${cup.id}/rounds`, a.token, { system: "random" });
    const detail = (await get<CupDTO>(`/cup/${cup.id}`, a.token)).cup;
    const pairing = detail.rounds[0].pairings.find((p) => p.awayTeam !== null)!;
    const tokens = new Map([
      [a.userId, a.token],
      [b.userId, b.token],
    ]);
    const homeToken = tokens.get(pairing.homeTeam.ownerId)!;
    const awayToken = tokens.get(pairing.awayTeam!.ownerId)!;
    const base = `/cup/pairings/${pairing.id}/sheet`;
    await post(base, homeToken, {});
    const sheet = unwrap(
      await get<{ data: { teams: { home: { players: Array<{ id: string }> } } } }>(
        base,
        homeToken,
      ),
    );
    const scorer = sheet.teams.home.players[0].id;
    for (let i = 0; i < 2; i++) {
      await post(`${base}/events`, homeToken, { kind: "touchdown", team: "home", actorPlayerId: scorer });
    }
    await post(`${base}/submit`, homeToken, {});
    await post(`${base}/submit`, awayToken, {});
    await post(`${base}/validate`, a.token, {});

    const view = unwrap(
      await get<{ data: LeaderboardsView }>(`/cup/${cup.id}/leaderboards?topN=3`, b.token),
    );
    expect(view.topN).toBe(3);
    expect(view.players.topScorers[0]).toMatchObject({
      playerId: scorer,
      value: 2,
      teamId: pairing.homeTeam.id,
    });
    expect(view.teams.topScorers[0]).toMatchObject({ teamId: pairing.homeTeam.id, value: 2, rank: 1 });
    // La meilleure défense est l'équipe qui n'a rien encaissé.
    expect(view.teams.bestDefenses[0]).toMatchObject({ teamId: pairing.homeTeam.id, value: 0 });
    expect(view.playerCategories.map((c) => c.key)).toContain("topScorers");
    expect(view.teamCategories.map((c) => c.key)).toContain("bestDefenses");

    // Top N borné côté serveur.
    const clamped = unwrap(
      await get<{ data: LeaderboardsView }>(`/cup/${cup.id}/leaderboards?topN=999`, b.token),
    );
    expect(clamped.topN).toBe(50);

    expect((await rawGet(`/cup/nope/leaderboards`, b.token)).status).toBe(404);
    expect((await rawGet(`/cup/${cup.id}/leaderboards`, null)).status).toBe(401);
  });
});
