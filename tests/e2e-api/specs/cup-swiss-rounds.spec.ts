/**
 * E2E API — rondes suisses d'une coupe.
 *
 * Flux complet sur une vraie base : 5 équipes -> validation de la coupe ->
 * ronde 1 (2 rencontres + 1 exempt) -> un coach crée le match local de sa
 * rencontre (rattachement, refus du doublon) -> match terminé -> la ronde
 * 2 est refusée tant qu'une rencontre reste ouverte -> annulation par le
 * commissaire -> ronde 2 sans rematch, exempt tournant, classement avec
 * les points d'exempt -> suppression de la dernière ronde.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawDelete, rawPatch, rawPost, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface PairingDTO {
  id: string;
  tableNumber: number;
  status: string;
  scheduledAt: string | null;
  homeTeam: { id: string; ownerId: string; name: string };
  awayTeam: { id: string; ownerId: string; name: string } | null;
  localMatch: { id: string; status: string; scoreTeamA: number | null; scoreTeamB: number | null } | null;
}
interface RoundDTO {
  id: string;
  roundNumber: number;
  status: string;
  pairings: PairingDTO[];
}
interface CupDetailDTO {
  cup: {
    id: string;
    status: string;
    rounds: RoundDTO[];
    standings: Array<{ teamId: string; byes: number; totalPoints: number; matchesPlayed: number }>;
  };
}

const ROSTERS = ["skaven", "lizardmen", "orc", "skaven", "lizardmen"] as const;

async function setupCup(prefix: string) {
  const coaches = [];
  for (let i = 0; i < ROSTERS.length; i += 1) {
    const coach = await seedAndLogin(`${prefix}-c${i}@swiss.test`, "pwd", `Coach ${i}`);
    const team = await createTeam(coach.userId, `${prefix} T${i}`, ROSTERS[i]);
    coaches.push({ ...coach, teamId: team.teamId });
  }
  const commish = coaches[0];
  const created = await post<{ cup: { id: string } }>("/cup", commish.token, {
    name: `${prefix} Swiss Cup`,
    ruleset: "season_3",
  });
  const cupId = created.cup.id;
  for (const c of coaches) {
    await post(`/cup/${cupId}/register`, c.token, { teamId: c.teamId });
  }
  await post(`/cup/${cupId}/validate`, commish.token, {});
  const tokensByOwner = new Map(coaches.map((c) => [c.userId, c.token]));
  const teamOwner = new Map(coaches.map((c) => [c.teamId, c.userId]));
  return { cupId, commish, coaches, tokensByOwner, teamOwner };
}

async function readCup(cupId: string, token: string): Promise<CupDetailDTO["cup"]> {
  return (await get<CupDetailDTO>(`/cup/${cupId}`, token)).cup;
}

async function playPairing(
  pairing: PairingDTO,
  tokensByOwner: Map<string, string>,
  scoreHome: number,
  scoreAway: number,
): Promise<string> {
  const homeToken = tokensByOwner.get(pairing.homeTeam.ownerId)!;
  const created = await post<{ localMatch: { id: string } }>("/local-match", homeToken, {
    teamAId: pairing.homeTeam.id,
    teamBId: pairing.awayTeam!.id,
    cupPairingId: pairing.id,
  });
  await post(`/local-match/${created.localMatch.id}/complete`, homeToken, {
    scoreTeamA: scoreHome,
    scoreTeamB: scoreAway,
  });
  return created.localMatch.id;
}

describe("E2E API — rondes suisses de coupe", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("génère, joue et enchaîne les rondes sans rematch", async () => {
    const { cupId, commish, coaches, tokensByOwner } = await setupCup("sw");

    // Un tiers (ni créateur ni admin) ne génère pas de ronde.
    const forbidden = await rawPost(`/cup/${cupId}/rounds/swiss`, coaches[1].token, {});
    expect(forbidden.status).toBe(403);

    // Ronde 1 : 5 inscrits -> 2 rencontres + 1 exempt.
    const r1res = await rawPost(`/cup/${cupId}/rounds/swiss`, commish.token, {});
    expect(r1res.status, JSON.stringify(await r1res.clone().json())).toBe(201);
    const r1 = ((await r1res.json()) as { data: { round: RoundDTO } }).data.round;
    expect(r1.roundNumber).toBe(1);
    expect(r1.pairings).toHaveLength(3);
    const bye1 = r1.pairings.find((p) => p.status === "bye")!;
    expect(bye1.awayTeam).toBeNull();
    const games1 = r1.pairings.filter((p) => p.status === "scheduled");
    expect(games1).toHaveLength(2);

    // Ronde 2 refusée tant que la ronde 1 est ouverte.
    const tooEarly = await rawPost(`/cup/${cupId}/rounds/swiss`, commish.token, {});
    expect(tooEarly.status).toBe(409);

    // Le coach visiteur planifie la rencontre ; un tiers est refusé.
    const [g1, g2] = games1;
    const awayToken = tokensByOwner.get(g1.awayTeam!.ownerId)!;
    const scheduled = await rawPatch(`/cup/pairings/${g1.id}/schedule`, awayToken, {
      scheduledAt: "2026-10-01T18:30:00.000Z",
    });
    expect(scheduled.status).toBe(200);
    const strangerToken = tokensByOwner.get(bye1.homeTeam.ownerId)!;
    const strangerSchedule = await rawPatch(`/cup/pairings/${g1.id}/schedule`, strangerToken, {
      scheduledAt: null,
    });
    expect(strangerSchedule.status).toBe(403);

    // Un match local matérialise la rencontre ; un second est refusé ; les
    // équipes doivent être celles de la rencontre.
    const wrongTeams = await rawPost("/local-match", tokensByOwner.get(g1.homeTeam.ownerId)!, {
      teamAId: g1.homeTeam.id,
      teamBId: bye1.homeTeam.id,
      cupPairingId: g1.id,
    });
    expect(wrongTeams.status).toBe(400);
    const matchId = await playPairing(g1, tokensByOwner, 2, 1);
    const duplicate = await rawPost("/local-match", awayToken, {
      teamAId: g1.awayTeam!.id,
      teamBId: g1.homeTeam.id,
      cupPairingId: g1.id,
    });
    expect(duplicate.status).toBe(409);

    let cup = await readCup(cupId, commish.token);
    let round1 = cup.rounds[0];
    const played = round1.pairings.find((p) => p.id === g1.id)!;
    expect(played.status).toBe("played");
    expect(played.localMatch).toMatchObject({ id: matchId, status: "completed", scoreTeamA: 2, scoreTeamB: 1 });
    expect(new Date(played.scheduledAt!).toISOString()).toBe("2026-10-01T18:30:00.000Z");
    expect(round1.status).toBe("in_progress");

    // L'exempt vaut les points d'une victoire sans match joué.
    const byeRow = cup.standings.find((s) => s.teamId === bye1.homeTeam.id)!;
    expect(byeRow.byes).toBe(1);
    expect(byeRow.matchesPlayed).toBe(0);
    expect(byeRow.totalPoints).toBe(1000);

    // Le commissaire annule la seconde rencontre : la ronde est complète.
    const cancelled = await rawPost(`/cup/pairings/${g2.id}/cancel`, commish.token, {});
    expect(cancelled.status).toBe(200);
    cup = await readCup(cupId, commish.token);
    round1 = cup.rounds[0];
    expect(round1.status).toBe("completed");

    // Ronde 2 : aucune des rencontres de la ronde 1 ne se rejoue, l'exempt
    // change d'équipe.
    const r2 = (
      (await post<{ data: { round: RoundDTO } }>(`/cup/${cupId}/rounds/swiss`, commish.token, {})) as {
        data: { round: RoundDTO };
      }
    ).data.round;
    expect(r2.roundNumber).toBe(2);
    const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    const r1Keys = new Set(games1.map((p) => key(p.homeTeam.id, p.awayTeam!.id)));
    for (const p of r2.pairings.filter((x) => x.status === "scheduled")) {
      expect(r1Keys.has(key(p.homeTeam.id, p.awayTeam!.id))).toBe(false);
    }
    const bye2 = r2.pairings.find((p) => p.status === "bye")!;
    expect(bye2.homeTeam.id).not.toBe(bye1.homeTeam.id);
    // Table 1 : le vainqueur de la ronde 1 (2-1, 1010 pts) est en tête.
    expect(r2.pairings[0].tableNumber).toBe(1);
    expect([r2.pairings[0].homeTeam.id, r2.pairings[0].awayTeam?.id]).toContain(g1.homeTeam.id);

    // Suppression de la dernière ronde (aucun match créé), puis refus une
    // fois qu'un match existe.
    const deleted = await rawDelete(`/cup/${cupId}/rounds/last`, commish.token);
    expect(deleted.status).toBe(200);
    cup = await readCup(cupId, commish.token);
    expect(cup.rounds).toHaveLength(1);
    const again = await rawDelete(`/cup/${cupId}/rounds/last`, commish.token);
    expect(again.status).toBe(409);
  });

  it("génère une ronde tirée au sort, puis une ronde composée à la main", async () => {
    const { cupId, commish, coaches } = await setupCup("sys");

    // Ronde 1 tirée au sort : 5 inscrits -> 2 rencontres + 1 exempt.
    const drawn = unwrap(
      await post<{ data: { round: RoundDTO } }>(
        `/cup/${cupId}/rounds`,
        commish.token,
        { system: "random" },
      ),
    ).round;
    expect(drawn.pairings.filter((p) => p.status === "scheduled")).toHaveLength(2);
    expect(drawn.pairings.filter((p) => p.status === "bye")).toHaveLength(1);

    // Le tirage est REJOUABLE : deux appels sur la même coupe et le même
    // numéro de ronde donnent le même appariement.
    await rawDelete(`/cup/${cupId}/rounds/last`, commish.token);
    const again = unwrap(
      await post<{ data: { round: RoundDTO } }>(
        `/cup/${cupId}/rounds`,
        commish.token,
        { system: "random" },
      ),
    ).round;
    const pairKeys = (r: RoundDTO) =>
      r.pairings
        .map((p) => [p.homeTeam.id, p.awayTeam?.id ?? "bye"].join(">"))
        .sort();
    expect(pairKeys(again)).toEqual(pairKeys(drawn));

    // Ronde manuelle : le commissaire pose lui-même une seule rencontre.
    for (const p of again.pairings.filter((x) => x.status === "scheduled")) {
      await rawPost(`/cup/pairings/${p.id}/cancel`, commish.token, {});
    }
    const manual = unwrap(
      await post<{ data: { round: RoundDTO } }>(
        `/cup/${cupId}/rounds`,
        commish.token,
        {
          system: "manual",
          pairings: [
            { homeTeamId: coaches[0].teamId, awayTeamId: coaches[1].teamId },
            { homeTeamId: coaches[2].teamId, awayTeamId: null },
          ],
        },
      ),
    ).round;
    expect(manual.pairings.filter((p) => p.status === "scheduled")).toHaveLength(1);
    const manualBye = manual.pairings.find((p) => p.status === "bye")!;
    expect(manualBye.homeTeam.id).toBe(coaches[2].teamId);
    // Les deux inscrits laissés de côté ne jouent tout simplement pas.
    expect(manual.pairings).toHaveLength(2);
  });

  it("refuse une saisie manuelle incohérente avec un 400", async () => {
    const { cupId, commish, coaches } = await setupCup("bad");
    const res = await rawPost(`/cup/${cupId}/rounds`, commish.token, {
      system: "manual",
      pairings: [
        { homeTeamId: coaches[0].teamId, awayTeamId: coaches[1].teamId },
        { homeTeamId: coaches[0].teamId, awayTeamId: coaches[2].teamId },
      ],
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toMatch(/deux fois/);
  });

  it("refuse une ronde sur une coupe encore ouverte aux inscriptions", async () => {
    const alice = await seedAndLogin("open-alice@swiss.test", "pwd", "Alice");
    const created = await post<{ cup: { id: string } }>("/cup", alice.token, {
      name: "Open Swiss Cup",
      ruleset: "season_3",
    });
    const res = await rawPost(`/cup/${created.cup.id}/rounds/swiss`, alice.token, {});
    expect(res.status).toBe(409);
    expect(JSON.stringify(await res.json())).toMatch(/Validez/);
  });
});
