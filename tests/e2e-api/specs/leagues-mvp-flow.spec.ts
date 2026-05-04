/**
 * L2.A.13 — E2E API : MVP ligue de bout en bout (Sprint Ligues v2 PR3).
 *
 * Couvre le chemin happy path complet du Lot A :
 *
 *   1. Coach createur cree une ligue.
 *   2. Cree une saison.
 *   3. Inscrit deux equipes (la sienne + une 2e via un autre coach).
 *   4. Demarre la saison -> calendrier round-robin genere
 *      (1 round, 1 pairing pour 2 participants).
 *   5. Lance le match depuis le pairing.
 *   6. Force un forfait (cote home) via la route admin.
 *   7. Verifie le classement final : winner = away, loser = home,
 *      saison/round termines.
 *
 * Garde-fou anti-regression pour PR3 et pour toute future modif des
 * routes /leagues/seasons/:id/start, /leagues/pairings/:id/match, et
 * /leagues/pairings/:id/forfeit.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { get, post, unwrap, resetDb } from "../helpers/api";
import { seedAndLogin, createTeam } from "../helpers/factories";

interface LeagueDTO {
  id: string;
  creatorId: string;
}
interface SeasonDTO {
  id: string;
  leagueId: string;
  status: string;
}
interface StartSeasonDTO {
  seasonId: string;
  roundsCreated: number;
  pairingsCreated: number;
  status: string;
}
interface SeasonDetailDTO {
  season: {
    id: string;
    status: string;
    rounds: Array<{
      id: string;
      roundNumber: number;
      status: string;
      pairings: Array<{
        id: string;
        status: string;
        homeParticipant: {
          team: { id: string; ownerId: string; name: string };
        };
        awayParticipant: {
          team: { id: string; ownerId: string; name: string };
        };
        match: { id: string; status: string } | null;
      }>;
    }>;
  };
}
interface CreateMatchFromPairingDTO {
  created: boolean;
  matchId: string;
  pairingId: string;
}
interface ForfeitDTO {
  recorded?: boolean;
  pairingId?: string;
  side?: string;
  winnerParticipantId?: string;
  loserParticipantId?: string;
}
interface StandingsDTO {
  seasonId: string;
  standings: Array<{
    teamId: string;
    teamName: string;
    wins: number;
    losses: number;
    draws: number;
    points: number;
    touchdownsFor: number;
    touchdownsAgainst: number;
  }>;
}

describe("E2E API — MVP ligue : create -> start -> launch -> forfeit -> standings", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("flux complet Lot A : ligue 2 equipes -> 1 forfait -> classement coherent", async () => {
    // 1. Setup deux coachs avec une equipe chacun (rosters compatibles).
    const creator = await seedAndLogin("alice@mvp.test", "pwd", "Alice");
    const aliceTeam = await createTeam(
      creator.userId,
      "Alice Skavens",
      "skaven",
    );

    const challenger = await seedAndLogin("bob@mvp.test", "pwd", "Bob");
    const bobTeam = await createTeam(
      challenger.userId,
      "Bob Lizardmen",
      "lizardmen",
    );

    // 2. Creator cree la ligue.
    const league = unwrap(
      await post<{ success: true; data: LeagueDTO }>(
        "/leagues",
        creator.token,
        {
          name: "MVP Ligue 2",
          maxParticipants: 4,
        },
      ),
    );

    // 3. Cree une saison.
    const season = unwrap(
      await post<{ success: true; data: SeasonDTO }>(
        `/leagues/${league.id}/seasons`,
        creator.token,
        { name: "Saison 1" },
      ),
    );
    expect(season.status).toBe("draft");

    // 4. Les deux coachs inscrivent leur equipe.
    await post(`/leagues/seasons/${season.id}/join`, creator.token, {
      teamId: aliceTeam.teamId,
    });
    await post(`/leagues/seasons/${season.id}/join`, challenger.token, {
      teamId: bobTeam.teamId,
    });

    // 5. Creator demarre la saison -> 1 round, 1 pairing.
    const started = unwrap(
      await post<{ success: true; data: StartSeasonDTO }>(
        `/leagues/seasons/${season.id}/start`,
        creator.token,
        {},
      ),
    );
    expect(started.roundsCreated).toBe(1);
    expect(started.pairingsCreated).toBe(1);
    expect(started.status).toBe("in_progress");

    // 6. Recupere le pairing genere.
    const detail = unwrap(
      await get<{ success: true; data: SeasonDetailDTO }>(
        `/leagues/seasons/${season.id}`,
        creator.token,
      ),
    );
    const round = detail.season.rounds[0];
    expect(round.pairings).toHaveLength(1);
    const pairing = round.pairings[0];
    expect(pairing.status).toBe("scheduled");
    expect(pairing.match).toBeNull();

    // 7. Identifier le cote home (le coach proprietaire de l'equipe
    // home doit lancer le match). On fait un test conditionnel pour
    // ne pas dependre de l'ordre des participantIds dans le
    // generator round-robin (deterministe mais quand meme).
    const homeOwner = pairing.homeParticipant.team.ownerId;
    const awayOwner = pairing.awayParticipant.team.ownerId;
    const launchToken =
      homeOwner === creator.userId ? creator.token : challenger.token;

    // 8. Lance le match via l'endpoint pairing-to-match.
    const matchCreated = unwrap(
      await post<{ success: true; data: CreateMatchFromPairingDTO }>(
        `/leagues/pairings/${pairing.id}/match`,
        launchToken,
        {},
      ),
    );
    expect(matchCreated.created).toBe(true);
    expect(matchCreated.matchId).toBeTruthy();

    // 9. Verifie que le pairing est bien passe en in_progress.
    const detail2 = unwrap(
      await get<{ success: true; data: SeasonDetailDTO }>(
        `/leagues/seasons/${season.id}`,
        creator.token,
      ),
    );
    const pairing2 = detail2.season.rounds[0].pairings[0];
    expect(pairing2.status).toBe("in_progress");
    expect(pairing2.match?.id).toBe(matchCreated.matchId);

    // 10. Le creator force un forfait cote home.
    const forfeit = unwrap(
      await post<{ success: true; data: ForfeitDTO }>(
        `/leagues/pairings/${pairing.id}/forfeit`,
        creator.token,
        { side: "home" },
      ),
    );
    expect(forfeit.recorded).toBe(true);
    expect(forfeit.side).toBe("home");

    // 11. Verifie que le pairing est `forfeit_home`, le round
    // `completed`, et la saison `completed`.
    const detail3 = unwrap(
      await get<{ success: true; data: SeasonDetailDTO }>(
        `/leagues/seasons/${season.id}`,
        creator.token,
      ),
    );
    const pairing3 = detail3.season.rounds[0].pairings[0];
    expect(pairing3.status).toBe("forfeit_home");
    expect(detail3.season.rounds[0].status).toBe("completed");
    expect(detail3.season.status).toBe("completed");

    // 12. Verifie le classement : winner away (1 win, 2-0 TD,
    // bareme.winPoints=3 par default), loser home (1 loss, 0-2 TD,
    // bareme.forfeitPoints=-1 par default).
    const standings = unwrap(
      await get<{ success: true; data: StandingsDTO }>(
        `/leagues/seasons/${season.id}/standings`,
        creator.token,
      ),
    );
    expect(standings.standings).toHaveLength(2);
    const homeTeamId = pairing.homeParticipant.team.id;
    const awayTeamId = pairing.awayParticipant.team.id;
    const winnerRow = standings.standings.find(
      (r) => r.teamId === awayTeamId,
    );
    const loserRow = standings.standings.find(
      (r) => r.teamId === homeTeamId,
    );
    expect(winnerRow?.wins).toBe(1);
    expect(winnerRow?.losses).toBe(0);
    expect(winnerRow?.points).toBe(3);
    expect(winnerRow?.touchdownsFor).toBe(2);
    expect(winnerRow?.touchdownsAgainst).toBe(0);
    expect(loserRow?.wins).toBe(0);
    expect(loserRow?.losses).toBe(1);
    expect(loserRow?.points).toBe(-1);
    expect(loserRow?.touchdownsFor).toBe(0);
    expect(loserRow?.touchdownsAgainst).toBe(2);

    // Sanity: usage de homeOwner/awayOwner pour bind les variables
    // (lint).
    expect(homeOwner === creator.userId || homeOwner === challenger.userId).toBe(
      true,
    );
    expect(awayOwner === creator.userId || awayOwner === challenger.userId).toBe(
      true,
    );
  });
});
