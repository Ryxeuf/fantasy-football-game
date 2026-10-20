/**
 * E2E API — deux réglages de commissaire de coupe, sur une vraie base :
 *
 *   1. RETRAIT d'une équipe par le commissaire : possible inscriptions closes
 *      et en cours de coupe, bloqué par une rencontre ouverte ; les matchs
 *      joués restent au classement (ligne `withdrawn`), l'équipe n'est plus
 *      appariée à la ronde suivante.
 *   2. DOUBLE VALIDATION des feuilles : sous l'option, le commissaire ne
 *      valide qu'après la soumission des deux coachs (hors forfaitaire).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawPatch, rawPost, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface PairingDTO {
  id: string;
  status: string;
  homeTeam: { id: string; ownerId: string };
  awayTeam: { id: string; ownerId: string } | null;
}
interface CupDTO {
  cup: {
    id: string;
    participantCount: number;
    participants: Array<{ id: string }>;
    sheetDoubleValidation?: boolean;
    rounds: Array<{ id: string; roundNumber: number; pairings: PairingDTO[] }>;
    standings: Array<{
      teamId: string;
      matchesPlayed: number;
      wins: number;
      withdrawn?: boolean;
    }>;
  };
}
interface SheetDTO {
  sheet: { status: string };
  competitionRules?: { doubleValidation?: boolean };
  teams: {
    home: { players: Array<{ id: string }> } | null;
    away: { players: Array<{ id: string }> } | null;
  };
}

type Coach = Awaited<ReturnType<typeof seedAndLogin>>;

async function coachesWithTeams(prefix: string, count: number) {
  const coaches: Array<Coach & { teamId: string }> = [];
  for (let i = 0; i < count; i += 1) {
    const coach = await seedAndLogin(
      `${prefix}-${i}@cupremoval.test`,
      "pwd",
      `${prefix} Coach ${i}`,
    );
    const team = await createTeam(
      coach.userId,
      `${prefix} Team ${i}`,
      i % 2 === 0 ? "orc" : "skaven",
    );
    coaches.push({ ...coach, teamId: team.teamId });
  }
  return coaches;
}

async function openCup(
  commish: Coach,
  coaches: ReadonlyArray<Coach & { teamId: string }>,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const created = await post<{ cup: { id: string } }>("/cup", commish.token, {
    name: "Coupe e2e",
    ruleset: "season_3",
    ...extra,
  });
  for (const coach of coaches) {
    await post(`/cup/${created.cup.id}/register`, coach.token, {
      teamId: coach.teamId,
    });
  }
  await post(`/cup/${created.cup.id}/validate`, commish.token, {});
  return created.cup.id;
}

function tokenOf(
  coaches: ReadonlyArray<Coach & { teamId: string }>,
  ownerId: string,
): string {
  return coaches.find((c) => c.userId === ownerId)!.token;
}

describe("E2E API — retrait d'une équipe par le commissaire", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("retire l'équipe d'un coach une fois les inscriptions closes ; pas le coach lui-même", async () => {
    const [commish, rival, third] = await coachesWithTeams("rm1", 3);
    const cupId = await openCup(commish, [commish, rival, third]);

    // Le propriétaire ne peut plus se retirer seul : la coupe est validée.
    const selfRemoval = await rawPost(`/cup/${cupId}/unregister`, rival.token, {
      teamId: rival.teamId,
    });
    expect(selfRemoval.status).toBe(400);

    // Un tiers ne retire pas l'équipe d'un autre.
    const thirdParty = await rawPost(`/cup/${cupId}/unregister`, third.token, {
      teamId: rival.teamId,
    });
    expect(thirdParty.status).toBe(403);

    // Le commissaire, si.
    const removed = await post<CupDTO>(`/cup/${cupId}/unregister`, commish.token, {
      teamId: rival.teamId,
    });
    expect(removed.cup.participantCount).toBe(2);
    expect(removed.cup.participants.map((p) => p.id)).not.toContain(rival.teamId);
  });

  it("bloque sur une rencontre ouverte, puis garde les résultats et n'apparie plus l'équipe", async () => {
    const coaches = await coachesWithTeams("rm2", 4);
    const [commish] = coaches;
    const cupId = await openCup(commish, coaches);
    await post(`/cup/${cupId}/rounds`, commish.token, { system: "random" });

    const round1 = (await get<CupDTO>(`/cup/${cupId}`, commish.token)).cup.rounds[0];
    const [played, other] = round1.pairings;
    const leaver = played.awayTeam!;

    // Rencontre planifiée : le commissaire doit d'abord la régler.
    const blocked = await rawPost(`/cup/${cupId}/unregister`, commish.token, {
      teamId: leaver.id,
    });
    expect(blocked.status).toBe(409);

    // La rencontre se joue (victoire à domicile), l'autre est annulée.
    const base = `/cup/pairings/${played.id}/sheet`;
    const homeToken = tokenOf(coaches, played.homeTeam.ownerId);
    await post(base, homeToken, {});
    const sheet = unwrap(await get<{ data: SheetDTO }>(base, homeToken));
    await post(`${base}/events`, homeToken, {
      kind: "touchdown",
      team: "home",
      actorPlayerId: sheet.teams.home!.players[0].id,
    });
    await post(`${base}/validate`, commish.token, {});
    await post(`/cup/pairings/${other.id}/cancel`, commish.token, {});

    // Retrait en cours de coupe : accepté, le coach n'a plus de rencontre.
    await post(`/cup/${cupId}/unregister`, commish.token, { teamId: leaver.id });

    const after = (await get<CupDTO>(`/cup/${cupId}`, commish.token)).cup;
    const leaverRow = after.standings.find((s) => s.teamId === leaver.id)!;
    expect(leaverRow).toMatchObject({ matchesPlayed: 1, withdrawn: true });
    const winnerRow = after.standings.find((s) => s.teamId === played.homeTeam.id)!;
    expect(winnerRow.wins).toBe(1);
    expect(winnerRow.withdrawn).toBeUndefined();

    // Ronde 2 : trois inscrits, l'équipe retirée n'y figure pas.
    await post(`/cup/${cupId}/rounds/swiss`, commish.token, {});
    const round2 = (await get<CupDTO>(`/cup/${cupId}`, commish.token)).cup.rounds[1];
    const paired = round2.pairings.flatMap((p) =>
      [p.homeTeam.id, p.awayTeam?.id].filter(Boolean),
    );
    expect(paired).toHaveLength(3);
    expect(paired).not.toContain(leaver.id);
  });
});

describe("E2E API — double validation des feuilles de coupe", () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function setup(prefix: string) {
    const coaches = await coachesWithTeams(prefix, 2);
    const [commish] = coaches;
    const cupId = await openCup(commish, coaches, { sheetDoubleValidation: true });
    await post(`/cup/${cupId}/rounds`, commish.token, { system: "random" });
    const cup = (await get<CupDTO>(`/cup/${cupId}`, commish.token)).cup;
    expect(cup.sheetDoubleValidation).toBe(true);
    const pairing = cup.rounds[0].pairings[0];
    return {
      commish,
      base: `/cup/pairings/${pairing.id}/sheet`,
      homeToken: tokenOf(coaches, pairing.homeTeam.ownerId),
      awayToken: tokenOf(coaches, pairing.awayTeam!.ownerId),
    };
  }

  it("attend la soumission des deux coachs avant la validation du commissaire", async () => {
    const ctx = await setup("dv1");
    await post(ctx.base, ctx.homeToken, {});
    const sheet = unwrap(await get<{ data: SheetDTO }>(ctx.base, ctx.homeToken));
    expect(sheet.competitionRules?.doubleValidation).toBe(true);

    expect((await rawPost(`${ctx.base}/validate`, ctx.commish.token, {})).status).toBe(409);

    await post(`${ctx.base}/submit`, ctx.homeToken, {});
    const halfway = await rawPost(`${ctx.base}/validate`, ctx.commish.token, {});
    expect(halfway.status).toBe(409);
    expect(((await halfway.json()) as { error: string }).error).toContain(
      "Double validation",
    );

    await post(`${ctx.base}/submit`, ctx.awayToken, {});
    const validated = unwrap(
      await post<{ data: { sheet: { status: string } } }>(
        `${ctx.base}/validate`,
        ctx.commish.token,
        {},
      ),
    );
    expect(validated.sheet.status).toBe("validated");
  });

  it("n'attend pas le coach forfaitaire", async () => {
    const ctx = await setup("dv2");
    await post(ctx.base, ctx.homeToken, {});
    const forfeit = await rawPatch(`${ctx.base}/pre-match`, ctx.commish.token, {
      forfeitSide: "away",
    });
    expect(forfeit.status).toBe(200);
    await post(`${ctx.base}/submit`, ctx.homeToken, {});

    const validated = unwrap(
      await post<{ data: { sheet: { status: string } } }>(
        `${ctx.base}/validate`,
        ctx.commish.token,
        {},
      ),
    );
    expect(validated.sheet.status).toBe("validated");
  });
});
