/**
 * E2E API — feuille de match de COUPE, de bout en bout sur une vraie base.
 *
 * Verrouille les deux moitiés de la promesse « une coupe se gère comme une
 * ligue » :
 *
 *   1. la saisie est la MÊME : ouverture de la feuille, évènements,
 *      soumission des deux coachs, validation du commissaire, invalidation ;
 *   2. les EFFETS ne le sont pas : une coupe se joue en résurrection — aucun
 *      PSP, aucune blessure, aucune mort, aucun gain d'or, aucun fan. Seuls
 *      le score et le classement bougent.
 *
 * Couvre aussi la matérialisation du résultat (le classement d'une coupe est
 * dérivé de ses matchs) et son retrait à l'invalidation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawPost, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface SheetPlayer {
  id: string;
  number: number;
  name: string;
  spp: number;
  dead: boolean;
  missNextMatch: boolean;
}
interface SheetResponse {
  sheet: { id: string; status: string };
  summary: { scoreHome: number; scoreAway: number };
  competitionKind?: string;
  competitionRules?: { sppEnabled: boolean; economyEnabled: boolean };
  leagueId?: string;
  teams: {
    home: { teamId: string; players: SheetPlayer[] } | null;
    away: { teamId: string; players: SheetPlayer[] } | null;
  };
}
interface CupDTO {
  cup: {
    id: string;
    status: string;
    rounds: Array<{
      id: string;
      roundNumber: number;
      status: string;
      pairings: Array<{
        id: string;
        status: string;
        homeTeam: { id: string; ownerId: string };
        awayTeam: { id: string; ownerId: string } | null;
        localMatch: { id: string; scoreTeamA: number | null } | null;
      }>;
    }>;
    standings: Array<{
      teamId: string;
      wins: number;
      losses: number;
      matchesPlayed: number;
      touchdownsFor: number;
      totalPoints: number;
    }>;
  };
}
interface TeamDTO {
  team: {
    treasury: number;
    dedicatedFans: number;
    players: Array<{
      id: string;
      spp: number;
      dead: boolean;
      missNextMatch: boolean;
    }>;
  };
}

async function setupCupPairing(prefix: string) {
  const commish = await seedAndLogin(`${prefix}-a@cupsheet.test`, "pwd", `${prefix} A`);
  const rival = await seedAndLogin(`${prefix}-b@cupsheet.test`, "pwd", `${prefix} B`);
  const teamA = await createTeam(commish.userId, `${prefix} Alpha`, "orc");
  const teamB = await createTeam(rival.userId, `${prefix} Bravo`, "skaven");

  const created = await post<{ cup: { id: string } }>("/cup", commish.token, {
    name: `${prefix} Coupe`,
    ruleset: "season_3",
  });
  const cupId = created.cup.id;
  await post(`/cup/${cupId}/register`, commish.token, { teamId: teamA.teamId });
  await post(`/cup/${cupId}/register`, rival.token, { teamId: teamB.teamId });
  await post(`/cup/${cupId}/validate`, commish.token, {});
  await post(`/cup/${cupId}/rounds`, commish.token, { system: "random" });

  const cup = (await get<CupDTO>(`/cup/${cupId}`, commish.token)).cup;
  const pairing = cup.rounds[0].pairings.find((p) => p.awayTeam !== null)!;
  const tokenByOwner = new Map([
    [commish.userId, commish.token],
    [rival.userId, rival.token],
  ]);
  return {
    cupId,
    commish,
    rival,
    teamA: teamA.teamId,
    teamB: teamB.teamId,
    pairing,
    homeToken: tokenByOwner.get(pairing.homeTeam.ownerId)!,
    awayToken: tokenByOwner.get(pairing.awayTeam!.ownerId)!,
  };
}

describe("E2E API — feuille de match de coupe", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("se saisit comme une ligue et n'écrit rien sur les équipes", async () => {
    const ctx = await setupCupPairing("cs1");
    const base = `/cup/pairings/${ctx.pairing.id}/sheet`;

    // Ouverture de la feuille : accessible aux deux coachs.
    await post(base, ctx.homeToken, {});
    const sheet = unwrap(await get<{ data: SheetResponse }>(base, ctx.homeToken));
    expect(sheet.competitionKind).toBe("cup");
    expect(sheet.competitionRules?.sppEnabled).toBe(false);
    expect(sheet.competitionRules?.economyEnabled).toBe(false);
    expect(sheet.leagueId).toBe(ctx.cupId);

    const home = sheet.teams.home!;
    const away = sheet.teams.away!;
    const scorer = home.players[0];
    const victim = away.players[0];

    // État des équipes AVANT, pour prouver qu'il ne bouge pas.
    const beforeHome = unwrap(
      await get<{ data: TeamDTO }>(`/team/${home.teamId}`, ctx.homeToken),
    ).team;
    const beforeAway = unwrap(
      await get<{ data: TeamDTO }>(`/team/${away.teamId}`, ctx.awayToken),
    ).team;

    // Deux touchdowns et une sortie : de quoi remplir un score et des PSP.
    // (Pas de `half`/`turn` : le miroir SQLite stocke `meta` en `String?`,
    // il refuse l'objet que le serveur écrit en PostgreSQL. La valeur par
    // défaut mi-temps 1 / tour 1 est couverte en test unitaire.)
    await post(`${base}/events`, ctx.homeToken, {
      kind: "touchdown",
      team: "home",
      actorPlayerId: scorer.id,
    });
    await post(`${base}/events`, ctx.homeToken, {
      kind: "touchdown",
      team: "home",
      actorPlayerId: scorer.id,
    });
    await post(`${base}/events`, ctx.homeToken, {
      kind: "casualty",
      team: "home",
      actorPlayerId: home.players[1].id,
      targetPlayerId: victim.id,
      causeDetail: "block",
      injurySeverity: "dead",
    });

    // Soumission des deux coachs, puis validation du commissaire.
    await post(`${base}/submit`, ctx.homeToken, {});
    await post(`${base}/submit`, ctx.awayToken, {});
    const validated = unwrap(
      await post<{
        data: { sheet: { status: string }; effects: { applied: boolean } };
      }>(`${base}/validate`, ctx.commish.token, {}),
    );
    expect(validated.sheet.status).toBe("validated");
    expect(validated.effects.applied).toBe(true);

    // Le classement de la coupe voit le résultat…
    const cup = (await get<CupDTO>(`/cup/${ctx.cupId}`, ctx.commish.token)).cup;
    const homeRow = cup.standings.find((s) => s.teamId === home.teamId)!;
    const awayRow = cup.standings.find((s) => s.teamId === away.teamId)!;
    expect(homeRow.wins).toBe(1);
    expect(homeRow.touchdownsFor).toBe(2);
    expect(awayRow.losses).toBe(1);
    expect(homeRow.totalPoints).toBeGreaterThan(awayRow.totalPoints);
    const settled = cup.rounds[0].pairings.find((p) => p.id === ctx.pairing.id)!;
    expect(settled.status).toBe("played");
    expect(settled.localMatch).not.toBeNull();

    // …mais AUCUNE équipe n'a bougé : ni PSP, ni mort, ni absence, ni or,
    // ni fans. C'est toute la différence avec une ligue.
    const afterHome = unwrap(
      await get<{ data: TeamDTO }>(`/team/${home.teamId}`, ctx.homeToken),
    ).team;
    const afterAway = unwrap(
      await get<{ data: TeamDTO }>(`/team/${away.teamId}`, ctx.awayToken),
    ).team;
    expect(afterHome.treasury).toBe(beforeHome.treasury);
    expect(afterAway.treasury).toBe(beforeAway.treasury);
    expect(afterHome.dedicatedFans).toBe(beforeHome.dedicatedFans);
    expect(afterHome.players.map((p) => p.spp)).toEqual(
      beforeHome.players.map((p) => p.spp),
    );
    expect(afterAway.players.some((p) => p.dead)).toBe(false);
    expect(afterAway.players.some((p) => p.missNextMatch)).toBe(false);
  });

  it("s'invalide et rend le classement à son état d'avant", async () => {
    const ctx = await setupCupPairing("cs2");
    const base = `/cup/pairings/${ctx.pairing.id}/sheet`;
    await post(base, ctx.homeToken, {});
    const sheet = unwrap(await get<{ data: SheetResponse }>(base, ctx.homeToken));

    await post(`${base}/events`, ctx.homeToken, {
      kind: "touchdown",
      team: "home",
      actorPlayerId: sheet.teams.home!.players[0].id,
    });
    await post(`${base}/submit`, ctx.homeToken, {});
    await post(`${base}/submit`, ctx.awayToken, {});
    await post(`${base}/validate`, ctx.commish.token, {});

    const window = unwrap(
      await get<{ data: { ok: boolean } }>(
        `${base}/can-invalidate`,
        ctx.commish.token,
      ),
    );
    expect(window.ok).toBe(true);

    await post(`${base}/invalidate`, ctx.commish.token, { reason: "erreur de saisie" });

    const cup = (await get<CupDTO>(`/cup/${ctx.cupId}`, ctx.commish.token)).cup;
    const row = cup.standings.find((s) => s.teamId === sheet.teams.home!.teamId)!;
    expect(row.matchesPlayed).toBe(0);
    expect(row.wins).toBe(0);
    const reopened = cup.rounds[0].pairings.find((p) => p.id === ctx.pairing.id)!;
    expect(reopened.status).toBe("scheduled");
    expect(reopened.localMatch).toBeNull();
  });

  it("réserve la validation au commissaire", async () => {
    const ctx = await setupCupPairing("cs3");
    const base = `/cup/pairings/${ctx.pairing.id}/sheet`;
    await post(base, ctx.homeToken, {});
    await post(`${base}/submit`, ctx.homeToken, {});
    await post(`${base}/submit`, ctx.awayToken, {});

    const res = await rawPost(`${base}/validate`, ctx.rival.token, {});
    expect(res.status).toBe(403);
  });

  it("refuse une feuille sur une rencontre inconnue", async () => {
    const ctx = await setupCupPairing("cs4");
    const res = await rawPost(
      `/cup/pairings/nexistepas/sheet`,
      ctx.commish.token,
      {},
    );
    expect(res.status).toBe(404);
  });
});
