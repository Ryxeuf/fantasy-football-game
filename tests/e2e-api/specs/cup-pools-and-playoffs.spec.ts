/**
 * E2E API — poules et play-offs d'une coupe, sur une vraie base.
 *
 * Deux flux que seule une base réelle valide :
 *
 *  - **poules** : création, quotas, affectation manuelle et automatique,
 *    fermeture de la fenêtre d'édition dès la première ronde, et un
 *    appariement qui ne franchit PAS la frontière de poule ;
 *  - **play-offs** : refus tant que le classement est ouvert, seeding par
 *    quotas de poule, gating de la publication (bracket ET calendrier),
 *    correction des têtes de série, puis avancement du bracket par le
 *    résultat d'une demi-finale.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  get,
  post,
  rawDelete,
  rawPatch,
  rawPost,
  resetDb,
  unwrap,
} from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface PoolDTO {
  id: string;
  name: string;
  order: number;
  qualifiesForPlayoffs: number;
  participantCount: number;
}
interface PairingDTO {
  id: string;
  tableNumber: number;
  status: string;
  homeTeam: { id: string; ownerId: string; name: string };
  awayTeam: { id: string; ownerId: string; name: string } | null;
}
interface RoundDTO {
  id: string;
  roundNumber: number;
  kind: string;
  bracketSlot: string | null;
  system: string;
  status: string;
  pairings: PairingDTO[];
}
interface CupDTO {
  id: string;
  status: string;
  playoffSize: number;
  playoffsPublished: boolean | null;
  rounds: RoundDTO[];
  participants: Array<{ id: string; participantId: string; poolId: string | null }>;
  poolStandings: Array<{
    poolId: string;
    poolName: string;
    qualifiesForPlayoffs: number;
    standings: Array<{ teamId: string }>;
  }>;
}
interface BracketDTO {
  playoffSize: number;
  playoffsPublished: boolean | null;
  regularRoundsComplete: boolean;
  poolQualification: {
    totalQualified: number;
    playoffSize: number;
    consistent: boolean;
  };
  rounds: Array<{
    id: string;
    slot: string;
    placeholder: boolean;
    homeTeam: { id: string } | null;
    awayTeam: { id: string } | null;
    scoreLabel: string | null;
  }>;
}

const ROSTERS = ["skaven", "lizardmen", "orc", "skaven"] as const;

async function setupCup(prefix: string) {
  const coaches = [];
  for (let i = 0; i < ROSTERS.length; i += 1) {
    const coach = await seedAndLogin(
      `${prefix}-c${i}@pools.test`,
      "pwd",
      `Coach ${i}`,
    );
    const team = await createTeam(coach.userId, `${prefix} T${i}`, ROSTERS[i]);
    coaches.push({ ...coach, teamId: team.teamId });
  }
  const commish = coaches[0];
  const { cup } = await post<{ cup: { id: string } }>("/cup", commish.token, {
    name: `${prefix} Pool Cup`,
    ruleset: "season_3",
  });
  for (const c of coaches) {
    await post(`/cup/${cup.id}/register`, c.token, { teamId: c.teamId });
  }
  await post(`/cup/${cup.id}/validate`, commish.token, {});
  const tokensByOwner = new Map(coaches.map((c) => [c.userId, c.token]));
  return { cupId: cup.id, commish, coaches, tokensByOwner };
}

async function readCup(cupId: string, token: string): Promise<CupDTO> {
  return (await get<{ cup: CupDTO }>(`/cup/${cupId}`, token)).cup;
}

async function listPools(cupId: string, token: string): Promise<PoolDTO[]> {
  // Route migrée : réponse enveloppée par `sendSuccess`.
  return unwrap(await get<{ data: { pools: PoolDTO[] } }>(
    `/cup/${cupId}/pools`,
    token,
  )).pools;
}

async function readBracket(cupId: string, token: string): Promise<BracketDTO> {
  return unwrap(await get<{ data: BracketDTO }>(`/cup/${cupId}/playoffs`, token));
}

async function createPool(
  cupId: string,
  token: string,
  name: string,
  qualifiesForPlayoffs: number,
): Promise<PoolDTO> {
  const res = await rawPost(`/cup/${cupId}/pools`, token, {
    name,
    qualifiesForPlayoffs,
  });
  expect(res.status, JSON.stringify(await res.clone().json())).toBe(201);
  return ((await res.json()) as { data: { pool: PoolDTO } }).data.pool;
}

/** Joue toutes les rencontres ouvertes d'une ronde, domicile vainqueur. */
async function playRound(
  round: RoundDTO,
  tokensByOwner: Map<string, string>,
): Promise<void> {
  for (const p of round.pairings) {
    if (p.status !== "scheduled" || !p.awayTeam) continue;
    const token = tokensByOwner.get(p.homeTeam.ownerId)!;
    const { localMatch } = await post<{ localMatch: { id: string } }>(
      "/local-match",
      token,
      { teamAId: p.homeTeam.id, teamBId: p.awayTeam.id, cupPairingId: p.id },
    );
    await post(`/local-match/${localMatch.id}/complete`, token, {
      scoreTeamA: 2,
      scoreTeamB: 0,
    });
  }
}

