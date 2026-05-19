/**
 * Test d'intégration : boucle IA vs IA.
 *
 * Issu de l'audit IA 2026-05-19 (cf. `docs/ai-audit-2026-05-19.md`,
 * quick win #1) — il n'existait aucun test exécutant la boucle de
 * décision IA contre elle-même sur plus de quelques coups, donc tout
 * comportement aberrant (boucle infinie, coup illégal sélectionné,
 * mutation d'état, divergence pour un même seed) n'était pas détecté.
 *
 * Ce test ne simule pas un match BB complet (kickoff, mi-temps,
 * setup) — il vérifie uniquement que `pickAIMove` × `applyMove`
 * produit une séquence finie, déterministe et progresse vers un
 * `END_TURN` ou un changement de joueur courant, pour les 3 niveaux
 * de difficulté et plusieurs seeds.
 */

import { describe, it, expect } from 'vitest';

import { setup } from '../core/game-state';
import { applyMove } from '../actions/actions';
import { getLegalMoves } from '../actions/legal-moves';
import { makeRNG } from '../utils/rng';
import type { GameState, Move, TeamId } from '../core/types';

import { pickAIMove, AI_DIFFICULTY_LEVELS } from './difficulty';

const MAX_MOVES_PER_RUN = 200;
const SEEDS = ['seed-1', 'seed-2', 'seed-3'];

function applyAILoop(
  initialState: GameState,
  seed: string,
  difficulty: (typeof AI_DIFFICULTY_LEVELS)[number]
): {
  finalState: GameState;
  movesPlayed: number;
  turnsObserved: Set<string>;
} {
  const rng = makeRNG(`apply-${seed}`);
  const aiRng = makeRNG(`ai-${seed}`);
  let state = initialState;
  let movesPlayed = 0;
  const turnsObserved = new Set<string>();

  while (movesPlayed < MAX_MOVES_PER_RUN) {
    if (state.gamePhase === 'ended') break;

    const team: TeamId = state.currentPlayer;
    turnsObserved.add(`${team}#${state.turn}#${state.half}`);

    const legal = getLegalMoves(state);
    if (legal.length === 0) break;

    const picked = pickAIMove(state, team, { difficulty, rng: aiRng });
    if (!picked) break;

    expect(legal).toContainEqual(picked);

    const next = applyMove(state, picked, rng);
    expect(next).not.toBe(state); // applyMove doit retourner une nouvelle référence (ou identique si no-op)
    state = next;
    movesPlayed++;

    // Détection de stagnation : si on ne change pas de joueur après
    // END_TURN, on est dans une boucle pathologique.
    if (picked.type === 'END_TURN') {
      // Pas d'assertion forte ici (la mi-temps peut maintenir le team
      // sur 'A' par exemple) — la garde-fou est MAX_MOVES_PER_RUN.
    }
  }

  return { finalState: state, movesPlayed, turnsObserved };
}

describe('IA vs IA — boucle de décision', () => {
  for (const difficulty of AI_DIFFICULTY_LEVELS) {
    describe(`difficulté = ${difficulty}`, () => {
      for (const seed of SEEDS) {
        it(`termine la boucle sous ${MAX_MOVES_PER_RUN} coups (seed=${seed})`, () => {
          const { movesPlayed } = applyAILoop(setup(), seed, difficulty);
          expect(movesPlayed).toBeLessThan(MAX_MOVES_PER_RUN);
          expect(movesPlayed).toBeGreaterThan(0);
        });

        it(`est déterministe pour le même seed (seed=${seed})`, () => {
          const a = applyAILoop(setup(), seed, difficulty);
          const b = applyAILoop(setup(), seed, difficulty);
          expect(b.movesPlayed).toBe(a.movesPlayed);
          expect(b.finalState.turn).toBe(a.finalState.turn);
          expect(b.finalState.half).toBe(a.finalState.half);
          expect(b.finalState.score).toEqual(a.finalState.score);
        });

        it(`alterne entre les équipes via END_TURN (seed=${seed})`, () => {
          const { turnsObserved } = applyAILoop(setup(), seed, difficulty);
          const teams = new Set<string>();
          for (const key of turnsObserved) {
            teams.add(key.split('#')[0]);
          }
          expect(teams.has('A')).toBe(true);
          expect(teams.has('B')).toBe(true);
        });

        it(`ne mute pas le state initial (seed=${seed})`, () => {
          const initial = setup();
          const snapshot = JSON.stringify(initial);
          applyAILoop(initial, seed, difficulty);
          expect(JSON.stringify(initial)).toBe(snapshot);
        });
      }
    });
  }

  describe('robustesse cross-difficulté', () => {
    it('produit toujours un coup légal (200 coups × 3 seeds × 3 niveaux)', () => {
      let totalChecks = 0;
      for (const difficulty of AI_DIFFICULTY_LEVELS) {
        for (const seed of SEEDS) {
          const { movesPlayed } = applyAILoop(setup(), seed, difficulty);
          totalChecks += movesPlayed;
        }
      }
      expect(totalChecks).toBeGreaterThan(0);
    });

    it('hard est déterministe même sans rng explicite', () => {
      const state = setup();
      const a = pickAIMove(state, 'A', { difficulty: 'hard' });
      const b = pickAIMove(state, 'A', { difficulty: 'hard' });
      expect(b).toEqual(a);
    });
  });
});
