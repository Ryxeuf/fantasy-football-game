import { describe, it, expect } from 'vitest';
import { getWeatherModifiers, applyWeatherDriveEffects } from './weather-effects';
import type { WeatherCondition } from '../core/weather-types';
import type { GameState, Player, TeamId } from '../core/types';

/**
 * Helper: creates a minimal GameState with active players on the field
 */
function createTestGameState(playersPerTeam: number = 6): GameState {
  const players: Player[] = [];

  for (let i = 0; i < playersPerTeam; i++) {
    players.push({
      id: `A${i + 1}`,
      team: 'A',
      pos: { x: i + 1, y: 3 },
      name: `Player A${i + 1}`,
      number: i + 1,
      position: 'Lineman',
      ma: 6, st: 3, ag: 3, pa: 4, av: 8,
      skills: [],
      pm: 6,
      state: 'active',
    });
    players.push({
      id: `B${i + 1}`,
      team: 'B',
      pos: { x: i + 1, y: 11 },
      name: `Player B${i + 1}`,
      number: i + 1,
      position: 'Lineman',
      ma: 6, st: 3, ag: 3, pa: 4, av: 8,
      skills: [],
      pm: 6,
      state: 'active',
    });
  }

  return {
    width: 26,
    height: 15,
    players,
    currentPlayer: 'A',
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
    apothecaryAvailable: { teamA: false, teamB: false },
    dugouts: {
      teamA: {
        teamId: 'A',
        zones: {
          reserves: { id: 'reserves-A', name: 'Reserves', color: '#green', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          stunned: { id: 'stunned-A', name: 'Stunned', color: '#yellow', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          knockedOut: { id: 'ko-A', name: 'KO', color: '#orange', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          casualty: { id: 'cas-A', name: 'Casualty', color: '#red', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          sentOff: { id: 'sent-A', name: 'Sent Off', color: '#black', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
        },
      },
      teamB: {
        teamId: 'B',
        zones: {
          reserves: { id: 'reserves-B', name: 'Reserves', color: '#green', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          stunned: { id: 'stunned-B', name: 'Stunned', color: '#yellow', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          knockedOut: { id: 'ko-B', name: 'KO', color: '#orange', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          casualty: { id: 'cas-B', name: 'Casualty', color: '#red', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          sentOff: { id: 'sent-B', name: 'Sent Off', color: '#black', icon: '', maxCapacity: 16, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
        },
      },
    },
    playerActions: {},
    teamBlitzCount: {},
    teamFoulCount: {},
    gamePhase: 'playing',
    half: 1,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: 'Team A', teamB: 'Team B' },
    teamRerolls: { teamA: 3, teamB: 3 },
    rerollUsedThisTurn: false,
    matchStats: {},
    casualtyResults: {},
    lastingInjuryDetails: {},
    usedStarPlayerRules: {},
    bribesRemaining: { teamA: 0, teamB: 0 },
    turnTimerSeconds: 120,
    gameLog: [],
  } as GameState;
}

describe('Regle: Affaissement du plafond (Souterraine roll 2)', () => {
  const condition: WeatherCondition = {
    condition: 'Affaissement du plafond',
    description: 'Des pierres tombent du plafond ! D3 joueurs aléatoires de chaque équipe sont placés en Réserve.',
  };

  it('should return playersToReserves=1 for Affaissement du plafond', () => {
    const mods = getWeatherModifiers(condition);
    expect(mods.playersToReserves).toBe(1);
    expect(mods.passingModifier).toBe(0);
    expect(mods.agilityModifier).toBe(0);
    expect(mods.gfiModifier).toBe(0);
    expect(mods.maxPassRange).toBeNull();
  });

  it('should move D3 players from each team to reserves', () => {
    const state = createTestGameState(6);
    const mods = getWeatherModifiers(condition);
    // Use a fixed rng that returns 0.0 => D3=1
    let rngCallCount = 0;
    const fixedRng = () => {
      rngCallCount++;
      return 0.0; // D3 => floor(0.0*3)+1 = 1 player
    };

    const newState = applyWeatherDriveEffects(state, mods, fixedRng);

    // 1 player from each team should be moved off the field (pos = {-1, -1})
    const teamAOffField = newState.players.filter(p => p.team === 'A' && p.pos.x === -1);
    const teamBOffField = newState.players.filter(p => p.team === 'B' && p.pos.x === -1);
    expect(teamAOffField.length).toBe(1);
    expect(teamBOffField.length).toBe(1);
  });

  it('should move up to 3 players when D3=3', () => {
    const state = createTestGameState(6);
    const mods = getWeatherModifiers(condition);
    // rng returns 0.99 => D3 = floor(0.99*3)+1 = 3
    const fixedRng = () => 0.99;

    const newState = applyWeatherDriveEffects(state, mods, fixedRng);

    const teamAOffField = newState.players.filter(p => p.team === 'A' && p.pos.x === -1);
    const teamBOffField = newState.players.filter(p => p.team === 'B' && p.pos.x === -1);
    expect(teamAOffField.length).toBe(3);
    expect(teamBOffField.length).toBe(3);
  });

  it('should not affect stunned or non-active players', () => {
    const state = createTestGameState(3);
    // Mark some players as stunned
    state.players[0] = { ...state.players[0], stunned: true }; // A1 stunned
    state.players[2] = { ...state.players[2], stunned: true }; // A2 stunned
    const mods = getWeatherModifiers(condition);
    // D3=3 but only 1 active player on team A
    const fixedRng = () => 0.99;

    const newState = applyWeatherDriveEffects(state, mods, fixedRng);

    // Only 1 non-stunned team A player should be moved
    const teamAOffField = newState.players.filter(p => p.team === 'A' && p.pos.x === -1);
    expect(teamAOffField.length).toBe(1);
  });
});

describe('Regle: Âmes errantes en colère (Cimetière roll 2)', () => {
  const condition: WeatherCondition = {
    condition: 'Âmes errantes en colère',
    description: 'Les esprits hantent le terrain. D3 joueurs aléatoires de chaque équipe sont placés en Réserve.',
  };

  it('should return playersToReserves=1 for Âmes errantes en colère', () => {
    const mods = getWeatherModifiers(condition);
    expect(mods.playersToReserves).toBe(1);
    expect(mods.passingModifier).toBe(0);
    expect(mods.agilityModifier).toBe(0);
    expect(mods.gfiModifier).toBe(0);
    expect(mods.maxPassRange).toBeNull();
  });

  it('should move D3 players from each team to reserves', () => {
    const state = createTestGameState(6);
    const mods = getWeatherModifiers(condition);
    // D3=2 (rng returns ~0.5 => floor(0.5*3)+1 = 2)
    const fixedRng = () => 0.5;

    const newState = applyWeatherDriveEffects(state, mods, fixedRng);

    const teamAOffField = newState.players.filter(p => p.team === 'A' && p.pos.x === -1);
    const teamBOffField = newState.players.filter(p => p.team === 'B' && p.pos.x === -1);
    expect(teamAOffField.length).toBe(2);
    expect(teamBOffField.length).toBe(2);
  });

  it('should not mutate the original state (immutability)', () => {
    const state = createTestGameState(6);
    const originalPlayers = state.players.map(p => ({ ...p }));
    const mods = getWeatherModifiers(condition);
    const fixedRng = () => 0.5;

    applyWeatherDriveEffects(state, mods, fixedRng);

    // Original state should be unchanged
    state.players.forEach((p, i) => {
      expect(p.pos.x).toBe(originalPlayers[i].pos.x);
      expect(p.pos.y).toBe(originalPlayers[i].pos.y);
    });
  });
});

describe('Regle: Weather condition persists in GameState', () => {
  it('GameState should support weatherCondition field', () => {
    const state = createTestGameState(2);
    const stateWithWeather: GameState = {
      ...state,
      weatherCondition: {
        condition: 'Affaissement du plafond',
        description: 'Des pierres tombent du plafond !',
      },
    };
    expect(stateWithWeather.weatherCondition).toBeDefined();
    expect(stateWithWeather.weatherCondition!.condition).toBe('Affaissement du plafond');
  });
});
