import { describe, it, expect } from 'vitest';
import {
  setupPreMatchWithTeams,
  enterSetupPhase,
  validatePlayerPlacement,
  type ExtendedGameState,
} from '../core/game-state';
import type { TeamId } from '../core/types';
import { autoSetupAITeam, buildAISetupPositions } from './setup-placement';

function createSetupState(
  receivingTeam: TeamId = 'A',
  currentCoach: TeamId = 'A',
): ExtendedGameState {
  const teamAPlayers = [];
  const teamBPlayers = [];
  for (let i = 1; i <= 11; i += 1) {
    teamAPlayers.push({
      id: `A${i}`,
      name: `Player A${i}`,
      position: 'Lineman',
      number: i,
      ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '',
    });
    teamBPlayers.push({
      id: `B${i}`,
      name: `Player B${i}`,
      position: 'Lineman',
      number: i,
      ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '',
    });
  }

  const base = setupPreMatchWithTeams(
    teamAPlayers,
    teamBPlayers,
    'Team Alpha',
    'Team Beta',
  );

  const withCoinToss: ExtendedGameState = {
    ...base,
    preMatch: {
      ...base.preMatch,
      kickingTeam: receivingTeam === 'A' ? 'B' : 'A',
      receivingTeam,
    },
  };

  return enterSetupPhase(withCoinToss, currentCoach);
}

describe('buildAISetupPositions', () => {
  it('returns 11 positions for team A', () => {
    expect(buildAISetupPositions('A')).toHaveLength(11);
  });

  it('returns 11 positions for team B', () => {
    expect(buildAISetupPositions('B')).toHaveLength(11);
  });

  it('includes exactly 3 LOS positions for team A (x=12)', () => {
    const losCount = buildAISetupPositions('A').filter((p) => p.x === 12).length;
    expect(losCount).toBe(3);
  });

  it('includes exactly 3 LOS positions for team B (x=13)', () => {
    const losCount = buildAISetupPositions('B').filter((p) => p.x === 13).length;
    expect(losCount).toBe(3);
  });

  it('respects wide zone limits (max 2 per zone)', () => {
    const positions = buildAISetupPositions('A');
    expect(positions.filter((p) => p.y <= 2).length).toBeLessThanOrEqual(2);
    expect(positions.filter((p) => p.y >= 12).length).toBeLessThanOrEqual(2);
  });

  it('produces no duplicate positions', () => {
    const positions = buildAISetupPositions('A');
    const keys = new Set(positions.map((p) => `${p.x},${p.y}`));
    expect(keys.size).toBe(positions.length);
  });

  it('places team A players on their own half only (x in 1..12)', () => {
    buildAISetupPositions('A').forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(1);
      expect(p.x).toBeLessThanOrEqual(12);
    });
  });

  it('places team B players on their own half only (x in 13..24)', () => {
    buildAISetupPositions('B').forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(13);
      expect(p.x).toBeLessThanOrEqual(24);
    });
  });
});

describe('autoSetupAITeam', () => {
  it('places all 11 players of the AI team on the pitch', () => {
    const placed = autoSetupAITeam(createSetupState('A', 'A'), 'A');
    expect(placed.players.filter((p) => p.team === 'A' && p.pos.x >= 0)).toHaveLength(11);
  });

  it('satisfies the LOS minimum (>= 3 on x=12 for team A)', () => {
    const placed = autoSetupAITeam(createSetupState('A', 'A'), 'A');
    const losCount = placed.players.filter((p) => p.team === 'A' && p.pos.x === 12).length;
    expect(losCount).toBeGreaterThanOrEqual(3);
  });

  it('satisfies the LOS minimum for team B (x=13)', () => {
    const placed = autoSetupAITeam(createSetupState('B', 'B'), 'B');
    const losCount = placed.players.filter((p) => p.team === 'B' && p.pos.x === 13).length;
    expect(losCount).toBeGreaterThanOrEqual(3);
  });

  it('respects wide zone limits for team A', () => {
    const placed = autoSetupAITeam(createSetupState('A', 'A'), 'A');
    const teamOnField = placed.players.filter((p) => p.team === 'A' && p.pos.x >= 0);
    expect(teamOnField.filter((p) => p.pos.y <= 2).length).toBeLessThanOrEqual(2);
    expect(teamOnField.filter((p) => p.pos.y >= 12).length).toBeLessThanOrEqual(2);
  });

  it('is a no-op when not in setup phase', () => {
    const base = createSetupState('A', 'A');
    const offSetup: ExtendedGameState = {
      ...base,
      preMatch: { ...base.preMatch, phase: 'kickoff' },
    };
    const placed = autoSetupAITeam(offSetup, 'A');
    expect(placed.players.filter((p) => p.team === 'A' && p.pos.x >= 0)).toHaveLength(0);
  });

  it('is a no-op when the currentCoach is not the AI', () => {
    const placed = autoSetupAITeam(createSetupState('A', 'A'), 'B');
    expect(placed.players.filter((p) => p.team === 'B' && p.pos.x >= 0)).toHaveLength(0);
  });

  it('allows validatePlayerPlacement to advance to the next coach', () => {
    const placed = autoSetupAITeam(createSetupState('A', 'A'), 'A');
    const validated = validatePlayerPlacement(placed);
    expect(validated.preMatch.phase).toBe('setup');
    expect(validated.preMatch.currentCoach).toBe('B');
  });

  it('produces no overlapping players', () => {
    const placed = autoSetupAITeam(createSetupState('A', 'A'), 'A');
    const occupied = new Set<string>();
    placed.players
      .filter((p) => p.pos.x >= 0)
      .forEach((p) => {
        const key = `${p.pos.x},${p.pos.y}`;
        expect(occupied.has(key)).toBe(false);
        occupied.add(key);
      });
  });

  it('does not place KO, casualty, dead or sent-off players', () => {
    const base = createSetupState('A', 'A');
    const sidelined: ExtendedGameState = {
      ...base,
      players: base.players.map((p, idx) => {
        if (p.team !== 'A') return p;
        if (idx === 0) return { ...p, state: 'knocked_out' as const };
        if (idx === 1) return { ...p, state: 'sent_off' as const };
        if (idx === 2) return { ...p, state: 'casualty' as const };
        if (idx === 3) return { ...p, state: 'dead' as const };
        return p;
      }),
    };
    const placed = autoSetupAITeam(sidelined, 'A');
    const onField = placed.players.filter((p) => p.team === 'A' && p.pos.x >= 0);
    expect(onField.every((p) => !p.state || p.state === 'active')).toBe(true);
    // Only 7 active players left in reserves → only 7 placed.
    expect(onField).toHaveLength(7);
  });
});
