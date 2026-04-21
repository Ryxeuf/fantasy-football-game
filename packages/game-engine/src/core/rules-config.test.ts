/**
 * Tests pour la configuration des regles et le Mode simplifie (N.2).
 *
 * Verifie :
 *  - `getRulesConfigForState` retourne la config attachee a l'etat, ou FULL_RULES par defaut.
 *  - `getTurnsPerHalf` respecte `rulesConfig.turnsPerHalf`.
 *  - `isSimplifiedMode` detecte correctement le mode simplifie.
 *  - `setupPreMatchWithTeams` applique la config simplifiee (timer, rerolls, turnsPerHalf).
 */
import { describe, it, expect } from 'vitest';
import {
  FULL_RULES,
  SIMPLIFIED_RULES,
} from './rules-config';
import {
  advanceHalfIfNeeded,
  getRulesConfigForState,
  getTurnsPerHalf,
  isMatchEnded,
  isSimplifiedMode,
  setup,
  setupPreMatchWithTeams,
  type TeamPlayerData,
} from './game-state';
import { makeRNG } from '../utils/rng';
import type { GameState, TeamId } from './types';

const mkPlayer = (team: 'A' | 'B', n: number): TeamPlayerData => ({
  id: `${team}${n}`,
  name: `${team}${n}`,
  position: 'Lineman',
  number: n,
  ma: 6,
  st: 3,
  ag: 3,
  pa: 4,
  av: 8,
  skills: '',
});

const mkTeams = (): [TeamPlayerData[], TeamPlayerData[]] => {
  const a: TeamPlayerData[] = [];
  const b: TeamPlayerData[] = [];
  for (let i = 1; i <= 11; i++) {
    a.push(mkPlayer('A', i));
    b.push(mkPlayer('B', i));
  }
  return [a, b];
};

describe('Regle: Rules Config — helpers', () => {
  it('getRulesConfigForState returns FULL_RULES when state has no rulesConfig', () => {
    const state = { turnTimerSeconds: 120 } as any;
    expect(getRulesConfigForState(state)).toEqual(FULL_RULES);
  });

  it('getRulesConfigForState returns the attached rulesConfig', () => {
    const state = { rulesConfig: SIMPLIFIED_RULES } as any;
    expect(getRulesConfigForState(state)).toEqual(SIMPLIFIED_RULES);
  });

  it('getTurnsPerHalf defaults to 8 when no rulesConfig attached', () => {
    const state = {} as any;
    expect(getTurnsPerHalf(state)).toBe(8);
  });

  it('getTurnsPerHalf returns 6 when simplified rules are attached', () => {
    const state = { rulesConfig: SIMPLIFIED_RULES } as any;
    expect(getTurnsPerHalf(state)).toBe(6);
  });

  it('isSimplifiedMode returns false without rulesConfig', () => {
    expect(isSimplifiedMode({} as any)).toBe(false);
  });

  it('isSimplifiedMode returns true when SIMPLIFIED_RULES is attached', () => {
    expect(isSimplifiedMode({ rulesConfig: SIMPLIFIED_RULES } as any)).toBe(true);
  });

  it('isSimplifiedMode returns false when FULL_RULES is attached', () => {
    expect(isSimplifiedMode({ rulesConfig: FULL_RULES } as any)).toBe(false);
  });
});

