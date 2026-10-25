/**
 * E2E API — le Fan Dévoué OFFERT est une règle de LIGUE, de bout en bout sur
 * une vraie base.
 *
 *   1. construction (`POST /team/build`) : 0 fan par défaut, chaque fan
 *      facturé, `leagueFreeFan = false` ;
 *   2. inscription en ligue : +1 fan, journalisé ; retrait : −1 fan ;
 *      réinscription : +1 à nouveau ;
 *   3. suppression par le commissaire et suppression de la ligue reprennent
 *      le fan ;
 *   4. équipe déjà au plafond : le prix d'un fan en trésorerie, rendu au
 *      retrait ;
 *   5. équipe construite pour une coupe : aucun fan offert ;
 *   6. équipe historique (marqueur absent) : rien n'est ajouté.
 *
 * Fixtures `/__test/seed-rosters` : roster `goblin` (Trois-quart Gobelin à
 * 40 000 po, Ligue régionale « badlands_brawl »). Config staff par défaut du
 * moteur : Fan Dévoué à 5 000 po, plafond 6.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawDelete, rawPost, resetDb, unwrap } from "../helpers/api";
import { createTeam, seedAndLogin, type Coach } from "../helpers/factories";

const FAN_COST = 5_000;

interface TeamDetail {
  team: {
    id: string;
    treasury: number;
    dedicatedFans: number;
    leagueFreeFan: boolean | null;
    budgetSummary?: { dedicatedFansCost: number };
  };
}
interface BuildResponse {
  team: { id: string };
}
interface JournalResponse {
  entries: Array<{ action: string }>;
}

async function buildGoblins(
  coach: Pick<Coach, "token">,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const built = unwrap(
    await post<{ data: BuildResponse }>("/team/build", coach.token, {
      name,
      roster: "goblin",
      ruleset: "season_3",
      format: "bb11",
      regionalLeague: "badlands_brawl",
      choices: [{ key: "goblin_gobelin", count: 11 }],
      ...extra,
    }),
  );
  return built.team.id;
}

async function team(coach: Pick<Coach, "token">, teamId: string) {
  return unwrap(await get<{ data: TeamDetail }>(`/team/${teamId}`, coach.token))
    .team;
}

async function leagueWithSeason(coach: Pick<Coach, "token">, name: string) {
  const league = unwrap(
    await post<{ data: { id: string } }>("/leagues", coach.token, { name }),
  );
  const season = unwrap(
    await post<{ data: { id: string } }>(
      `/leagues/${league.id}/seasons`,
      coach.token,
      { name: "Saison 1" },
    ),
  );
  return { leagueId: league.id, seasonId: season.id };
}

async function join(coach: Pick<Coach, "token">, seasonId: string, teamId: string) {
  const res = await rawPost(`/leagues/seasons/${seasonId}/join`, coach.token, {
    teamId,
  });
  expect(res.status).toBe(201);
}

async function leave(coach: Pick<Coach, "token">, seasonId: string, teamId: string) {
  const res = await rawPost(`/leagues/seasons/${seasonId}/leave`, coach.token, {
    teamId,
  });
  expect(res.status).toBe(200);
}

describe("E2E API — le Fan Dévoué offert est réservé aux équipes de ligue", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("construction : 0 fan par défaut, chaque fan est facturé", async () => {
    const coach = await seedAndLogin("fans-a@e2e.test", "pwd", "Fans A");

    const noFans = await team(coach, await buildGoblins(coach, "Sans fans"));
    expect(noFans.dedicatedFans).toBe(0);
    expect(noFans.leagueFreeFan).toBe(false);

    const twoFans = await team(
      coach,
      await buildGoblins(coach, "Deux fans", { dedicatedFans: 2 }),
    );
    expect(twoFans.dedicatedFans).toBe(2);
    expect(twoFans.budgetSummary?.dedicatedFansCost).toBe(2 * FAN_COST);
    // L'or non dépensé va en trésorerie : deux fans payés = 10 000 po de moins.
    expect(noFans.treasury - twoFans.treasury).toBe(2 * FAN_COST);
  });

  it("inscription : +1 fan journalisé ; retrait : repris ; réinscription : rendu", async () => {
    const coach = await seedAndLogin("fans-b@e2e.test", "pwd", "Fans B");
    const teamId = await buildGoblins(coach, "Les Supporters", { dedicatedFans: 2 });
    const { seasonId } = await leagueWithSeason(coach, "Ligue des fans");

    await join(coach, seasonId, teamId);
    let current = await team(coach, teamId);
    expect(current.dedicatedFans).toBe(3);
    expect(current.leagueFreeFan).toBe(true);
    // En ligue, le fan offert ne se paie pas : seuls les 2 achetés coûtent.
    expect(current.budgetSummary?.dedicatedFansCost).toBe(2 * FAN_COST);

    const journal = unwrap(
      await get<{ data: JournalResponse }>(`/team/${teamId}/journal`, coach.token),
    );
    expect(journal.entries.map((e) => e.action)).toContain(
      "team.league_free_fan.granted",
    );

    await leave(coach, seasonId, teamId);
    current = await team(coach, teamId);
    expect(current.dedicatedFans).toBe(2);
    expect(current.leagueFreeFan).toBe(false);

    const other = await leagueWithSeason(coach, "Autre ligue");
    await join(coach, other.seasonId, teamId);
    current = await team(coach, teamId);
    expect(current.dedicatedFans).toBe(3);
    expect(current.leagueFreeFan).toBe(true);
  });

  it("suppression par le commissaire puis suppression de la ligue : le fan est repris", async () => {
    const commish = await seedAndLogin("fans-c@e2e.test", "pwd", "Fans C");
    const teamId = await buildGoblins(commish, "Les Éphémères");

    const first = await leagueWithSeason(commish, "Ligue supprimée");
    await join(commish, first.seasonId, teamId);
    expect((await team(commish, teamId)).dedicatedFans).toBe(1);

    const removed = await rawDelete(
      `/leagues/${first.leagueId}/seasons/${first.seasonId}/teams/${teamId}`,
      commish.token,
    );
    expect(removed.status).toBe(200);
    let current = await team(commish, teamId);
    expect(current.dedicatedFans).toBe(0);
    expect(current.leagueFreeFan).toBe(false);

    const second = await leagueWithSeason(commish, "Ligue effacée");
    await join(commish, second.seasonId, teamId);
    expect((await team(commish, teamId)).dedicatedFans).toBe(1);

    const deleted = await rawDelete(`/leagues/${second.leagueId}`, commish.token);
    expect(deleted.status).toBe(200);
    current = await team(commish, teamId);
    expect(current.dedicatedFans).toBe(0);
    expect(current.leagueFreeFan).toBe(false);
  });

  it("équipe au plafond : le prix d'un fan en trésorerie, rendu au retrait", async () => {
    const coach = await seedAndLogin("fans-d@e2e.test", "pwd", "Fans D");
    const teamId = await buildGoblins(coach, "Les Foules", { dedicatedFans: 6 });
    const before = await team(coach, teamId);
    const { seasonId } = await leagueWithSeason(coach, "Ligue pleine");

    await join(coach, seasonId, teamId);
    let current = await team(coach, teamId);
    expect(current.dedicatedFans).toBe(6);
    expect(current.treasury).toBe(before.treasury + FAN_COST);
    expect(current.leagueFreeFan).toBe(true);

    await leave(coach, seasonId, teamId);
    current = await team(coach, teamId);
    expect(current.dedicatedFans).toBe(6);
    expect(current.treasury).toBe(before.treasury);
    expect(current.leagueFreeFan).toBe(false);
  });

  it("équipe construite pour une coupe : aucun fan offert", async () => {
    const coach = await seedAndLogin("fans-e@e2e.test", "pwd", "Fans E");
    const created = await post<{ cup: { id: string } }>("/cup", coach.token, {
      name: "Coupe sans fans",
      ruleset: "season_3",
      format: "bb11",
    });
    const teamId = await buildGoblins(coach, "Les Coupables", {
      cupId: created.cup.id,
      dedicatedFans: 1,
    });
    const current = await team(coach, teamId);
    expect(current.dedicatedFans).toBe(1);
    expect(current.leagueFreeFan).toBe(false);
    expect(current.budgetSummary?.dedicatedFansCost).toBe(FAN_COST);
  });

  it("équipe historique (marqueur absent) : l'inscription n'ajoute rien", async () => {
    const coach = await seedAndLogin("fans-f@e2e.test", "pwd", "Fans F");
    const legacy = await createTeam(coach.userId, "Les Anciens", "skaven");
    const { seasonId } = await leagueWithSeason(coach, "Ligue historique");

    const before = await team(coach, legacy.teamId);
    expect(before.leagueFreeFan).toBeNull();
    await join(coach, seasonId, legacy.teamId);
    const after = await team(coach, legacy.teamId);
    expect(after.dedicatedFans).toBe(before.dedicatedFans);
    expect(after.leagueFreeFan).toBeNull();
  });
});