describe("E2E API — poules de coupe", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("compose les poules, les affecte et fige la composition à la 1re ronde", async () => {
    const { cupId, commish, coaches } = await setupCup("pl");

    // Un tiers ne compose pas les poules.
    const forbidden = await rawPost(`/cup/${cupId}/pools`, coaches[1].token, {
      name: "Poule pirate",
    });
    expect(forbidden.status).toBe(403);

    const poolA = await createPool(cupId, commish.token, "Poule A", 1);
    const poolB = await createPool(cupId, commish.token, "Poule B", 1);

    // Le nom est unique dans la coupe.
    const dup = await rawPost(`/cup/${cupId}/pools`, commish.token, {
      name: "Poule A",
    });
    expect(dup.status).toBe(409);

    // Répartition automatique : 4 équipes, 2 poules -> 2 et 2.
    const auto = await rawPost(
      `/cup/${cupId}/pools/auto-assign`,
      commish.token,
      {},
    );
    expect(auto.status).toBe(200);
    const afterAuto = await listPools(cupId, commish.token);
    expect(afterAuto.map((p) => p.participantCount).sort()).toEqual([2, 2]);

    // Affectation manuelle : tout le monde en poule A.
    const cup = await readCup(cupId, commish.token);
    const assign = await rawPost(`/cup/${cupId}/pools/assign`, commish.token, {
      assignments: cup.participants.map((p) => ({
        participantId: p.participantId,
        poolId: poolA.id,
      })),
    });
    expect(assign.status).toBe(200);
    expect(
      (await listPools(cupId, commish.token)).find((p) => p.id === poolA.id)!
        .participantCount,
    ).toBe(4);

    // Une poule habitée ne se supprime pas ; une poule vide, si.
    const busy = await rawDelete(`/cup/pools/${poolA.id}`, commish.token);
    expect(busy.status).toBe(409);
    const empty = await rawDelete(`/cup/pools/${poolB.id}`, commish.token);
    expect(empty.status).toBe(200);

    // Une fois une ronde générée, la composition est FIGÉE — mais pas le
    // quota, qui ne sert qu'au seeding des play-offs, encore à venir.
    await post(`/cup/${cupId}/rounds`, commish.token, { system: "random" });
    const late = await rawPost(`/cup/${cupId}/pools`, commish.token, {
      name: "Poule C",
    });
    expect(late.status).toBe(409);
    const quota = await rawPatch(`/cup/pools/${poolA.id}`, commish.token, {
      qualifiesForPlayoffs: 2,
    });
    expect(quota.status).toBe(200);
  });

  it("apparie DANS la poule : deux poules de deux donnent deux rencontres", async () => {
    const { cupId, commish } = await setupCup("gr");
    const poolA = await createPool(cupId, commish.token, "Poule A", 1);
    const poolB = await createPool(cupId, commish.token, "Poule B", 1);
    const cup = await readCup(cupId, commish.token);
    const [p0, p1, p2, p3] = cup.participants;
    await post(`/cup/${cupId}/pools/assign`, commish.token, {
      assignments: [
        { participantId: p0.participantId, poolId: poolA.id },
        { participantId: p1.participantId, poolId: poolA.id },
        { participantId: p2.participantId, poolId: poolB.id },
        { participantId: p3.participantId, poolId: poolB.id },
      ],
    });

    const res = await rawPost(`/cup/${cupId}/rounds`, commish.token, {
      system: "random",
    });
    expect(res.status, JSON.stringify(await res.clone().json())).toBe(201);
    const round = ((await res.json()) as { data: { round: RoundDTO } }).data
      .round;
    expect(round.pairings).toHaveLength(2);

    // Chaque rencontre reste à l'intérieur de sa poule.
    const poolOf = new Map(
      cup.participants.map((p) => [
        p.id,
        [p0, p1].some((x) => x.id === p.id) ? poolA.id : poolB.id,
      ]),
    );
    for (const pairing of round.pairings) {
      expect(poolOf.get(pairing.homeTeam.id)).toBe(
        poolOf.get(pairing.awayTeam!.id),
      );
    }

    // Le classement est servi par poule.
    const withPools = await readCup(cupId, commish.token);
    expect(withPools.poolStandings.map((g) => g.poolName).sort()).toEqual([
      "Poule A",
      "Poule B",
    ]);
  });
});

