/**
 * E2E API — pronostics de ligue, de la portée au palmarès.
 *
 * Ce que l'unitaire ne peut pas prouver, parce que tout tient à l'état RÉEL
 * de la base et à l'enchaînement des services :
 *
 *  1. la portée par défaut (« membres ») et les garde-fous d'éligibilité —
 *     propre match, non-membre, anonyme, pronostic incohérent ;
 *  2. rien des autres avant la clôture, et la clôture PERSISTÉE au premier
 *     évènement de la feuille ;
 *  3. le règlement dans l'entonnoir des résultats (3 pts l'issue, +2 le score
 *     exact), le bilan de journée envoyé UNE fois, l'invalidation qui remet
 *     en attente sans rouvrir, la re-validation qui rend les points ;
 *  4. la portée « tout le monde » réglable ligue lancée, et les Tribunes ;
 *  5. l'Oracle au palmarès et les succès, après la clôture de la saison.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  get,
  post,
  rawDelete,
  rawGet,
  rawPatch,
  rawPost,
  rawPut,
  resetDb,
  unwrap,
} from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface PairingDTO {
  id: string;
  status: string;
  homeParticipant: { id: string; team: { id: string; ownerId: string } };
  awayParticipant: { id: string; team: { id: string; ownerId: string } };
}
interface RoundDTO {
  id: string;
  roundNumber: number;
  status: string;
  pairings: PairingDTO[];
}
interface SheetDTO {
  teams: {
    home: { players: Array<{ id: string }> } | null;
    away: { players: Array<{ id: string }> } | null;
  };
}
interface PredictionDTO {
  pick: string;
  homeScore: number | null;
  awayScore: number | null;
  grade: string;
  points: number;
}
interface PairingPredictionsDTO {
  id: string;
  closed: boolean;
  eligibility: string;
  myPrediction: PredictionDTO | null;
  predictions: Array<PredictionDTO & { userId: string; group: string }> | null;
  distribution: {
    home: number;
    draw: number;
    away: number;
    total: number;
  } | null;
}
interface ViewDTO {
  scope: string;
  scopeConfigured: boolean;
  viewer: {
    userId: string | null;
    isCommissioner: boolean;
    isMember: boolean;
    group: string | null;
  };
  rounds: Array<{ id: string; pairings: PairingPredictionsDTO[] }>;
}
interface EntryDTO {
  rank: number;
  userId: string;
  points: number;
  settled: number;
  correct: number;
  exact: number;
}
interface BoardDTO {
  coach: EntryDTO[];
  stands: EntryDTO[];
}
interface NotificationDTO {
  kind: string;
  title: string;
  body: string;
}
interface AwardEntryDTO {
  ownerId: string;
  value: number;
}
interface Coach {
  token: string;
  userId: string;
}

interface Season {
  leagueId: string;
  seasonId: string;
  commissioner: Coach;
  byUser: Map<string, Coach>;
  rounds: RoundDTO[];
  /** Rencontre de la 1re journée que joue le commissaire. */
  own: PairingDTO;
  /** L'autre rencontre de la 1re journée. */
  other: PairingDTO;
  /** Adversaire du commissaire en 1re journée : pronostique `other`. */
  rival: Coach;
}

async function bodyOf(res: Response): Promise<string> {
  return JSON.stringify(await res.json().catch(() => null));
}

