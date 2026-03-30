import { describe, it, expect } from 'vitest';
import { performInjuryRoll } from './injury';
import { initializeDugouts } from './dugout';
import type { GameState, Player, CasualtyOutcome } from '../core/types';

function createTestState(): GameState {
  const dugouts = initializeDugouts();
  const player: Player = {
    id: 'A1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Test Player',
    number: 1,
    position: 'Lineman',
    ma: 6, st: 3, ag: 3, pa: 4, av: 8,
    skills: [],
    pm: 6,
  };

  return {
    width: 26,
    height: 15,
    players: [player],
    currentPlayer: 'A',
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
    dugouts,
    playerActions: {},
    teamBlitzCount: {},
    teamFoulCount: {},
    teamRerolls: { teamA: 3, teamB: 3 },
    rerollUsedThisTurn: false,
    gamePhase: 'playing',
    half: 1,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: 'Team A', teamB: 'Team B' },
    matchStats: {},
    casualtyResults: {},
    gameLog: [],
  };
}

describe('casualtyResults tracking in injury system', () => {
  it('should not populate casualtyResults for stunned outcomes (2-7)', () => {
    const state = createTestState();
    // RNG that gives low injury roll (stunned): two dice both return 1 → 2 total
    const lowRng = () => 0.01;
    const result = performInjuryRoll(state, state.players[0], lowRng);
    expect(result.casualtyResults).toEqual({});
  });

  it('should not populate casualtyResults for KO outcomes (8-9)', () => {
    const state = createTestState();
    // RNG that gives injury roll of 8-9 (KO): we need dice to sum to 8-9
    // 0.5 gives 4 per die → 8 total
    const midRng = () => 0.5;
    const result = performInjuryRoll(state, state.players[0], midRng);
    expect(result.casualtyResults).toEqual({});
  });

  it('should record badly_hurt for casualty roll 1-6', () => {
    const state = createTestState();
    // First two calls: injury dice (need 10+ → high values: 0.99 gives 6 per die = 12)
    // Third call: casualty D16 (need 1-6 → 0.01 gives roll=1 → badly_hurt)
    let callCount = 0;
    const rng = () => {
      callCount++;
      if (callCount <= 2) return 0.99; // Injury dice: 6+6 = 12
      return 0.01; // Casualty D16: roll 1 → badly_hurt
    };
    const result = performInjuryRoll(state, state.players[0], rng);
    expect(result.casualtyResults['A1']).toBe('badly_hurt');
  });

  it('should record dead for casualty roll 15-16', () => {
    const state = createTestState();
    // Injury dice high, casualty D16 high (15-16)
    let callCount = 0;
    const rng = () => {
      callCount++;
      if (callCount <= 2) return 0.99; // 6+6 = 12
      return 0.99; // D16: roll 16 → dead
    };
    const result = performInjuryRoll(state, state.players[0], rng);
    expect(result.casualtyResults['A1']).toBe('dead');
  });

  it('should track casualty for attacker SPP when causedById is provided', () => {
    const state = createTestState();
    let callCount = 0;
    const rng = () => {
      callCount++;
      if (callCount <= 2) return 0.99; // High injury roll
      return 0.99; // Dead
    };
    const result = performInjuryRoll(state, state.players[0], rng, 0, 'B1');
    expect(result.casualtyResults['A1']).toBe('dead');
    expect(result.matchStats['B1']?.casualties).toBe(1);
  });
});
