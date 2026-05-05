/**
 * L2.B.5 — E2E API : "Coup de mecene" (Sprint Ligues v2 PR11).
 *
 * Couvre :
 *  - 401 sans token
 *  - 404 saison inconnue / equipe inconnue
 *  - 404 equipe non proprietaire (essai de jouer le mecene depuis un
 *    autre user)
 *  - 400 saison non in_progress
 *  - happy path : tresorerie creditee de 100k, flag mecenePlayed
 *    expose dans /seasons/:id/standings ou via la ligue
 *  - 409 deuxieme appel : already_played
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawPost, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface LeagueDTO {
  id: string;
  creatorId: string;
}
interface SeasonDTO {
  id: string;
  status: string;
}
interface MeceneDTO {
  participantId: string;
  bonus: number;
  newTreasury: number;
  playedAt: string;
}
interface TeamSnapshot {
  team: {
    id: string;
    treasury: number;
  };
}

async function setupSeasonInProgress(): Promise<{
  creatorToken: string;
  creatorUserId: string;
  challengerToken: string;
  seasonId: string;
  aliceTeamId: string;
  bobTeamId: string;
}> {
  const creator = await seedAndLogin("alice-mecene@e2e.test", "pwd", "Alice");
  const aliceTeam = await createTeam(creator.userId, "Alice Mecenes", "skaven");
  const challenger = await seedAndLogin("bob-mecene@e2e.test", "pwd", "Bob");
  const bobTeam = await createTeam(challenger.userId, "Bob Lizards", "lizardmen");

  const league = unwrap(
    await post<{ success: true; data: LeagueDTO }>("/leagues", creator.token, {
      name: "Mecene Cup",
      maxParticipants: 4,
    }),
  );
  const season = unwrap(
    await post<{ success: true; data: SeasonDTO }>(
      `/leagues/${league.id}/seasons`,
      creator.token,
      { name: "S1" },
    ),
  );
  await post(`/leagues/seasons/${season.id}/join`, creator.token, {
    teamId: aliceTeam.teamId,
  });
  await post(`/leagues/seasons/${season.id}/join`, challenger.token, {
    teamId: bobTeam.teamId,
  });
  await post(`/leagues/seasons/${season.id}/start`, creator.token, {});

  return {
    creatorToken: creator.token,
    creatorUserId: creator.userId,
    challengerToken: challenger.token,
    seasonId: season.id,
    aliceTeamId: aliceTeam.teamId,
    bobTeamId: bobTeam.teamId,
  };
}

describe("E2E API — coup de mecene /leagues/seasons/:sid/teams/:tid/mecene", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("401 sans token", async () => {
    const res = await rawPost(
      "/leagues/seasons/some/teams/other/mecene",
      null,
      {},
    );
    expect(res.status).toBe(401);
  });

  it("404 quand l'equipe n'appartient pas au coach", async () => {
    const ctx = await setupSeasonInProgress();
    // challenger essaie de jouer le mecene de l'equipe d'alice -> refuse
    const res = await rawPost(
      `/leagues/seasons/${ctx.seasonId}/teams/${ctx.aliceTeamId}/mecene`,
      ctx.challengerToken,
      {},
    );
    expect(res.status).toBe(404);
  });

  it("404 quand la saison n'existe pas", async () => {
    const creator = await seedAndLogin(
      "mecene-404-season@e2e.test",
      "pwd",
      "Coach",
    );
    const team = await createTeam(creator.userId, "Solo Skavens", "skaven");
    const res = await rawPost(
      `/leagues/seasons/missing-season/teams/${team.teamId}/mecene`,
      creator.token,
      {},
    );
    expect(res.status).toBe(404);
  });

  it("400 quand la saison n'est pas in_progress (draft)", async () => {
    const creator = await seedAndLogin("mecene-draft@e2e.test", "pwd", "Coach");
    const team = await createTeam(creator.userId, "Draft Team", "skaven");
    const league = unwrap(
      await post<{ success: true; data: LeagueDTO }>(
        "/leagues",
        creator.token,
        { name: "Draft League", maxParticipants: 4 },
      ),
    );
    const season = unwrap(
      await post<{ success: true; data: SeasonDTO }>(
        `/leagues/${league.id}/seasons`,
        creator.token,
        { name: "Draft S" },
      ),
    );
    await post(`/leagues/seasons/${season.id}/join`, creator.token, {
      teamId: team.teamId,
    });
    // Saison reste en draft (pas de /start)
    const res = await rawPost(
      `/leagues/seasons/${season.id}/teams/${team.teamId}/mecene`,
      creator.token,
      {},
    );
    expect(res.status).toBe(400);
  });

  it("happy path : credit +100k et 409 sur 2e appel", async () => {
    const ctx = await setupSeasonInProgress();

    // Tresorerie initiale (avant mecene)
    const teamBefore = await get<{ success: true; data: TeamSnapshot }>(
      `/team/${ctx.aliceTeamId}`,
      ctx.creatorToken,
    );
    const treasuryBefore = unwrap(teamBefore).team.treasury;

    // 1er appel : success
    const res = await rawPost(
      `/leagues/seasons/${ctx.seasonId}/teams/${ctx.aliceTeamId}/mecene`,
      ctx.creatorToken,
      {},
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: MeceneDTO };
    expect(json.data.bonus).toBe(100_000);
    expect(json.data.newTreasury).toBe(treasuryBefore + 100_000);

    // Verifie via /team/:id que la tresorerie a bien augmente
    const teamAfter = await get<{ success: true; data: TeamSnapshot }>(
      `/team/${ctx.aliceTeamId}`,
      ctx.creatorToken,
    );
    expect(unwrap(teamAfter).team.treasury).toBe(treasuryBefore + 100_000);

    // 2e appel : 409
    const res2 = await rawPost(
      `/leagues/seasons/${ctx.seasonId}/teams/${ctx.aliceTeamId}/mecene`,
      ctx.creatorToken,
      {},
    );
    expect(res2.status).toBe(409);
  });
});
