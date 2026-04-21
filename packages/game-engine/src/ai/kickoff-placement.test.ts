/**
 * Tests for the AI kickoff ball placement helper.
 *
 * When the AI is the kicking team, the match must not hang on the
 * `place-ball` step of the kickoff sequence. `pickAIKickoffBallPosition`
 * picks a legal position in the receiving team's half; the returned
 * position must be accepted by `placeKickoffBall`.
 */
import { describe, it, expect } from 'vitest';
import {
  setupPreMatchWithTeams,
  startKickoffSequence,
  placeKickoffBall,
  type ExtendedGameState,
} from '../core/game-state';
import type { TeamId } from '../core/types';
import { pickAIKickoffBallPosition } from './kickoff-placement';

function buildKickoffState(kickingTeam: TeamId): ExtendedGameState {
  const mkPlayers = (team: TeamId) =>
    Array.from({ length: 11 }, (_, i) => ({
      id: `${team}${i + 1}`,
      name: `${team}${i + 1}`,
      position: 'Lineman',
      number: i + 1,
      ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '',
    }));

  const base = setupPreMatchWithTeams(mkPlayers('A'), mkPlayers('B'), 'Alpha', 'Beta');
  const receivingTeam: TeamId = kickingTeam === 'A' ? 'B' : 'A';

  const atKickoff: ExtendedGameState = {
    ...base,
    preMatch: {
      ...base.preMatch,
      phase: 'kickoff',
      kickingTeam,
      receivingTeam,
    },
  };

  return startKickoffSequence(atKickoff);
}

describe('pickAIKickoffBallPosition', () => {
  it('returns a position in the receiving half when AI is team A (kicking)', () => {
    const state = buildKickoffState('A');
    const pos = pickAIKickoffBallPosition(state, 'A');
    // Receiving team is B → x in [13, 24]
    expect(pos.x).toBeGreaterThanOrEqual(13);
    expect(pos.x).toBeLessThanOrEqual(24);
    expect(pos.y).toBeGreaterThanOrEqual(0);
    expect(pos.y).toBeLessThanOrEqual(14);
  });

  it('returns a position in the receiving half when AI is team B (kicking)', () => {
    const state = buildKickoffState('B');
    const pos = pickAIKickoffBallPosition(state, 'B');
    // Receiving team is A → x in [1, 12]
    expect(pos.x).toBeGreaterThanOrEqual(1);
    expect(pos.x).toBeLessThanOrEqual(12);
    expect(pos.y).toBeGreaterThanOrEqual(0);
    expect(pos.y).toBeLessThanOrEqual(14);
  });

  it('returned position is accepted by placeKickoffBall and advances to kick-deviation', () => {
    const state = buildKickoffState('A');
    const pos = pickAIKickoffBallPosition(state, 'A');
    const next = placeKickoffBall(state, pos);
    expect(next.preMatch.kickoffStep).toBe('kick-deviation');
    expect(next.preMatch.ballPosition).toEqual(pos);
  });

  it('is deterministic (same state, same team → same position)', () => {
    const state = buildKickoffState('B');
    const p1 = pickAIKickoffBallPosition(state, 'B');
    const p2 = pickAIKickoffBallPosition(state, 'B');
    expect(p1).toEqual(p2);
  });
});
