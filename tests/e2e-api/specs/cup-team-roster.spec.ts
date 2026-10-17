/**
 * E2E API — fiche de roster d'une équipe inscrite à une coupe.
 *
 * `GET /cup/:id/teams/:teamId/roster-view` sert le roster D'INSCRIPTION (celui
 * que rejoue chaque rencontre) et les statistiques DE LA COUPE, dérivées des
 * feuilles validées. Une équipe non inscrite n'a pas de fiche (404).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawGet, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface RosterView {
  source: "registration" | "live";
  registeredAt: number | null;
  cup: { id: string; name: string };
  team: { id: string; name: string; raceName: string; cupMatchesPlayed: number };
  players: Array<{
    id: string;
    name: string;
    matchesPlayed: number;
    totalTouchdowns: number;
    totalCasualties: number;
  }>;
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

describe("E2E API — roster d'un inscrit de coupe", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("sert le roster d'inscription et les statistiques de la coupe", async () => {
    const commish = await seedAndLogin("ro-a@cuproster.test", "pwd", "Ro A");
    const rival = await seedAndLogin("ro-b@cuproster.test", "pwd", "Ro B");
    const outsider = await seedAndLogin("ro-c@cuproster.test", "pwd", "Ro C");
    const teamA = await createTeam(commish.userId, "Ro Alpha", "orc");
    const teamB = await createTeam(rival.userId, "Ro Bravo", "skaven");
    const teamC = await createTeam(outsider.userId, "Ro Charlie", "lizardmen");

    const { cup } = await post<{ cup: { id: string } }>("/cup", commish.token, {
      name: "Coupe des rosters",
      ruleset: "season_3",
    });
    await post(`/cup/${cup.id}/register`, commish.token, { teamId: teamA.teamId });
    await post(`/cup/${cup.id}/register`, rival.token, { teamId: teamB.teamId });

    // Avant tout match : roster d'inscription, aucune statistique.
    const fresh = unwrap(
      await get<{ data: RosterView }>(
        `/cup/${cup.id}/teams/${teamA.teamId}/roster-view`,
        outsider.token,
      ),
    );
    expect(fresh.source).toBe("registration");
    expect(fresh.registeredAt).not.toBeNull();
    expect(fresh.cup).toEqual({ id: cup.id, name: "Coupe des rosters" });
    expect(fresh.team.name).toBe("Ro Alpha");
    expect(fresh.players.length).toBeGreaterThan(0);
    expect(fresh.team.cupMatchesPlayed).toBe(0);

    // Une rencontre jouée, un touchdown et une élimination saisis puis validés.
    await post(`/cup/${cup.id}/validate`, commish.token, {});
    await post(`/cup/${cup.id}/rounds`, commish.token, { system: "random" });
    const detail = (await get<CupDTO>(`/cup/${cup.id}`, commish.token)).cup;
    const pairing = detail.rounds[0].pairings.find((p) => p.awayTeam !== null)!;
    const tokenByOwner = new Map([
      [commish.userId, commish.token],
      [rival.userId, rival.token],
    ]);
    const homeToken = tokenByOwner.get(pairing.homeTeam.ownerId)!;
    const awayToken = tokenByOwner.get(pairing.awayTeam!.ownerId)!;
    const base = `/cup/pairings/${pairing.id}/sheet`;
    await post(base, homeToken, {});
    const sheet = unwrap(
      await get<{
        data: {
          teams: {
            home: { teamId: string; players: Array<{ id: string }> };
            away: { players: Array<{ id: string }> };
          };
        };
      }>(base, homeToken),
    );
    const scorer = sheet.teams.home.players[0].id;
    await post(`${base}/events`, homeToken, {
      kind: "touchdown",
      team: "home",
      actorPlayerId: scorer,
    });
    await post(`${base}/events`, homeToken, {
      kind: "casualty",
      team: "home",
      actorPlayerId: scorer,
      targetPlayerId: sheet.teams.away.players[0].id,
      causeDetail: "block",
      injurySeverity: "badly_hurt",
    });
    await post(`${base}/submit`, homeToken, {});
    await post(`${base}/submit`, awayToken, {});
    await post(`${base}/validate`, commish.token, {});

    const homeTeamId = sheet.teams.home.teamId;
    const played = unwrap(
      await get<{ data: RosterView }>(
        `/cup/${cup.id}/teams/${homeTeamId}/roster-view`,
        outsider.token,
      ),
    );
    expect(played.team.cupMatchesPlayed).toBe(1);
    const row = played.players.find((p) => p.id === scorer)!;
    expect(row.totalTouchdowns).toBe(1);
    expect(row.totalCasualties).toBe(1);
    expect(row.matchesPlayed).toBe(1);

    // Équipe hors coupe : pas de fiche. Sans compte : refusé.
    const notIn = await rawGet(
      `/cup/${cup.id}/teams/${teamC.teamId}/roster-view`,
      outsider.token,
    );
    expect(notIn.status).toBe(404);
    const anonymous = await rawGet(
      `/cup/${cup.id}/teams/${teamA.teamId}/roster-view`,
      null,
    );
    expect(anonymous.status).toBe(401);
  });
});
