/**
 * E2E API — la feuille d'une journée ne part jamais d'un état d'équipe
 * périmé (retour testeur, oct. 2026 : « si une fdm de J+1 est ouverte avant
 * que la fdm de J soit saisie et validée, les impacts de J ne sont pas
 * repris dans la fdm J+1 »).
 *
 * Garde d'ouverture : tant qu'une rencontre d'une journée antérieure de l'une
 * des deux équipes n'est pas close, la feuille ne s'ouvre pas — sauf forcée
 * par le commissaire (journée reportée).
 *
 * Mise à jour : une feuille ouverte avant la validation (ou après
 * l'invalidation) d'une autre feuille d'une des deux équipes se signale
 * périmée et se refige d'un clic, tant que personne n'a soumis.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawPost, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface PairingDTO {
  id: string;
  homeParticipant: { team: { id: string; name: string; ownerId: string } };
  awayParticipant: { team: { id: string; name: string; ownerId: string } };
}
interface SeasonDetailDTO {
  season: { rounds: Array<{ roundNumber: number; pairings: PairingDTO[] }> };
}
interface SheetPlayer {
  id: string;
}
interface SheetResponse {
  sheet: { status: string };
  teams: {
    home: { teamId: string; players: SheetPlayer[] } | null;
    away: { teamId: string; players: SheetPlayer[] } | null;
  };
  reference: {
    budget: { home: { treasury: number }; away: { treasury: number } };
  };
  snapshotFreshness: {
    home: { pairingId: string; kind: string } | null;
    away: { pairingId: string; kind: string } | null;
    refreshable: boolean;
  } | null;
}
interface Blocked {
  success: false;
  error: string;
  code: string;
  details: {
    canForce: boolean;
    blocking: Array<{ pairingId: string; roundLabel: string }>;
  };
}

interface Season {
  seasonId: string;
  commissionerToken: string;
  tokensByUser: Map<string, string>;
  rounds: SeasonDetailDTO["season"]["rounds"];
}

const sheetUrl = (pairingId: string) => `/leagues/pairings/${pairingId}/sheet`;

async function setupSeason(prefix: string): Promise<Season> {
  const coaches = await Promise.all(
    ["a", "b", "c", "d"].map((k) =>
      seedAndLogin(`${prefix}-${k}@fresh.test`, "pwd", `Coach ${k}`),
    ),
  );
  const teams = await Promise.all(
    coaches.map((c, i) =>
      createTeam(c.userId, `${prefix} Équipe ${i + 1}`, "skaven"),
    ),
  );
  const commissioner = coaches[0];
  const league = unwrap(
    await post<{ data: { id: string } }>("/leagues", commissioner.token, {
      name: `${prefix} Ligue`,
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
  for (const [i, c] of coaches.entries()) {
    await post(`/leagues/seasons/${season.id}/join`, c.token, {
      teamId: teams[i].teamId,
    });
  }
  await post(`/leagues/seasons/${season.id}/start`, commissioner.token, {});
  const detail = unwrap(
    await get<{ data: SeasonDetailDTO }>(
      `/leagues/seasons/${season.id}`,
      commissioner.token,
    ),
  );
  return {
    seasonId: season.id,
    commissionerToken: commissioner.token,
    tokensByUser: new Map(coaches.map((c) => [c.userId, c.token])),
    rounds: [...detail.season.rounds].sort(
      (a, b) => a.roundNumber - b.roundNumber,
    ),
  };
}

const involves = (p: PairingDTO, teamId: string) =>
  p.homeParticipant.team.id === teamId || p.awayParticipant.team.id === teamId;

/** Rencontre de la journée 2 d'une équipe de la journée 1, et ses jetons. */
function secondMatchOf(s: Season, first: PairingDTO) {
  const teamId = first.homeParticipant.team.id;
  const next = s.rounds[1].pairings.find((p) => involves(p, teamId))!;
  return {
    teamId,
    next,
    homeToken: s.tokensByUser.get(next.homeParticipant.team.ownerId)!,
  };
}

/** Joue une rencontre : feuille ouverte, un TD, deux soumissions, validation. */
async function playPairing(s: Season, p: PairingDTO): Promise<void> {
  const url = sheetUrl(p.id);
  const homeToken = s.tokensByUser.get(p.homeParticipant.team.ownerId)!;
  const awayToken = s.tokensByUser.get(p.awayParticipant.team.ownerId)!;
  await post(url, homeToken, {});
  const sheet = unwrap(await get<{ data: SheetResponse }>(url, homeToken));
  await post(`${url}/events`, homeToken, {
    kind: "touchdown",
    team: "home",
    actorPlayerId: sheet.teams.home!.players[0].id,
  });
  await post(`${url}/submit`, homeToken, {});
  await post(`${url}/submit`, awayToken, {});
  await post(`${url}/validate`, s.commissionerToken, {});
}

