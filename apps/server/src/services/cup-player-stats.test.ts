import { describe, it, expect } from 'vitest';
import {
  computeCupPlayerLeaderboards,
  type CupMatchForPlayerStats,
  type CupPlayerActionLike,
} from './cup-player-stats';

const teamA = { id: 'TA', name: 'Alpha', roster: 'skaven' };
const teamB = { id: 'TB', name: 'Beta', roster: 'orc' };

function act(p: Partial<CupPlayerActionLike>): CupPlayerActionLike {
  return {
    actionType: 'td',
    playerTeam: 'A',
    playerId: 'p1',
    playerName: 'Runner',
    armorBroken: false,
    opponentState: null,
    opponentId: null,
    opponentName: null,
    ...p,
  };
}

describe('computeCupPlayerLeaderboards', () => {
  it('agrège TD, passes, interceptions par joueur', () => {
    const match: CupMatchForPlayerStats = {
      teamA,
      teamB,
      actions: [
        act({ actionType: 'td', playerId: 'p1', playerName: 'Runner' }),
        act({ actionType: 'td', playerId: 'p1', playerName: 'Runner' }),
        act({ actionType: 'passe', playerId: 'p2', playerName: 'Thrower' }),
        act({ actionType: 'interception', playerTeam: 'B', playerId: 'q1', playerName: 'Blitzer' }),
      ],
    };
    const lb = computeCupPlayerLeaderboards([match], 5);
    expect(lb.topScorers[0]).toMatchObject({ playerId: 'p1', value: 2, teamName: 'Alpha' });
    expect(lb.topPassers[0]).toMatchObject({ playerId: 'p2', value: 1 });
    expect(lb.topInterceptors[0]).toMatchObject({ playerId: 'q1', value: 1, teamName: 'Beta' });
  });

  it('compte les sorties infligées (bloc) et l’agression, + sac de frappe côté victime', () => {
    const match: CupMatchForPlayerStats = {
      teamA,
      teamB,
      actions: [
        act({
          actionType: 'blocage',
          playerTeam: 'A',
          playerId: 'p3',
          playerName: 'Basher',
          armorBroken: true,
          opponentState: 'elimine',
          opponentId: 'q9',
          opponentName: 'Victim',
        }),
        act({
          actionType: 'aggression',
          playerTeam: 'A',
          playerId: 'p3',
          playerName: 'Basher',
          opponentState: 'elimine',
          opponentId: 'q9',
          opponentName: 'Victim',
        }),
        // KO seulement → pas une sortie
        act({
          actionType: 'blocage',
          playerTeam: 'A',
          playerId: 'p3',
          playerName: 'Basher',
          armorBroken: true,
          opponentState: 'ko',
          opponentId: 'q8',
          opponentName: 'Other',
        }),
      ],
    };
    const lb = computeCupPlayerLeaderboards([match], 5);
    expect(lb.topBashers[0]).toMatchObject({ playerId: 'p3', value: 1 });
    expect(lb.topAggressors[0]).toMatchObject({ playerId: 'p3', value: 1 });
    // La victime q9 a subi 2 sorties, rattachée à l'équipe adverse (Beta).
    expect(lb.topPunchingBags[0]).toMatchObject({
      playerId: 'q9',
      value: 2,
      teamName: 'Beta',
    });
  });

  it('ignore les actions sans playerId et borne à topN', () => {
    const match: CupMatchForPlayerStats = {
      teamA,
      teamB,
      actions: [
        act({ actionType: 'td', playerId: null }),
        act({ actionType: 'td', playerId: 'a', playerName: 'A' }),
        act({ actionType: 'td', playerId: 'b', playerName: 'B' }),
        act({ actionType: 'td', playerId: 'c', playerName: 'C' }),
      ],
    };
    const lb = computeCupPlayerLeaderboards([match], 2);
    expect(lb.topScorers).toHaveLength(2);
  });
});
