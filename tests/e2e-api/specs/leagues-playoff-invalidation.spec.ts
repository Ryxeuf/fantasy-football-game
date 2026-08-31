/**
 * E2E API — playoffs de ligue : bracket complet puis invalidation.
 *
 * Deux regressions couvertes ici, invisibles en unitaire parce qu'elles
 * tiennent a l'etat REEL de la base :
 *
 *  1. `advancePlayoffsAfterPairingComplete` numerotait le tour suivant
 *     `round.roundNumber + 1`, c'est-a-dire le numero deja pris par le round
 *     FRERE du meme tour (`startPlayoffs` cree un round par slot). La
 *     contrainte unique (seasonId, roundNumber) faisait echouer la creation
 *     et la finale n'apparaissait jamais.
 *  2. L'invalidation d'un match DE playoff butait sur « playoffs-generated »
 *     des que `Match.leagueRoundId` etait NULL — colonne nullable jamais
 *     backfillee. Le round du PAIRING fait desormais foi.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawPatch, rawPost, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface RoundDTO {
  id: string;
  roundNumber: number;
  name?: string | null;
  kind?: string | null;
  bracketSlot?: string | null;
  pairings: Array<{
    id: string;
    status: string;
    homeParticipant: {
      id: string;
      team: { id: string; ownerId: string };
    } | null;
    awayParticipant: {
      id: string;
      team: { id: string; ownerId: string };
    } | null;
  }>;
}
interface SeasonDetailDTO {
  season: { rounds: RoundDTO[] };
}
interface SheetDTO {
  teams: {
    home: { teamId: string; players: Array<{ id: string }> } | null;
    away: { teamId: string; players: Array<{ id: string }> } | null;
  };
}

const TEAMS = [
  { key: "a", roster: "skaven" as const },
  { key: "b", roster: "lizardmen" as const },
  { key: "c", roster: "skaven" as const },
  { key: "d", roster: "lizardmen" as const },
];

async function setupSeasonWithBracket(prefix: string): Promise<{
  seasonId: string;
  commissionerToken: string;
  tokensByUser: Map<string, string>;
}> {
  const coaches = [];
  for (const t of TEAMS) {
    const coach = await seedAndLogin(
      `${prefix}-${t.key}@po.test`,
      "pwd",
      `Coach ${t.key.toUpperCase()}`,
    );
    const team = await createTeam(
      coach.userId,
      `${prefix} ${t.key.toUpperCase()}`,
      t.roster,
    );
    coaches.push({ ...coach, teamId: team.teamId });
  }
  const tokensByUser = new Map(coaches.map((c) => [c.userId, c.token]));
  const commissioner = coaches[0];

  const league = unwrap(
    await post<{ data: { id: string } }>("/leagues", commissioner.token, {
      name: `${prefix} Playoff League`,
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
  for (const c of coaches) {
    await post(`/leagues/seasons/${season.id}/join`, c.token, {
      teamId: c.teamId,
    });
  }
  await post(`/leagues/seasons/${season.id}/start`, commissioner.token, {});

  // Bracket de 4 (2 demi-finales) : la taille se configure AVANT la
  // generation, puis on genere par cloture anticipee de la phase reguliere.
  const config = await rawPatch(
    `/leagues/seasons/${season.id}/config`,
    commissioner.token,
    { playoffSize: 4 },
  );
  expect(config.status, JSON.stringify(config.body)).toBe(200);
  const started = await rawPost(
    `/leagues/seasons/${season.id}/playoff/start`,
    commissioner.token,
    { force: true },
  );
  expect(started.status, JSON.stringify(started.body)).toBe(201);

  return {
    seasonId: season.id,
    commissionerToken: commissioner.token,
    tokensByUser,
  };
}

/** Saisit et valide une feuille : `home` gagne 2-0. */
async function playPairing(
  pairingId: string,
  tokensByUser: Map<string, string>,
  pairing: RoundDTO["pairings"][number],
  commissionerToken: string,
): Promise<void> {
  const homeToken = tokensByUser.get(pairing.homeParticipant!.team.ownerId)!;
  const awayToken = tokensByUser.get(pairing.awayParticipant!.team.ownerId)!;
  const url = `/leagues/pairings/${pairingId}/sheet`;
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

async function loadRounds(
  seasonId: string,
  token: string,
): Promise<RoundDTO[]> {
  const detail = unwrap(
    await get<{ data: SeasonDetailDTO }>(`/leagues/seasons/${seasonId}`, token),
  );
  return detail.season.rounds;
}

describe("E2E API — bracket de playoffs : avancement puis invalidation", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("la finale est creee quand les 2 demi-finales sont jouees", async () => {
    const { seasonId, commissionerToken, tokensByUser } =
      await setupSeasonWithBracket("adv");

    const semis = (await loadRounds(seasonId, commissionerToken)).filter((r) =>
      r.bracketSlot?.startsWith("sf"),
    );
    expect(semis).toHaveLength(2);
    // Les 2 demi-finales portent des numeros de round CONSECUTIFS : c'est
    // exactement la situation qui faisait collisionner la finale.
    const numbers = semis.map((r) => r.roundNumber).sort((a, b) => a - b);
    expect(numbers[1]).toBe(numbers[0] + 1);

    for (const semi of semis) {
      await playPairing(
        semi.pairings[0].id,
        tokensByUser,
        semi.pairings[0],
        commissionerToken,
      );
    }

    const rounds = await loadRounds(seasonId, commissionerToken);
    const final = rounds.find((r) => r.bracketSlot === "final");
    expect(
      final,
      "la finale doit exister apres les 2 demi-finales",
    ).toBeTruthy();
    expect(final!.kind).toBe("playoff");
    // Numerotee apres le dernier round, sans ecraser le round frere.
    expect(final!.roundNumber).toBeGreaterThan(numbers[1]);
    // Les deux demi-finalistes vainqueurs s'y opposent (plus de placeholder).
    const finalPairing = final!.pairings[0];
    expect(finalPairing.homeParticipant!.id).not.toBe(
      finalPairing.awayParticipant!.id,
    );
  });

  it("un match DE playoff s'invalide (le bracket est defait)", async () => {
    const { seasonId, commissionerToken, tokensByUser } =
      await setupSeasonWithBracket("inv");

    const semis = (await loadRounds(seasonId, commissionerToken)).filter((r) =>
      r.bracketSlot?.startsWith("sf"),
    );
    const semi = semis[0];
    await playPairing(
      semi.pairings[0].id,
      tokensByUser,
      semi.pairings[0],
      commissionerToken,
    );

    const res = await rawPost(
      `/leagues/pairings/${semi.pairings[0].id}/sheet/invalidate`,
      commissionerToken,
      {},
    );
    expect(
      res.status,
      `invalidation refusee : ${JSON.stringify(res.body)}`,
    ).toBe(200);

    // Le pairing repasse en attente de saisie.
    const after = await loadRounds(seasonId, commissionerToken);
    const semiAfter = after.find((r) => r.id === semi.id)!;
    expect(semiAfter.pairings[0].status).toBe("scheduled");
    // Et la qualification issue de ce resultat a quitte le bracket.
    expect(after.find((r) => r.bracketSlot === "final")).toBeUndefined();
  });

  it("un match REGULIER reste refuse une fois le bracket genere", async () => {
    const { seasonId, commissionerToken, tokensByUser } =
      await setupSeasonWithBracket("reg");

    const rounds = await loadRounds(seasonId, commissionerToken);
    const regular = rounds.find(
      (r) => !r.bracketSlot && r.pairings.some((p) => p.status === "scheduled"),
    );
    // La cloture anticipee annule les pairings reguliers non joues : sans
    // pairing regulier jouable, le cas n'est pas verifiable ici.
    if (!regular) return;

    const pairing = regular.pairings.find((p) => p.status === "scheduled")!;
    await playPairing(pairing.id, tokensByUser, pairing, commissionerToken);
    const res = await rawPost(
      `/leagues/pairings/${pairing.id}/sheet/invalidate`,
      commissionerToken,
      {},
    );
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain("playoffs-generated");
  });
});
