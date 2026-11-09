import { describe, it, expect } from 'vitest';
import { setupPreMatchWithTeams } from './game-state';
import { cloneGameState } from './clone-state';
import { isSeason2Rules, parseGameRuleset } from './ruleset';

describe('ruleset du match', () => {
  it('parse les deux editions et ignore le reste', () => {
    expect(parseGameRuleset('season_2')).toBe('season_2');
    expect(parseGameRuleset('season_3')).toBe('season_3');
    expect(parseGameRuleset('season_9')).toBeUndefined();
    expect(parseGameRuleset(null)).toBeUndefined();
  });

  it('un etat sans ruleset se lit en Saison 3', () => {
    expect(isSeason2Rules(undefined)).toBe(false);
    expect(isSeason2Rules('season_3')).toBe(false);
    expect(isSeason2Rules('season_2')).toBe(true);
  });

  it('setupPreMatchWithTeams pose le ruleset et le clone le garde', () => {
    const state = setupPreMatchWithTeams([], [], 'A', 'B', { ruleset: 'season_2' });
    expect(state.ruleset).toBe('season_2');
    expect(cloneGameState(state).ruleset).toBe('season_2');
  });

  it('sans option, aucun champ ruleset', () => {
    expect('ruleset' in setupPreMatchWithTeams([], [], 'A', 'B')).toBe(false);
  });
});
