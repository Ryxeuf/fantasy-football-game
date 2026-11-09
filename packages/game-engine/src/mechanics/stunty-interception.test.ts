import { describe, it, expect } from 'vitest';
import { setup, type GameState, type Player, type RNG } from '../index';
import { performInterceptionRoll } from './passing';

const rng: RNG = () => 0.5;

function interceptor(skills: string[]): { state: GameState; player: Player } {
  const state = setup();
  const player = { ...state.players[0], skills, ag: 3 };
  return { state: { ...state, players: [player, ...state.players.slice(1)] }, player };
}

describe('Minus — interception', () => {
  it('sans Minus : -2 de base', () => {
    const { state, player } = interceptor([]);
    expect(performInterceptionRoll(player, rng, state).modifiers).toBe(-2);
  });

  it('Saison 3 : -1 supplementaire', () => {
    const { state, player } = interceptor(['stunty']);
    const result = performInterceptionRoll(player, rng, state);
    expect(result.modifiers).toBe(-3);
    expect(result.targetNumber).toBe(6);
  });

  it('Saison 2 : pas de malus', () => {
    const { state, player } = interceptor(['stunty']);
    const result = performInterceptionRoll(player, rng, { ...state, ruleset: 'season_2' });
    expect(result.modifiers).toBe(-2);
  });
});
