/**
 * E2E API — pronostics de COUPE, de la portée au bilan de ronde.
 *
 * Mêmes règles que la ligue (module pur partagé), sur les rencontres d'une
 * coupe et sur une vraie base :
 *
 *  1. portée « membres » par défaut d'une coupe neuve, garde-fous
 *     d'éligibilité (propre match, non-membre) ;
 *  2. rien des autres avant la clôture, clôture PERSISTÉE au premier
 *     évènement de la feuille ;
 *  3. règlement à la validation (3 pts l'issue, +2 le score exact),
 *     invalidation qui remet en attente sans rouvrir, bilan de ronde ;
 *  4. portée réglable par le commissaire seul, « tout le monde » ouvrant aux
 *     Tribunes, « off » qui ne sert plus rien.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawPatch, rawPost, rawPut, resetDb, unwrap } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface CupPairingDTO {
  id: string;
  homeTeam: { id: string; ownerId: string };
  awayTeam: { id: string; ownerId: string } | null;
}
interface CupDTO {
  cup: {
    id: string;
    predictionsScope?: string;
    rounds: Array<{ id: string; pairings: CupPairingDTO[] }>;
  };
}
interface PairingPredictionsDTO {
  id: string;
  closed: boolean;
  eligibility: string;
  myPrediction: { pick: string; grade: string; points: number } | null;
  predictions: Array<{ userId: string; pick: string }> | null;
  distribution: { home: number; draw: number; away: number; total: number } | null;
}
interface CupPredictionsDTO {
  scope: string;
  viewer: { isMember: boolean; group: string | null };
  rounds: Array<{ id: string; pairings: PairingPredictionsDTO[] }>;
}
interface LeaderboardDTO {
  coach: Array<{ userId: string; points: number; correct: number; exact: number }>;
  stands: Array<{ userId: string; points: number }>;
}

describe("E2E API — pronostics de coupe", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("de la portée par défaut au bilan de ronde", async () => {
    const coaches = await Promise.all(
      ["a", "b", "c", "d"].map((k) => seedAndLogin(`${k}@cuppred.test`, "pwd", `Coach ${k}`)),
    );
    const spectator = await seedAndLogin("s@cuppred.test", "pwd", "Tribune");
    const rosters = ["orc", "skaven", "lizardmen", "orc"] as const;
    const teams = await Promise.all(
      coaches.map((c, i) => createTeam(c.userId, `Pr ${i}`, rosters[i])),
    );
    const commish = coaches[0];
    const created = await post<{ cup: { id: string; predictionsScope: string } }>(
      "/cup",
      commish.token,
      { name: "Coupe des oracles", ruleset: "season_3" },
    );
    const cupId = created.cup.id;
    // Coupe neuve : pronostics ouverts aux membres.
    expect(created.cup.predictionsScope).toBe("members");

    for (let i = 0; i < 4; i++) {
      await post(`/cup/${cupId}/register`, coaches[i].token, { teamId: teams[i].teamId });
    }
    await post(`/cup/${cupId}/validate`, commish.token, {});
    await post(`/cup/${cupId}/rounds`, commish.token, { system: "random" });
    const detail = (await get<CupDTO>(`/cup/${cupId}`, commish.token)).cup;
    expect(detail.predictionsScope).toBe("members");
    const [p1, p2] = detail.rounds[0].pairings;
    const tokenOf = new Map(coaches.map((c) => [c.userId, c.token]));
    // Un coach qui ne joue PAS p1 (il joue p2) pronostique p1.
    const outsider = coaches.find(
      (c) => c.userId === p2.homeTeam.ownerId,
    )!;
    const p1Home = tokenOf.get(p1.homeTeam.ownerId)!;
    const p1Away = tokenOf.get(p1.awayTeam!.ownerId)!;

    // 1. Éligibilité.
    const view = unwrap(
      await get<{ data: CupPredictionsDTO }>(`/cup/${cupId}/predictions`, outsider.token),
    );
    expect(view.scope).toBe("members");
    expect(view.viewer).toMatchObject({ isMember: true, group: "coach" });
    const byId = new Map(view.rounds[0].pairings.map((p) => [p.id, p]));
    expect(byId.get(p1.id)!.eligibility).toBe("ok");
    expect(byId.get(p2.id)!.eligibility).toBe("own-match");

    const ownMatch = await rawPut(`/cup/pairings/${p2.id}/prediction`, outsider.token, {
      pick: "home",
    });
    expect(ownMatch.status).toBe(403);
    const notMember = await rawPut(`/cup/pairings/${p1.id}/prediction`, spectator.token, {
      pick: "home",
    });
    expect(notMember.status).toBe(403);

    const saved = await rawPut(`/cup/pairings/${p1.id}/prediction`, outsider.token, {
      pick: "home",
      homeScore: 1,
      awayScore: 0,
    });
    expect(saved.status).toBe(200);
    // Le commissaire (membre) pronostique l'inverse — sauf s'il joue p1, ou
    // s'il EST l'outsider (le tirage est aléatoire) : son second pronostic
    // écraserait le premier.
    const commishPredictsAway =
      commish.userId !== p1.homeTeam.ownerId &&
      commish.userId !== p1.awayTeam!.ownerId &&
      commish.userId !== outsider.userId;
    if (commishPredictsAway) {
      expect(
        (await rawPut(`/cup/pairings/${p1.id}/prediction`, commish.token, { pick: "away" }))
          .status,
      ).toBe(200);
    }

    // 2. Rien des autres avant la clôture.
    const open = unwrap(
      await get<{ data: CupPredictionsDTO }>(`/cup/${cupId}/predictions`, p1Home),
    ).rounds[0].pairings.find((p) => p.id === p1.id)!;
    expect(open.closed).toBe(false);
    expect(open.predictions).toBeNull();
    expect(open.distribution).toBeNull();

    // Premier évènement : la rencontre se ferme.
    const base = `/cup/pairings/${p1.id}/sheet`;
    await post(base, p1Home, {});
    const sheet = unwrap(
      await get<{ data: { teams: { home: { players: Array<{ id: string }> } } } }>(base, p1Home),
    );
    await post(`${base}/events`, p1Home, {
      kind: "touchdown",
      team: "home",
      actorPlayerId: sheet.teams.home.players[0].id,
    });
    const late = await rawPut(`/cup/pairings/${p1.id}/prediction`, outsider.token, {
      pick: "away",
    });
    expect(late.status).toBe(409);
    const closed = unwrap(
      await get<{ data: CupPredictionsDTO }>(`/cup/${cupId}/predictions`, p1Home),
    ).rounds[0].pairings.find((p) => p.id === p1.id)!;
    expect(closed.closed).toBe(true);
    expect(closed.predictions!.map((p) => p.userId)).toContain(outsider.userId);
    expect(closed.distribution!.home).toBe(1);

    // 3. Validation 1-0 : score exact pour l'outsider (3 + 2).
    await post(`${base}/submit`, p1Home, {});
    await post(`${base}/submit`, p1Away, {});
    await post(`${base}/validate`, commish.token, {});
    const board = unwrap(
      await get<{ data: LeaderboardDTO }>(`/cup/${cupId}/predictions/leaderboard`, spectator.token),
    );
    const mine = board.coach.find((e) => e.userId === outsider.userId)!;
    expect(mine).toMatchObject({ points: 5, correct: 1, exact: 1 });
    if (commishPredictsAway) {
      expect(board.coach.find((e) => e.userId === commish.userId)!.points).toBe(0);
    }

    // Invalidation : en attente, hors classement ; la rencontre reste fermée.
    const invalidated = await rawPost(`${base}/invalidate`, commish.token, { reason: "erreur" });
    expect(invalidated.status).toBe(200);
    const afterInvalidation = unwrap(
      await get<{ data: LeaderboardDTO }>(`/cup/${cupId}/predictions/leaderboard`, spectator.token),
    );
    expect(afterInvalidation.coach.find((e) => e.userId === outsider.userId)).toBeUndefined();
    const stillClosed = await rawPut(`/cup/pairings/${p1.id}/prediction`, outsider.token, {
      pick: "draw",
    });
    expect(stillClosed.status).toBe(409);

    // Re-validation, puis la seconde rencontre : la ronde se complète et
    // chaque pronostiqueur reçoit son bilan.
    await post(`${base}/submit`, p1Home, {});
    await post(`${base}/submit`, p1Away, {});
    await post(`${base}/validate`, commish.token, {});
    const p2Home = tokenOf.get(p2.homeTeam.ownerId)!;
    const p2Away = tokenOf.get(p2.awayTeam!.ownerId)!;
    const base2 = `/cup/pairings/${p2.id}/sheet`;
    await post(base2, p2Home, {});
    await post(`${base2}/submit`, p2Home, {});
    await post(`${base2}/submit`, p2Away, {});
    await post(`${base2}/validate`, commish.token, {});
    let bilan: { kind: string; url: string | null } | undefined;
    for (let i = 0; i < 20 && !bilan; i++) {
      const list = unwrap(
        await get<{ data: { notifications: Array<{ kind: string; url: string | null }> } }>(
          "/notifications",
          outsider.token,
        ),
      ).notifications;
      bilan = list.find((n) => n.kind === "cup.predictions_settled");
      if (!bilan) await new Promise((r) => setTimeout(r, 50));
    }
    expect(bilan?.url).toBe(`/cups/${cupId}/predictions`);

    // 4. Portée : commissaire seul ; « off » ne sert plus rien.
    // Un coach qui n'est PAS le commissaire (l'outsider peut l'être).
    const refused = await rawPatch(`/cup/${cupId}/predictions-scope`, coaches[1].token, {
      scope: "open",
    });
    expect(refused.status).toBe(403);
    const off = await rawPatch(`/cup/${cupId}/predictions-scope`, commish.token, {
      scope: "off",
    });
    expect(off.status).toBe(200);
    const offView = unwrap(
      await get<{ data: CupPredictionsDTO }>(`/cup/${cupId}/predictions`, outsider.token),
    );
    expect(offView).toMatchObject({ scope: "off", rounds: [] });
  });

  it("ouvre les Tribunes en portée « tout le monde »", async () => {
    const a = await seedAndLogin("ta@cuppred.test", "pwd", "Ta");
    const b = await seedAndLogin("tb@cuppred.test", "pwd", "Tb");
    const fan = await seedAndLogin("fan@cuppred.test", "pwd", "Fan");
    const teamA = await createTeam(a.userId, "Tr A", "orc");
    const teamB = await createTeam(b.userId, "Tr B", "skaven");
    const { cup } = await post<{ cup: { id: string } }>("/cup", a.token, {
      name: "Coupe ouverte",
      ruleset: "season_3",
      predictionsScope: "open",
    });
    await post(`/cup/${cup.id}/register`, a.token, { teamId: teamA.teamId });
    await post(`/cup/${cup.id}/register`, b.token, { teamId: teamB.teamId });
    await post(`/cup/${cup.id}/validate`, a.token, {});
    await post(`/cup/${cup.id}/rounds`, a.token, { system: "random" });
    const detail = (await get<CupDTO>(`/cup/${cup.id}`, fan.token)).cup;
    const pairing = detail.rounds[0].pairings[0];
    const view = unwrap(
      await get<{ data: CupPredictionsDTO }>(`/cup/${cup.id}/predictions`, fan.token),
    );
    expect(view.viewer).toMatchObject({ isMember: false, group: "stands" });
    expect(
      (await rawPut(`/cup/pairings/${pairing.id}/prediction`, fan.token, { pick: "draw" })).status,
    ).toBe(200);
  });
});
