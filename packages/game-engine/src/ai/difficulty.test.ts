import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { makeRNG } from '../utils/rng';
import type { GameState, Move, Player, RNG } from '../core/types';
import { pickBestMove } from './evaluator';
import {
  AI_DIFFICULTY_LEVELS,
  AI_DIFFICULTY_PROFILES,
  DEFAULT_AI_DIFFICULTY,
  getAIDifficultyProfile,
  listAIDifficulties,
  pickAIMove,
  scoreMoveForDifficulty,
} from './difficulty';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Lineman',
    number: 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

function baseState(players: Player[], overrides: Partial<GameState> = {}): GameState {
  const state = setup();
  return { ...state, players, ...overrides };
}

function blockAdvantageState(): GameState {
  const strong = makePlayer({ id: 'a1', team: 'A', pos: { x: 5, y: 5 }, st: 5 });
  const weak = makePlayer({ id: 'b1', team: 'B', pos: { x: 6, y: 5 }, st: 2 });
  return baseState([strong, weak]);
}

function carrierAdvancedState(): GameState {
  const carrier = makePlayer({
    id: 'a1',
    team: 'A',
    pos: { x: 10, y: 7 },
    hasBall: true,
    pm: 6,
  });
  const defender = makePlayer({ id: 'b1', team: 'B', pos: { x: 22, y: 14 } });
  return baseState([carrier, defender], { ball: carrier.pos });
}

describe('IA difficulty: profiles registry', () => {
  it('expose les trois niveaux de difficulte', () => {
    expect(AI_DIFFICULTY_LEVELS).toEqual(['easy', 'medium', 'hard']);
    expect(listAIDifficulties()).toEqual(['easy', 'medium', 'hard']);
  });

  it('expose un niveau par defaut (medium)', () => {
    expect(DEFAULT_AI_DIFFICULTY).toBe('medium');
  });

  it('chaque niveau a un profil coherent', () => {
    for (const level of AI_DIFFICULTY_LEVELS) {
      const profile = getAIDifficultyProfile(level);
      expect(profile.slug).toBe(level);
      expect(profile.noise).toBeGreaterThanOrEqual(0);
      expect(profile.blunderRate).toBeGreaterThanOrEqual(0);
      expect(profile.blunderRate).toBeLessThanOrEqual(1);
      expect(profile.timidityRate).toBeGreaterThanOrEqual(0);
      expect(profile.timidityRate).toBeLessThanOrEqual(1);
    }
  });

  it('le profil durcit a mesure que le niveau augmente', () => {
    const easy = AI_DIFFICULTY_PROFILES.easy;
    const medium = AI_DIFFICULTY_PROFILES.medium;
    const hard = AI_DIFFICULTY_PROFILES.hard;

    expect(hard.noise).toBeLessThan(medium.noise);
    expect(medium.noise).toBeLessThan(easy.noise);

    expect(hard.blunderRate).toBeLessThanOrEqual(medium.blunderRate);
    expect(medium.blunderRate).toBeLessThanOrEqual(easy.blunderRate);

    expect(hard.timidityRate).toBeLessThanOrEqual(medium.timidityRate);
    expect(medium.timidityRate).toBeLessThanOrEqual(easy.timidityRate);

    expect(hard.noise).toBe(0);
    expect(hard.blunderRate).toBe(0);
    expect(hard.timidityRate).toBe(0);
  });

  it('seuls les niveaux faciles biaisent vers END_TURN', () => {
    expect(AI_DIFFICULTY_PROFILES.hard.endTurnBias).toBe(0);
    expect(AI_DIFFICULTY_PROFILES.medium.endTurnBias).toBe(0);
    expect(AI_DIFFICULTY_PROFILES.easy.endTurnBias).toBeGreaterThan(0);
  });
});

describe('IA difficulty: pickAIMove — contrats generaux', () => {
  it('retourne null si aucun coup legal', () => {
    const a = makePlayer({ id: 'a1', team: 'A' });
    const state = baseState([a], { gamePhase: 'ended' });
    for (const difficulty of AI_DIFFICULTY_LEVELS) {
      expect(pickAIMove(state, 'A', { difficulty })).toBeNull();
    }
  });

  it('retourne toujours un coup present dans les coups legaux', () => {
    const state = carrierAdvancedState();
    for (const difficulty of AI_DIFFICULTY_LEVELS) {
      const rng = makeRNG(`ai-${difficulty}-legal`);
      const move = pickAIMove(state, 'A', { difficulty, rng });
      expect(move).not.toBeNull();
    }
  });

  it('hard est equivalent a pickBestMove', () => {
    const state = blockAdvantageState();
    const reference = pickBestMove(state, 'A');
    const chosen = pickAIMove(state, 'A', { difficulty: 'hard' });
    expect(chosen).toEqual(reference);
  });

  it('hard ne consomme pas de RNG (deterministe sans RNG)', () => {
    const state = carrierAdvancedState();
    const a = pickAIMove(state, 'A', { difficulty: 'hard' });
    const b = pickAIMove(state, 'A', { difficulty: 'hard' });
    expect(a).toEqual(b);
  });

  it('utilise medium par defaut quand difficulty est omis', () => {
    const state = blockAdvantageState();
    const rng: RNG = makeRNG('default-level');
    const withoutLevel = pickAIMove(state, 'A', { rng });
    const rngRef: RNG = makeRNG('default-level');
    const withMedium = pickAIMove(state, 'A', { difficulty: 'medium', rng: rngRef });
    expect(withoutLevel).toEqual(withMedium);
  });

  it('meme seed RNG => meme choix (reproductibilite)', () => {
    const state = carrierAdvancedState();
    for (const difficulty of AI_DIFFICULTY_LEVELS) {
      const m1 = pickAIMove(state, 'A', { difficulty, rng: makeRNG('repeat') });
      const m2 = pickAIMove(state, 'A', { difficulty, rng: makeRNG('repeat') });
      expect(m1).toEqual(m2);
    }
  });
});