/** 4 coachs (le 1er est commissaire), une ligue, une saison démarrée. */
async function startSeason(prefix: string): Promise<Season> {
  const coaches: Array<Coach & { teamId: string }> = [];
  for (const [i, key] of ["a", "b", "c", "d"].entries()) {
    const coach = await seedAndLogin(
      `${prefix}-${key}@prono.test`,
      "pwd",
      `Coach ${key.toUpperCase()}`,
    );
    const team = await createTeam(
      coach.userId,
      `${prefix} ${key.toUpperCase()}`,
      i % 2 === 0 ? "skaven" : "lizardmen",
    );
    coaches.push({ ...coach, teamId: team.teamId });
  }
  const commissioner = coaches[0];
  const league = unwrap(
    await post<{ data: { id: string } }>("/leagues", commissioner.token, {
      name: `${prefix} Ligue des Devins`,
      maxParticipants: 4,
    }),
  );
  const season = unwrap(
    await post<{ data: { id: string } }>(
      `/leagues/${league.id}/seasons`,
      commissioner.token,
      { name: "S1" },
    ),
  );
  for (const coach of coaches) {
    await post(`/leagues/seasons/${season.id}/join`, coach.token, {
      teamId: coach.teamId,
    });
  }
  await post(`/leagues/seasons/${season.id}/start`, commissioner.token, {});

  const byUser = new Map<string, Coach>(
    coaches.map((c) => [c.userId, { token: c.token, userId: c.userId }]),
  );
  const rounds = await loadRounds(season.id, commissioner.token);
  const first = rounds[0];
  const isOwn = (p: PairingDTO) =>
    p.homeParticipant.team.ownerId === commissioner.userId ||
    p.awayParticipant.team.ownerId === commissioner.userId;
  const own = first.pairings.find(isOwn)!;
  const other = first.pairings.find((p) => !isOwn(p))!;
  const rivalId =
    own.homeParticipant.team.ownerId === commissioner.userId
      ? own.awayParticipant.team.ownerId
      : own.homeParticipant.team.ownerId;
  return {
    leagueId: league.id,
    seasonId: season.id,
    commissioner: { token: commissioner.token, userId: commissioner.userId },
    byUser,
    rounds,
    own,
    other,
    rival: byUser.get(rivalId)!,
  };
}

async function loadRounds(
  seasonId: string,
  token: string,
): Promise<RoundDTO[]> {
  return unwrap(
    await get<{ data: { season: { rounds: RoundDTO[] } } }>(
      `/leagues/seasons/${seasonId}`,
      token,
    ),
  ).season.rounds;
}

async function view(seasonId: string, token: string | null): Promise<ViewDTO> {
  return unwrap(
    await get<{ data: ViewDTO }>(
      `/leagues/seasons/${seasonId}/predictions`,
      token,
    ),
  );
}

function pairingOf(v: ViewDTO, pairingId: string): PairingPredictionsDTO {
  for (const round of v.rounds) {
    const found = round.pairings.find((p) => p.id === pairingId);
    if (found) return found;
  }
  throw new Error(`rencontre ${pairingId} absente de la vue`);
}

async function board(seasonId: string, token: string): Promise<BoardDTO> {
  return unwrap(
    await get<{ data: BoardDTO }>(
      `/leagues/seasons/${seasonId}/predictions/leaderboard`,
      token,
    ),
  );
}

function predict(
  pairingId: string,
  coach: Coach,
  body: Record<string, unknown>,
): Promise<Response> {
  return rawPut(`/leagues/pairings/${pairingId}/prediction`, coach.token, body);
}

async function mustPredict(
  pairingId: string,
  coach: Coach,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await predict(pairingId, coach, body);
  expect(res.status, await bodyOf(res)).toBe(200);
}

/** Ouvre la feuille et saisit les TD (sans soumettre). */
async function scoreSheet(
  s: Season,
  pairing: PairingDTO,
  home: number,
  away: number,
): Promise<void> {
  const homeCoach = s.byUser.get(pairing.homeParticipant.team.ownerId)!;
  const awayCoach = s.byUser.get(pairing.awayParticipant.team.ownerId)!;
  const url = `/leagues/pairings/${pairing.id}/sheet`;
  await post(url, homeCoach.token, {});
  const sheet = unwrap(await get<{ data: SheetDTO }>(url, homeCoach.token));
  for (let i = 0; i < home; i++) {
    await post(`${url}/events`, homeCoach.token, {
      kind: "touchdown",
      team: "home",
      actorPlayerId: sheet.teams.home!.players[0].id,
    });
  }
  for (let i = 0; i < away; i++) {
    await post(`${url}/events`, awayCoach.token, {
      kind: "touchdown",
      team: "away",
      actorPlayerId: sheet.teams.away!.players[0].id,
    });
  }
}

