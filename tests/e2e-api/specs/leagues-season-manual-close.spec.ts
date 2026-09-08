/**
 * E2E API — la cloture d'une saison est un acte du commissaire.
 *
 * Regression couverte : le dernier resultat valide fermait la saison de
 * lui-meme (`status = completed`), et une erreur de saisie sur ce dernier
 * match devenait definitive (« Reversion impossible: season-completed »).
 *
 * Desormais :
 *   - le dernier match valide complete la JOURNEE, la saison reste
 *     `in_progress` et son dernier resultat s'invalide ;
 *   - `POST /leagues/seasons/:id/close` (commissaire) cloture la saison ;
 *   - une fois cloturee, l'invalidation est refusee (`season-completed`).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawPost, unwrap, resetDb } from "../helpers/api";
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
interface SeasonDetailDTO {
  season: { id: string; status: string; rounds: RoundDTO[] };
}
interface SheetDTO {
  teams: { home: { players: Array<{ id: string }> } | null };
}

async function setupTwoTeamSeason(prefix: string): Promise<{
  seasonId: string;
  commissionerToken: string;
  tokensByUser: Map<string, string>;
}> {
  const alice = await seedAndLogin(`${prefix}-alice@close.test`, "pwd", "Alice");
  const aliceTeam = await createTeam(alice.userId, `${prefix} Rats`, "skaven");
  const bob = await seedAndLogin(`${prefix}-bob@close.test`, "pwd", "Bob");
  const bobTeam = await createTeam(bob.userId, `${prefix} Lizards`, "lizardmen");
  const tokensByUser = new Map<string, string>([
    [alice.userId, alice.token],
    [bob.userId, bob.token],
  ]);

  const league = unwrap(
    await post<{ data: { id: string } }>("/leagues", alice.token, {
      name: `${prefix} Close League`,
      maxParticipants: 4,
    }),
  );
  const season = unwrap(
    await post<{ data: { id: string } }>(
      `/leagues/${league.id}/seasons`,
      alice.token,
      { name: "S1" },
    ),
  );
  await post(`/leagues/seasons/${season.id}/join`, alice.token, {
    teamId: aliceTeam.teamId,
  });
  await post(`/leagues/seasons/${season.id}/join`, bob.token, {
    teamId: bobTeam.teamId,
  });
  // 2 equipes : une seule journee, un seul match — le "dernier match de la
  // saison" est aussi le premier.
  await post(`/leagues/seasons/${season.id}/start`, alice.token, {});

  return {
    seasonId: season.id,
    commissionerToken: alice.token,
    tokensByUser,
  };
}

async function loadSeason(
  seasonId: string,
  token: string,
): Promise<SeasonDetailDTO["season"]> {
  return unwrap(
    await get<{ data: SeasonDetailDTO }>(`/leagues/seasons/${seasonId}`, token),
  ).season;
}

/** Saisit et valide la feuille : `home` gagne 2-0. */
async function playPairing(
  pairing: PairingDTO,
  tokensByUser: Map<string, string>,
  commissionerToken: string,
): Promise<void> {
  const homeToken = tokensByUser.get(pairing.homeParticipant.team.ownerId)!;
  const awayToken = tokensByUser.get(pairing.awayParticipant.team.ownerId)!;
  const url = `/leagues/pairings/${pairing.id}/sheet`;
  await post(url, homeToken, {});
  const sheet = unwrap(await get<{ data: SheetDTO }>(url, homeToken));
  const scorer = sheet.teams.home!.players[0].id;
  for (let i = 0; i < 2; i++) {
    await post(`${url}/events`, homeToken, {
      kind: "touchdown",
      team: "home",
      actorPlayerId: scorer,
    });
  }
  await post(`${url}/submit`, homeToken, {});
  await post(`${url}/submit`, awayToken, {});
  await post(`${url}/validate`, commissionerToken, {});
}

describe("E2E API — cloture manuelle de la saison", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("le dernier match de la saison reste invalidable tant que le commissaire n'a pas cloture", async () => {
    const { seasonId, commissionerToken, tokensByUser } =
      await setupTwoTeamSeason("last");

    const before = await loadSeason(seasonId, commissionerToken);
    expect(before.rounds).toHaveLength(1);
    const pairing = before.rounds[0].pairings[0];
    await playPairing(pairing, tokensByUser, commissionerToken);

    // La journee est complete, la saison NON.
    const played = await loadSeason(seasonId, commissionerToken);
    expect(played.rounds[0].status).toBe("completed");
    expect(played.rounds[0].pairings[0].status).toBe("played");
    expect(played.status).toBe("in_progress");

    // Le dernier resultat s'invalide : c'est le bug corrige.
    const invalidated = await rawPost(
      `/leagues/pairings/${pairing.id}/sheet/invalidate`,
      commissionerToken,
      {},
    );
    expect(
      invalidated.status,
      `invalidation refusee : ${JSON.stringify(await invalidated.json().catch(() => null))}`,
    ).toBe(200);

    const reopened = await loadSeason(seasonId, commissionerToken);
    expect(reopened.rounds[0].pairings[0].status).toBe("scheduled");
    // La journee re-ouverte porte un statut connu du calendrier.
    expect(reopened.rounds[0].status).toBe("in_progress");
    expect(reopened.status).toBe("in_progress");
  });

  it("la cloture par le commissaire fige la saison : plus d'invalidation ensuite", async () => {
    const { seasonId, commissionerToken, tokensByUser } =
      await setupTwoTeamSeason("close");

    const before = await loadSeason(seasonId, commissionerToken);
    const pairing = before.rounds[0].pairings[0];
    await playPairing(pairing, tokensByUser, commissionerToken);

    // Un coach non commissaire ne peut pas cloturer.
    const bobToken = tokensByUser.get(pairing.awayParticipant.team.ownerId)!;
    const nonCommissioner =
      bobToken === commissionerToken
        ? tokensByUser.get(pairing.homeParticipant.team.ownerId)!
        : bobToken;
    const forbidden = await rawPost(
      `/leagues/seasons/${seasonId}/close`,
      nonCommissioner,
      {},
    );
    expect(forbidden.status).toBe(403);

    const closed = unwrap(
      await post<{ data: { seasonId: string; status: string } }>(
        `/leagues/seasons/${seasonId}/close`,
        commissionerToken,
        {},
      ),
    );
    expect(closed.status).toBe("completed");

    const after = await loadSeason(seasonId, commissionerToken);
    expect(after.status).toBe("completed");
    expect(after.rounds[0].pairings[0].status).toBe("played");

    // Le classement final est fige : l'invalidation est refusee.
    const refused = await rawPost(
      `/leagues/pairings/${pairing.id}/sheet/invalidate`,
      commissionerToken,
      {},
    );
    expect(refused.status).toBe(409);
    const body = await refused.json();
    expect(JSON.stringify(body)).toContain("season-completed");
  });
});