describe("E2E API — play-offs de coupe", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("refuse le lancement sans taille, puis tant qu'une rencontre est ouverte", async () => {
    const { cupId, commish } = await setupCup("po");

    // Taille 0 (défaut) : pas de bracket possible.
    const disabled = await rawPost(
      `/cup/${cupId}/playoffs/start`,
      commish.token,
      {},
    );
    expect(disabled.status).toBe(400);

    await rawPatch(`/cup/${cupId}`, commish.token, { playoffSize: 2 });
    const round = ((await (
      await rawPost(`/cup/${cupId}/rounds`, commish.token, { system: "random" })
    ).json()) as { data: { round: RoundDTO } }).data.round;
    expect(round.pairings.length).toBeGreaterThan(0);

    // Rencontres encore ouvertes ⇒ refus, sauf clôture explicite.
    const tooEarly = await rawPost(
      `/cup/${cupId}/playoffs/start`,
      commish.token,
      {},
    );
    expect(tooEarly.status).toBe(409);
  });

  it("seede sur les quotas de poule, gate la publication et avance le bracket", async () => {
    const { cupId, commish, coaches, tokensByOwner } = await setupCup("br");
    await rawPatch(`/cup/${cupId}`, commish.token, { playoffSize: 4 });

    const poolA = await createPool(cupId, commish.token, "Poule A", 2);
    const poolB = await createPool(cupId, commish.token, "Poule B", 2);
    const cup = await readCup(cupId, commish.token);
    const [p0, p1, p2, p3] = cup.participants;
    await post(`/cup/${cupId}/pools/assign`, commish.token, {
      assignments: [
        { participantId: p0.participantId, poolId: poolA.id },
        { participantId: p1.participantId, poolId: poolA.id },
        { participantId: p2.participantId, poolId: poolB.id },
        { participantId: p3.participantId, poolId: poolB.id },
      ],
    });

    const round = ((await (
      await rawPost(`/cup/${cupId}/rounds`, commish.token, { system: "random" })
    ).json()) as { data: { round: RoundDTO } }).data.round;
    await playRound(round, tokensByOwner);

    // Un tiers ne lance pas les play-offs.
    const forbidden = await rawPost(
      `/cup/${cupId}/playoffs/start`,
      coaches[1].token,
      {},
    );
    expect(forbidden.status).toBe(403);

    const started = await rawPost(
      `/cup/${cupId}/playoffs/start`,
      commish.token,
      {},
    );
    expect(started.status, JSON.stringify(await started.clone().json())).toBe(
      201,
    );

    // Bracket non publié : invisible du coach, y compris dans le CALENDRIER.
    const coachPublish = await rawPatch(
      `/cup/${cupId}/playoffs/publish`,
      coaches[1].token,
      { published: true },
    );
    expect(coachPublish.status).toBe(403);
    const coachBracket = await readBracket(cupId, coaches[1].token);
    expect(coachBracket.rounds, "aucune tête de série ne fuite").toHaveLength(
      0,
    );
    const coachCup = await readCup(cupId, coaches[1].token);
    expect(coachCup.rounds.some((r) => r.kind === "playoff")).toBe(false);
    // Le commissaire, lui, le voit.
    const commishCup = await readCup(cupId, commish.token);
    const bracketRounds = commishCup.rounds.filter(
      (r) => r.kind === "playoff",
    );
    expect(bracketRounds).toHaveLength(2);
    expect(bracketRounds.map((r) => r.bracketSlot).sort()).toEqual([
      "sf1",
      "sf2",
    ]);
    expect(bracketRounds.every((r) => r.system === "bracket")).toBe(true);

    // Correction des têtes de série, puis publication.
    const seeds = cup.participants.map((p) => p.id);
    const reseeded = await rawPatch(
      `/cup/${cupId}/playoffs/seeds`,
      commish.token,
      { teamIds: [seeds[3], seeds[2], seeds[1], seeds[0]] },
    );
    expect(reseeded.status, JSON.stringify(await reseeded.clone().json())).toBe(
      200,
    );
    const duplicate = await rawPatch(
      `/cup/${cupId}/playoffs/seeds`,
      commish.token,
      { teamIds: [seeds[0], seeds[0], seeds[1], seeds[2]] },
    );
    expect(duplicate.status).toBe(400);

    await rawPatch(`/cup/${cupId}/playoffs/publish`, commish.token, {
      published: true,
    });
    const published = await readCup(cupId, coaches[1].token);
    expect(published.rounds.filter((r) => r.kind === "playoff")).toHaveLength(
      2,
    );

    // Une demi-finale jouée fait naître la finale, avec un seul qualifié.
    const bracket = await readBracket(cupId, commish.token);
    expect(bracket.rounds.find((r) => r.slot === "sf1")!.homeTeam).toBeTruthy();

    const commishCup2 = await readCup(cupId, commish.token);
    const sf1Round = commishCup2.rounds.find((r) => r.bracketSlot === "sf1")!;
    await playRound(sf1Round, tokensByOwner);

    const advanced = await readBracket(cupId, commish.token);
    const final = advanced.rounds.find((r) => r.slot === "final");
    expect(final, "la finale naît de la 1re demie jouée").toBeTruthy();
    expect(final!.placeholder, "second qualifié encore inconnu").toBe(true);
  });
});