/** Soumission des deux coachs puis validation par le commissaire. */
async function submitAndValidate(s: Season, pairing: PairingDTO): Promise<void> {
  const url = `/leagues/pairings/${pairing.id}/sheet`;
  const home = s.byUser.get(pairing.homeParticipant.team.ownerId)!;
  const away = s.byUser.get(pairing.awayParticipant.team.ownerId)!;
  await post(`${url}/submit`, home.token, {});
  await post(`${url}/submit`, away.token, {});
  const validated = await rawPost(`${url}/validate`, s.commissioner.token, {});
  expect(validated.status, await bodyOf(validated)).toBe(200);
}

async function playPairing(
  s: Season,
  pairing: PairingDTO,
  home: number,
  away: number,
): Promise<void> {
  await scoreSheet(s, pairing, home, away);
  await submitAndValidate(s, pairing);
}

async function predictionNotifications(
  coach: Coach,
): Promise<NotificationDTO[]> {
  const list = unwrap(
    await get<{ data: { notifications: NotificationDTO[] } }>(
      "/notifications",
      coach.token,
    ),
  ).notifications;
  return list.filter((n) => n.kind === "league.predictions_settled");
}

describe("E2E API — pronostics de ligue", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("portée « membres » par défaut, garde-fous, et rien des autres avant la clôture", async () => {
    const s = await startSeason("elig");
    const stranger = await seedAndLogin("elig-x@prono.test", "pwd", "Curieux");

    const league = unwrap(
      await get<{ data: { league: { predictionsScope: string | null } } }>(
        `/leagues/${s.leagueId}`,
        s.commissioner.token,
      ),
    ).league;
    expect(league.predictionsScope).toBe("members");

    const mine = await view(s.seasonId, s.commissioner.token);
    expect(mine.scope).toBe("members");
    expect(mine.scopeConfigured).toBe(true);
    expect(mine.viewer).toMatchObject({
      isCommissioner: true,
      isMember: true,
      group: "coach",
    });
    expect(pairingOf(mine, s.own.id).eligibility).toBe("own-match");
    expect(pairingOf(mine, s.other.id).eligibility).toBe("ok");

    // Pas de pronostic sur son propre match, ni hors de la ligue.
    expect((await predict(s.own.id, s.commissioner, { pick: "home" })).status).toBe(403);
    expect((await predict(s.other.id, stranger, { pick: "home" })).status).toBe(403);
    expect(pairingOf(await view(s.seasonId, stranger.token), s.other.id).eligibility).toBe(
      "not-member",
    );
    // Ligue publique : lisible sans compte, mais pas pronostiquable.
    expect(pairingOf(await view(s.seasonId, null), s.other.id).eligibility).toBe(
      "anonymous",
    );

    // Un score qui contredit l'issue est refusé.
    const incoherent = await predict(s.other.id, s.rival, {
      pick: "home",
      homeScore: 1,
      awayScore: 1,
    });
    expect(incoherent.status, await bodyOf(incoherent)).toBe(400);

    await mustPredict(s.other.id, s.commissioner, {
      pick: "home",
      homeScore: 2,
      awayScore: 0,
    });
    await mustPredict(s.other.id, s.rival, { pick: "away" });

    // Rencontre ouverte : chacun voit SON pronostic, rien des autres.
    const rivalView = pairingOf(await view(s.seasonId, s.rival.token), s.other.id);
    expect(rivalView.myPrediction).toMatchObject({ pick: "away", homeScore: null });
    expect(rivalView.predictions).toBeNull();
    expect(rivalView.distribution).toBeNull();

    // Premier évènement de la feuille : la rencontre se ferme.
    await scoreSheet(s, s.other, 1, 0);
    const late = await predict(s.other.id, s.rival, { pick: "home" });
    expect(late.status, await bodyOf(late)).toBe(409);
    const retract = await rawDelete(
      `/leagues/pairings/${s.other.id}/prediction`,
      s.commissioner.token,
    );
    expect(retract.status).toBe(409);

    // Close : les pronostics de chacun deviennent visibles.
    const closed = pairingOf(await view(s.seasonId, s.rival.token), s.other.id);
    expect(closed.closed).toBe(true);
    expect(closed.predictions?.map((p) => p.userId).sort()).toEqual(
      [s.commissioner.userId, s.rival.userId].sort(),
    );
    expect(closed.distribution).toMatchObject({ home: 1, away: 1, total: 2 });
  });

  it("règlement au résultat, bilan de journée unique, invalidation puis re-validation", async () => {
    const s = await startSeason("settle");

    await mustPredict(s.other.id, s.commissioner, {
      pick: "home",
      homeScore: 2,
      awayScore: 0,
    });
    await mustPredict(s.other.id, s.rival, { pick: "away" });

    await playPairing(s, s.other, 2, 0);
    const settled = await board(s.seasonId, s.commissioner.token);
    expect(settled.coach.find((e) => e.userId === s.commissioner.userId)).toMatchObject({
      rank: 1,
      points: 5,
      settled: 1,
      correct: 1,
      exact: 1,
    });
    expect(settled.coach.find((e) => e.userId === s.rival.userId)).toMatchObject({
      points: 0,
      settled: 1,
      correct: 0,
    });
    const graded = pairingOf(await view(s.seasonId, s.commissioner.token), s.other.id);
    expect(graded.myPrediction).toMatchObject({ grade: "exact", points: 5 });

    // La 2e rencontre complète la journée : UN bilan par pronostiqueur.
    await playPairing(s, s.own, 1, 0);
    const bilan = await predictionNotifications(s.commissioner);
    expect(bilan).toHaveLength(1);
    expect(bilan[0].body).toContain("5 pts");
    expect(await predictionNotifications(s.rival)).toHaveLength(1);

    // Invalidation : les points repartent en attente, la rencontre reste close.
    const inval = await rawPost(
      `/leagues/pairings/${s.other.id}/sheet/invalidate`,
      s.commissioner.token,
      { reason: "E2E — erreur de saisie" },
    );
    expect(inval.status, await bodyOf(inval)).toBe(200);
    const pending = await board(s.seasonId, s.commissioner.token);
    expect(pending.coach).toEqual([]);
    const reopened = pairingOf(await view(s.seasonId, s.rival.token), s.other.id);
    expect(reopened.closed).toBe(true);
    expect(reopened.myPrediction).toMatchObject({ grade: "pending", points: 0 });
    expect((await predict(s.other.id, s.rival, { pick: "home" })).status).toBe(409);

    // Re-validation : les points reviennent, le bilan n'est pas renvoyé.
    await submitAndValidate(s, s.other);
    const back = await board(s.seasonId, s.commissioner.token);
    expect(back.coach.find((e) => e.userId === s.commissioner.userId)).toMatchObject({
      points: 5,
    });
    expect(await predictionNotifications(s.commissioner)).toHaveLength(1);
  });

  it("portée « tout le monde » réglable ligue lancée : les Tribunes", async () => {
    const s = await startSeason("open");
    const fan = await seedAndLogin("open-fan@prono.test", "pwd", "Supporter");

    // Un match joué verrouille les paramètres de la ligue…
    await playPairing(s, s.other, 1, 0);
    const locked = await rawPatch(`/leagues/${s.leagueId}`, s.commissioner.token, {
      predictionsScope: "open",
    });
    expect(locked.status).toBe(409);

    const next = s.rounds[1].pairings[0];
    expect((await predict(next.id, fan, { pick: "draw" })).status).toBe(403);

    // … mais pas la portée des pronostics, qui a sa route.
    const notCommissioner = await rawPatch(
      `/leagues/${s.leagueId}/predictions-scope`,
      s.rival.token,
      { scope: "open" },
    );
    expect(notCommissioner.status).toBe(403);
    const opened = await rawPatch(
      `/leagues/${s.leagueId}/predictions-scope`,
      s.commissioner.token,
      { scope: "open" },
    );
    expect(opened.status, await bodyOf(opened)).toBe(200);

    const fanView = await view(s.seasonId, fan.token);
    expect(fanView.scope).toBe("open");
    expect(fanView.viewer.group).toBe("stands");
    expect(pairingOf(fanView, next.id).eligibility).toBe("ok");
    await mustPredict(next.id, fan, { pick: "draw", homeScore: 1, awayScore: 1 });

    await playPairing(s, next, 1, 1);
    const result = await board(s.seasonId, fan.token);
    expect(result.coach).toEqual([]);
    expect(result.stands).toHaveLength(1);
    expect(result.stands[0]).toMatchObject({
      rank: 1,
      userId: fan.userId,
      points: 5,
      exact: 1,
    });
  });

  it("clôture de saison : l'Oracle au palmarès, les succès du pronostiqueur", async () => {
    const s = await startSeason("oracle");

    await mustPredict(s.other.id, s.commissioner, {
      pick: "home",
      homeScore: 2,
      awayScore: 0,
    });
    await mustPredict(s.other.id, s.rival, { pick: "away" });
    await playPairing(s, s.other, 2, 0);

    const closedSeason = await rawPost(
      `/leagues/seasons/${s.seasonId}/close`,
      s.commissioner.token,
      {},
    );
    expect(closedSeason.status, await bodyOf(closedSeason)).toBe(200);

    const recap = unwrap(
      await get<{ data: { awards: { oracle?: AwardEntryDTO[] } } }>(
        `/leagues/seasons/${s.seasonId}/awards`,
        s.commissioner.token,
      ),
    );
    expect(recap.awards.oracle).toHaveLength(1);
    expect(recap.awards.oracle![0]).toMatchObject({
      ownerId: s.commissioner.userId,
      value: 5,
    });

    // La clôture complète la journée entamée : son bilan part aussi.
    expect(await predictionNotifications(s.commissioner)).toHaveLength(1);

    const achievements = unwrap(
      await get<{
        data: { achievements: Array<{ slug: string; unlocked: boolean }> };
      }>("/achievements", s.commissioner.token),
    ).achievements;
    const unlocked = new Set(
      achievements.filter((a) => a.unlocked).map((a) => a.slug),
    );
    expect(unlocked.has("prediction-first-correct")).toBe(true);
    expect(unlocked.has("prediction-exact-score")).toBe(true);
    expect(unlocked.has("season-oracle")).toBe(true);
    expect(unlocked.has("stands-oracle")).toBe(false);

    const rivalAchievements = unwrap(
      await get<{
        data: { achievements: Array<{ slug: string; unlocked: boolean }> };
      }>("/achievements", s.rival.token),
    ).achievements;
    expect(
      rivalAchievements.find((a) => a.slug === "prediction-first-correct")
        ?.unlocked,
    ).toBe(false);
  });

  it("une ligue privée garde ses pronostics introuvables pour un tiers", async () => {
    const s = await startSeason("priv");
    const stranger = await seedAndLogin("priv-x@prono.test", "pwd", "Curieux");
    const privatized = await rawPatch(`/leagues/${s.leagueId}`, s.commissioner.token, {
      isPublic: false,
    });
    expect(privatized.status, await bodyOf(privatized)).toBe(200);

    expect(
      (await rawGet(`/leagues/seasons/${s.seasonId}/predictions`, stranger.token)).status,
    ).toBe(404);
    expect(
      (await rawGet(`/leagues/seasons/${s.seasonId}/predictions`, null)).status,
    ).toBe(404);
    expect((await predict(s.other.id, stranger, { pick: "home" })).status).toBe(404);
  });
});