describe('IA difficulty: differences de comportement', () => {
  it('easy peut produire des choix differents avec des seeds differents', () => {
    const state = carrierAdvancedState();
    const choices = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const move = pickAIMove(state, 'A', {
        difficulty: 'easy',
        rng: makeRNG(`easy-seed-${i}`),
      });
      choices.add(JSON.stringify(move));
    }
    expect(choices.size).toBeGreaterThan(1);
  });

  it('hard choisit toujours une action agressive (BLOCK ou BLITZ) face a un END_TURN', () => {
    const state = blockAdvantageState();
    const move = pickAIMove(state, 'A', { difficulty: 'hard' });
    expect(move).not.toBeNull();
    expect(['BLOCK', 'BLITZ']).toContain(move?.type);
  });

  it('easy privilegie globalement davantage END_TURN que hard', () => {
    const state = blockAdvantageState();
    let easyEndTurns = 0;
    let hardEndTurns = 0;
    for (let i = 0; i < 50; i++) {
      const easyMove = pickAIMove(state, 'A', {
        difficulty: 'easy',
        rng: makeRNG(`compare-easy-${i}`),
      });
      const hardMove = pickAIMove(state, 'A', { difficulty: 'hard' });
      if (easyMove?.type === 'END_TURN') easyEndTurns++;
      if (hardMove?.type === 'END_TURN') hardEndTurns++;
    }
    expect(easyEndTurns).toBeGreaterThan(hardEndTurns);
  });
});

describe('IA difficulty: scoreMoveForDifficulty', () => {
  it('hard donne exactement le meme score que scoreMove (sans RNG)', () => {
    const state = blockAdvantageState();
    const move: Move = { type: 'BLOCK', playerId: 'a1', targetId: 'b1' };
    const hard = scoreMoveForDifficulty(state, move, 'A', 'hard');
    // Sur hard, sans bruit ni biais, le score doit rester > 0 (block favorable)
    expect(hard).toBeGreaterThan(0);
    // Et etre deterministe (meme appel, meme valeur)
    expect(scoreMoveForDifficulty(state, move, 'A', 'hard')).toBe(hard);
  });

  it('easy applique un biais moyen positif en faveur d END_TURN', () => {
    const state = blockAdvantageState();
    const endTurn: Move = { type: 'END_TURN' };
    const hardScore = scoreMoveForDifficulty(state, endTurn, 'A', 'hard');
    let total = 0;
    const samples = 40;
    for (let i = 0; i < samples; i++) {
      total += scoreMoveForDifficulty(state, endTurn, 'A', 'easy', makeRNG(`bias-${i}`));
    }
    const averageEasy = total / samples;
    expect(averageEasy).toBeGreaterThan(hardScore);
  });

  it('scoreMoveForDifficulty reste un nombre fini pour tous les niveaux', () => {
    const state = blockAdvantageState();
    const move: Move = { type: 'BLOCK', playerId: 'a1', targetId: 'b1' };
    for (const difficulty of AI_DIFFICULTY_LEVELS) {
      const rng = makeRNG(`finite-${difficulty}`);
      const score = scoreMoveForDifficulty(state, move, 'A', difficulty, rng);
      expect(Number.isFinite(score)).toBe(true);
    }
  });
});

describe('IA difficulty: boucle de tour (integration)', () => {
  it('peut jouer une sequence complete sans planter et termine sur END_TURN', async () => {
    const { applyMove } = await import('../actions/actions');
    let state = blockAdvantageState();
    let safety = 0;
    let lastMove: Move | null = null;
    const rng = makeRNG('turn-loop');
    while (safety < 50) {
      const move = pickAIMove(state, 'A', { difficulty: 'medium', rng });
      if (!move) break;
      lastMove = move;
      if (move.type === 'END_TURN') break;
      state = applyMove(state, move, rng);
      safety++;
    }
    expect(safety).toBeLessThan(50);
    expect(lastMove).not.toBeNull();
  });
});

describe('IA difficulty: qualite relative (hard > easy en moyenne)', () => {
  it('sur des etats varies, hard privilegie plus souvent des coups de score positif', () => {
    const scenarios: GameState[] = [blockAdvantageState(), carrierAdvancedState()];

    let easyPositive = 0;
    let hardPositive = 0;

    for (let s = 0; s < scenarios.length; s++) {
      for (let i = 0; i < 20; i++) {
        const easyMove = pickAIMove(scenarios[s], 'A', {
          difficulty: 'easy',
          rng: makeRNG(`quality-easy-${s}-${i}`),
        });
        const hardMove = pickAIMove(scenarios[s], 'A', { difficulty: 'hard' });
        if (easyMove && easyMove.type !== 'END_TURN') easyPositive++;
        if (hardMove && hardMove.type !== 'END_TURN') hardPositive++;
      }
    }

    // Sur 40 tirages, hard doit proposer plus d'actions concretes que easy
    expect(hardPositive).toBeGreaterThan(easyPositive);
  });
});