describe('Regle: Rules Config — setupPreMatchWithTeams applies simplified mode', () => {
  it('defaults to FULL_RULES values when no mode is provided', () => {
    const [a, b] = mkTeams();
    const state = setupPreMatchWithTeams(a, b, 'Team A', 'Team B');
    expect(state.turnTimerSeconds).toBe(FULL_RULES.turnTimerSeconds);
    expect(state.teamRerolls).toEqual({
      teamA: FULL_RULES.rerollsPerTeam,
      teamB: FULL_RULES.rerollsPerTeam,
    });
    expect(getRulesConfigForState(state)).toEqual(FULL_RULES);
    expect(isSimplifiedMode(state)).toBe(false);
  });

  it('applies SIMPLIFIED_RULES when rulesMode="simplified" is passed', () => {
    const [a, b] = mkTeams();
    const state = setupPreMatchWithTeams(a, b, 'Team A', 'Team B', {
      rulesMode: 'simplified',
    });
    expect(state.turnTimerSeconds).toBe(SIMPLIFIED_RULES.turnTimerSeconds);
    expect(state.teamRerolls).toEqual({
      teamA: SIMPLIFIED_RULES.rerollsPerTeam,
      teamB: SIMPLIFIED_RULES.rerollsPerTeam,
    });
    expect(isSimplifiedMode(state)).toBe(true);
    expect(getTurnsPerHalf(state)).toBe(SIMPLIFIED_RULES.turnsPerHalf);
  });

  it('applies FULL_RULES when rulesMode="full" is explicitly passed', () => {
    const [a, b] = mkTeams();
    const state = setupPreMatchWithTeams(a, b, 'Team A', 'Team B', {
      rulesMode: 'full',
    });
    expect(state.turnTimerSeconds).toBe(FULL_RULES.turnTimerSeconds);
    expect(state.teamRerolls).toEqual({
      teamA: FULL_RULES.rerollsPerTeam,
      teamB: FULL_RULES.rerollsPerTeam,
    });
    expect(isSimplifiedMode(state)).toBe(false);
    expect(getTurnsPerHalf(state)).toBe(FULL_RULES.turnsPerHalf);
  });

  it('records the selected mode in the game log', () => {
    const [a, b] = mkTeams();
    const state = setupPreMatchWithTeams(a, b, 'Team A', 'Team B', {
      rulesMode: 'simplified',
    });
    const modeLog = state.gameLog.find(e =>
      typeof e.message === 'string' && e.message.toLowerCase().includes('simplif'),
    );
    expect(modeLog).toBeDefined();
  });
});

describe('Regle: Rules Config — turns per half honors simplified mode', () => {
  const mkPlayState = (overrides?: Partial<GameState>): GameState => {
    const base = setup();
    return {
      ...base,
      gamePhase: 'playing' as const,
      half: 1,
      turn: 7,
      currentPlayer: 'A' as TeamId,
      kickingTeam: 'A' as TeamId,
      score: { teamA: 0, teamB: 0 },
      ...overrides,
    };
  };

  it('does NOT trigger halftime at turn 7 in full rules (8 turns per half)', () => {
    const state = mkPlayState({ turn: 7, rulesConfig: FULL_RULES });
    const result = advanceHalfIfNeeded(state, makeRNG('full-t7'));
    expect(result.half).toBe(1);
    expect(result.turn).toBe(7);
  });

  it('triggers halftime at turn 7 in simplified rules (6 turns per half)', () => {
    const state = mkPlayState({ turn: 7, rulesConfig: SIMPLIFIED_RULES });
    const result = advanceHalfIfNeeded(state, makeRNG('simp-t7'));
    expect(result.half).toBe(2);
    expect(result.turn).toBe(1);
    // B1.7 — la 2e mi-temps passe d'abord par la phase d'acknowledgement
    // 'halftime' (UI) puis par preMatch.phase='setup' avant reprise via kickoff.
    expect(result.gamePhase).toBe('halftime');
  });

  it('ends the match at turn 7 of half 2 in simplified rules', () => {
    const state = mkPlayState({
      turn: 7,
      half: 2,
      rulesConfig: SIMPLIFIED_RULES,
    });
    const result = advanceHalfIfNeeded(state, makeRNG('simp-end'));
    expect(result.gamePhase).toBe('ended');
  });

  it('isMatchEnded returns true at turn 9 half 2 with isTurnover=true in full rules', () => {
    const state = mkPlayState({ half: 2, turn: 9, isTurnover: true });
    expect(isMatchEnded(state)).toBe(true);
  });

  it('isMatchEnded returns true at turn 7 half 2 with isTurnover=true in simplified rules', () => {
    const state = mkPlayState({
      half: 2,
      turn: 7,
      isTurnover: true,
      rulesConfig: SIMPLIFIED_RULES,
    });
    expect(isMatchEnded(state)).toBe(true);
  });

  it('isMatchEnded returns false during half 1', () => {
    const state = mkPlayState({ half: 1, turn: 9, isTurnover: true });
    expect(isMatchEnded(state)).toBe(false);
  });
});
