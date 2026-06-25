/**
 * E2E API — Feuille de match ligue physique de bout en bout.
 *
 * Verrouille le parcours « 2 coachs saisissent + valident -> commissaire
 * valide -> classement / equipes a jour », ainsi que la reversion a
 * l'invalidation. Garde-fou anti-regression pour les chantiers :
 *   - achats = mutation de roster reversible (relance + joueur cree) ;
 *   - licenciements (firedAt) reversibles ;
 *   - effets standings / tresorerie / SPP appliques a la validation.
 *
 * Scenario 1 (happy path) : ligue 2 equipes -> feuille (events + pre/post
 *   match) -> submit des 2 coachs -> validation commissaire -> verif
 *   standings + tresorerie + SPP + roster -> invalidation autorisee ->
 *   verif reversion exacte.
 * Scenario 2 : invalidation BLOQUEE quand les 2 equipes ont rejoue plus tard.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, rawPatch, rawPost, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface SheetPlayer {
  id: string;
  number: number;
  name: string;
  position: string;
  dead: boolean;
  spp: number;
}
interface SheetResponse {
  sheet: { status: string };
  summary: { scoreHome: number; scoreAway: number };
  teams: {
    home: { teamId: string; roster: string; players: SheetPlayer[] } | null;
    away: { teamId: string; roster: string; players: SheetPlayer[] } | null;
  };
}
interface SeasonDetailDTO {
  season: {
    rounds: Array<{
      roundNumber: number;
      pairings: Array<{
        id: string;
        status: string;
        homeParticipant: { team: { id: string; ownerId: string } };
        awayParticipant: { team: { id: string; ownerId: string } };
      }>;
    }>;
  };
}
interface StandingsDTO {
  standings: Array<{
    teamId: string;
    wins: number;
    losses: number;
    points: number;
    touchdownsFor: number;
  }>;
}
interface TeamDetailDTO {
  team: {
    treasury: number;
    rerolls: number;
    players: Array<{
      id: string;
      name: string;
      position: string;
      spp: number;
      firedAt: string | null;
    }>;
  };
}
interface ValidateDTO {
  sheet: { status: string };
  summary: { scoreHome: number; scoreAway: number };
  effects: { applied: boolean };
}

async function setupLeagueWithPairing(
  prefix: string,
  count: 2 | 4,
): Promise<{
  seasonId: string;
  creatorToken: string;
  tokensByUser: Map<string, string>;
  detail: SeasonDetailDTO;
}> {
  const creator = await seedAndLogin(`${prefix}-alice@sheet.test`, "pwd", "Alice");
  const aliceTeam = await createTeam(creator.userId, `${prefix} Skavens`, "skaven");
  const challenger = await seedAndLogin(`${prefix}-bob@sheet.test`, "pwd", "Bob");
  const bobTeam = await createTeam(challenger.userId, `${prefix} Lizards`, "lizardmen");

  const tokensByUser = new Map<string, string>([
    [creator.userId, creator.token],
    [challenger.userId, challenger.token],
  ]);

  const league = unwrap(
    await post<{ data: { id: string } }>("/leagues", creator.token, {
      name: `${prefix} Sheet League`,
      maxParticipants: 4,
    }),
  );
  const season = unwrap(
    await post<{ data: { id: string } }>(
      `/leagues/${league.id}/seasons`,
      creator.token,
      { name: "S1" },
    ),
  );
  await post(`/leagues/seasons/${season.id}/join`, creator.token, {
    teamId: aliceTeam.teamId,
  });
  await post(`/leagues/seasons/${season.id}/join`, challenger.token, {
    teamId: bobTeam.teamId,
  });

  if (count === 4) {
    const carol = await seedAndLogin(`${prefix}-carol@sheet.test`, "pwd", "Carol");
    const carolTeam = await createTeam(carol.userId, `${prefix} Orcs`, "skaven");
    const dan = await seedAndLogin(`${prefix}-dan@sheet.test`, "pwd", "Dan");
    const danTeam = await createTeam(dan.userId, `${prefix} Elves`, "lizardmen");
    tokensByUser.set(carol.userId, carol.token);
    tokensByUser.set(dan.userId, dan.token);
    await post(`/leagues/seasons/${season.id}/join`, carol.token, {
      teamId: carolTeam.teamId,
    });
    await post(`/leagues/seasons/${season.id}/join`, dan.token, {
      teamId: danTeam.teamId,
    });
  }

  await post(`/leagues/seasons/${season.id}/start`, creator.token, {});
  const detail = unwrap(
    await get<{ data: SeasonDetailDTO }>(
      `/leagues/seasons/${season.id}`,
      creator.token,
    ),
  );
  return {
    seasonId: season.id,
    creatorToken: creator.token,
    tokensByUser,
    detail,
  };
}

describe("E2E API — feuille de match : saisie 2 coachs -> validation -> reversion", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("happy path : effets standings/tresorerie/SPP/roster + invalidation reversible", async () => {
    // 4 equipes : valider 1 pairing de round 1 laisse la saison `in_progress`
    // (donc l'invalidation reste autorisee — pas de `season-completed`).
    const { seasonId, creatorToken, tokensByUser, detail } =
      await setupLeagueWithPairing("hp", 4);

    const pairing = detail.season.rounds[0].pairings[0];
    const homeTeamId = pairing.homeParticipant.team.id;
    const homeToken = tokensByUser.get(pairing.homeParticipant.team.ownerId)!;
    const awayToken = tokensByUser.get(pairing.awayParticipant.team.ownerId)!;
    const sheetUrl = `/leagues/pairings/${pairing.id}/sheet`;

    // Ouverture + lecture des joueurs (pickers).
    await post(sheetUrl, homeToken, {});
    const opened = unwrap(await get<{ data: SheetResponse }>(sheetUrl, homeToken));
    const homePlayers = opened.teams.home!.players;
    const awayPlayers = opened.teams.away!.players;
    const homeRoster = opened.teams.home!.roster;
    const tdScorer = homePlayers[0].id;
    const mvp = homePlayers[1].id;
    const firedPlayer = homePlayers[2].id;
    const awayScorer = awayPlayers[0].id;

    // Events : 2 TD home + 1 TD away -> score 2-1.
    await post(`${sheetUrl}/events`, homeToken, {
      kind: "touchdown",
      team: "home",
      actorPlayerId: tdScorer,
    });
    await post(`${sheetUrl}/events`, homeToken, {
      kind: "touchdown",
      team: "home",
      actorPlayerId: tdScorer,
    });
    await post(`${sheetUrl}/events`, awayToken, {
      kind: "touchdown",
      team: "away",
      actorPlayerId: awayScorer,
    });

    // Avant-match.
    const pre = await rawPatch(`${sheetUrl}/pre-match`, homeToken, {
      weatherTable: "classique",
      popularityHome: 5,
      popularityAway: 3,
    });
    expect(pre.ok).toBe(true);

    // Apres-match : gains (override), MVP, achats (relance + joueur), licenciement.
    const postRes = await rawPatch(`${sheetUrl}/post-match`, homeToken, {
      winningsHomeManual: 150000,
      motmPlayerIds: [mvp],
      purchasesHome: [
        { kind: "reroll", name: "Relance", cost: 50000 },
        {
          kind: "player",
          name: "Recrue",
          cost: 50000,
          position: `${homeRoster}_lineman`,
        },
      ],
      firedPlayerIds: [firedPlayer],
    });
    expect(postRes.ok).toBe(true);

    // Submit des 2 coachs -> both_submitted, puis validation commissaire.
    await post(`${sheetUrl}/submit`, homeToken, {});
    await post(`${sheetUrl}/submit`, awayToken, {});
    const validated = unwrap(
      await post<{ data: ValidateDTO }>(`${sheetUrl}/validate`, creatorToken, {}),
    );
    expect(validated.sheet.status).toBe("validated");
    expect(validated.effects.applied).toBe(true);
    expect(validated.summary.scoreHome).toBe(2);
    expect(validated.summary.scoreAway).toBe(1);

    // Standings : home gagne (2-1), 3 pts, 2 TD.
    const standings = unwrap(
      await get<{ data: StandingsDTO }>(
        `/leagues/seasons/${seasonId}/standings`,
        creatorToken,
      ),
    );
    const homeRow = standings.standings.find((r) => r.teamId === homeTeamId)!;
    expect(homeRow.wins).toBe(1);
    expect(homeRow.points).toBe(3);
    expect(homeRow.touchdownsFor).toBe(2);

    // Equipe home : tresorerie (150k - 100k achats = 50k), relance +1,
    // joueur cree, joueur licencie, SPP appliques.
    const home = unwrap(
      await get<{ data: TeamDetailDTO }>(`/team/${homeTeamId}`, homeToken),
    ).team;
    expect(home.treasury).toBe(50000);
    expect(home.rerolls).toBe(1);
    const recrue = home.players.find((p) => p.name === "Recrue");
    expect(recrue).toBeTruthy();
    expect(recrue!.position).toBe(`${homeRoster}_lineman`);
    expect(home.players).toHaveLength(12); // 11 + Recrue (le licencie reste en base)
    const firedNow = home.players.filter((p) => p.firedAt);
    expect(firedNow).toHaveLength(1);
    expect(firedNow[0].id).toBe(firedPlayer);
    expect(home.players.find((p) => p.id === mvp)!.spp).toBeGreaterThan(0);
    expect(home.players.find((p) => p.id === tdScorer)!.spp).toBeGreaterThan(0);

    // Le licencie n'apparait plus dans les pickers.
    const afterFire = unwrap(
      await get<{ data: SheetResponse }>(sheetUrl, homeToken),
    );
    expect(afterFire.teams.home!.players.some((p) => p.id === firedPlayer)).toBe(
      false,
    );

    // Invalidation autorisee (aucun match ulterieur) -> reversion.
    const canInval = unwrap(
      await get<{ data: { ok: boolean } }>(
        `${sheetUrl}/can-invalidate`,
        creatorToken,
      ),
    );
    expect(canInval.ok).toBe(true);
    const inval = unwrap(
      await post<{ data: { sheet: { status: string } } }>(
        `${sheetUrl}/invalidate`,
        creatorToken,
        { reason: "E2E" },
      ),
    );
    expect(inval.sheet.status).toBe("invalidated");

    // Reversion exacte : tresorerie 0, relance 0, joueur cree supprime,
    // licencie re-active, standings remis a zero.
    const homeAfter = unwrap(
      await get<{ data: TeamDetailDTO }>(`/team/${homeTeamId}`, homeToken),
    ).team;
    expect(homeAfter.treasury).toBe(0);
    expect(homeAfter.rerolls).toBe(0);
    expect(homeAfter.players).toHaveLength(11);
    expect(homeAfter.players.filter((p) => p.firedAt)).toHaveLength(0);
    const standingsAfter = unwrap(
      await get<{ data: StandingsDTO }>(
        `/leagues/seasons/${seasonId}/standings`,
        creatorToken,
      ),
    );
    expect(
      standingsAfter.standings.find((r) => r.teamId === homeTeamId)!.wins,
    ).toBe(0);
  });

  it("invalidation bloquee quand les 2 equipes ont rejoue plus tard", async () => {
    const { seasonId, creatorToken, tokensByUser, detail } =
      await setupLeagueWithPairing("blk", 4);

    // Pairing de round 1 a valider.
    const round1 = detail.season.rounds[0];
    const target = round1.pairings[0];
    const teamX = target.homeParticipant.team.id;
    const teamY = target.awayParticipant.team.id;
    const xToken = tokensByUser.get(target.homeParticipant.team.ownerId)!;
    const yToken = tokensByUser.get(target.awayParticipant.team.ownerId)!;
    const sheetUrl = `/leagues/pairings/${target.id}/sheet`;

    // Feuille minimale (0-0) validee.
    await post(sheetUrl, xToken, {});
    await post(`${sheetUrl}/submit`, xToken, {});
    await post(`${sheetUrl}/submit`, yToken, {});
    const validated = unwrap(
      await post<{ data: ValidateDTO }>(`${sheetUrl}/validate`, creatorToken, {}),
    );
    expect(validated.sheet.status).toBe("validated");

    // Les 2 equipes rejouent un pairing ULTERIEUR (forfait commissaire) :
    // on forfait tout pairing des rounds suivants impliquant X ou Y.
    for (const round of detail.season.rounds) {
      if (round.roundNumber <= round1.roundNumber) continue;
      for (const p of round.pairings) {
        const involvesX =
          p.homeParticipant.team.id === teamX ||
          p.awayParticipant.team.id === teamX;
        const involvesY =
          p.homeParticipant.team.id === teamY ||
          p.awayParticipant.team.id === teamY;
        if (involvesX || involvesY) {
          await post(`/leagues/pairings/${p.id}/forfeit`, creatorToken, {
            side: "home",
          });
        }
      }
    }

    // Fenetre fermee : les 2 equipes ont rejoue.
    const canInval = unwrap(
      await get<{ data: { ok: boolean; reason?: string } }>(
        `${sheetUrl}/can-invalidate`,
        creatorToken,
      ),
    );
    expect(canInval.ok).toBe(false);
    expect(canInval.reason).toBe("both_teams_played_later");

    // L'invalidation est rejetee (4xx).
    const res = await rawPost(`${sheetUrl}/invalidate`, creatorToken, {
      reason: "trop tard",
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