describe("E2E API — feuille de match à jour : garde d'ouverture", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("refuse la journée 2 tant que la journée 1 des deux équipes n'est pas close", async () => {
    const s = await setupSeason("guard");
    const first = s.rounds[0].pairings[0];
    const { next, homeToken } = secondMatchOf(s, first);

    const refused = await rawPost(sheetUrl(next.id), homeToken, {});
    expect(refused.status).toBe(409);
    const body = (await refused.json()) as Blocked;
    expect(body.success).toBe(false);
    expect(body.code).toBe("previous_match_pending");
    expect(body.details.canForce).toBe(false);
    // Les deux rencontres de la journée 1 bloquent : chacune implique une
    // des deux équipes de la journée 2.
    expect(body.details.blocking.map((b) => b.pairingId).sort()).toEqual(
      s.rounds[0].pairings.map((p) => p.id).sort(),
    );

    // Un coach ne peut pas forcer.
    const forcedByCoach = await rawPost(sheetUrl(next.id), homeToken, {
      force: true,
    });
    expect(forcedByCoach.status).toBe(409);

    // La journée 1 jouée et validée, la journée 2 s'ouvre normalement.
    for (const p of s.rounds[0].pairings) await playPairing(s, p);
    const opened = await rawPost(sheetUrl(next.id), homeToken, {});
    expect(opened.status).toBe(201);
  });

  it("le commissaire est averti, puis ouvre quand même une journée reportée", async () => {
    const s = await setupSeason("force");
    const first = s.rounds[0].pairings[0];
    const { next } = secondMatchOf(s, first);

    const warned = await rawPost(sheetUrl(next.id), s.commissionerToken, {});
    expect(warned.status).toBe(409);
    const body = (await warned.json()) as Blocked;
    expect(body.details.canForce).toBe(true);
    expect(body.error).toMatch(/commissaire/);

    const forced = await rawPost(sheetUrl(next.id), s.commissionerToken, {
      force: true,
    });
    expect(forced.status).toBe(201);
  });

  it("une rencontre de la journée 1 s'ouvre toujours", async () => {
    const s = await setupSeason("first");
    const first = s.rounds[0].pairings[0];
    const homeToken = s.tokensByUser.get(first.homeParticipant.team.ownerId)!;
    const res = await rawPost(sheetUrl(first.id), homeToken, {});
    expect(res.status).toBe(201);
  });
});

describe("E2E API — feuille de match à jour : mise à jour d'une feuille périmée", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("J2 ouverte avant la validation de J1 : signalée, puis mise à jour avec les gains de J1", async () => {
    const s = await setupSeason("refresh");
    const first = s.rounds[0].pairings[0];
    const { teamId, next, homeToken } = secondMatchOf(s, first);
    const side = next.homeParticipant.team.id === teamId ? "home" : "away";
    const url = sheetUrl(next.id);

    // Journée reportée : le commissaire ouvre la J2 avant que la J1 soit jouée.
    await post(url, s.commissionerToken, { force: true });
    const before = unwrap(await get<{ data: SheetResponse }>(url, homeToken));
    expect(before.snapshotFreshness).toEqual({
      home: null,
      away: null,
      refreshable: true,
    });
    const treasuryBefore = before.reference.budget[side].treasury;

    // La J1 de l'équipe est jouée et validée APRÈS l'ouverture de la J2 :
    // son TD lui rapporte des gains.
    await playPairing(s, first);
    const stale = unwrap(await get<{ data: SheetResponse }>(url, homeToken));
    expect(stale.snapshotFreshness?.[side]).toMatchObject({
      pairingId: first.id,
      kind: "validated",
    });
    // Le gel n'a pas bougé : la trésorerie figée ignore encore la J1.
    expect(stale.reference.budget[side].treasury).toBe(treasuryBefore);

    const refreshed = await rawPost(`${url}/refresh`, homeToken, {});
    expect(refreshed.status).toBe(200);
    const after = unwrap(await get<{ data: SheetResponse }>(url, homeToken));
    expect(after.snapshotFreshness?.[side]).toBeNull();
    expect(after.reference.budget[side].treasury).toBeGreaterThan(
      treasuryBefore,
    );
  });

  it("refuse la mise à jour d'une feuille déjà soumise", async () => {
    const s = await setupSeason("refresh-sub");
    const first = s.rounds[0].pairings[0];
    const homeToken = s.tokensByUser.get(first.homeParticipant.team.ownerId)!;
    const url = sheetUrl(first.id);
    await post(url, homeToken, {});
    await post(`${url}/submit`, homeToken, {});

    const res = await rawPost(`${url}/refresh`, homeToken, {});
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toMatch(
      /retirez les soumissions/,
    );
  });

  it("refuse un tiers", async () => {
    const s = await setupSeason("refresh-3rd");
    const first = s.rounds[0].pairings[0];
    const homeToken = s.tokensByUser.get(first.homeParticipant.team.ownerId)!;
    await post(sheetUrl(first.id), homeToken, {});
    // Un coach de la saison qui ne joue pas la rencontre et n'est pas
    // commissaire (le tirage décide de qui joue qui).
    const players = new Set([
      first.homeParticipant.team.ownerId,
      first.awayParticipant.team.ownerId,
    ]);
    const outsider = [...s.tokensByUser.entries()].find(
      ([userId, token]) =>
        !players.has(userId) && token !== s.commissionerToken,
    )![1];
    const res = await rawPost(`${sheetUrl(first.id)}/refresh`, outsider, {});
    expect(res.status).toBe(403);
  });
});
