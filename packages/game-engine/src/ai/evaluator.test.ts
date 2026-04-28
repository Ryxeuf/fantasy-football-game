import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import type { GameState, Player, Move } from '../core/types';
import { evaluatePosition, scoreMove, pickBestMove, EVAL_WEIGHTS } from './evaluator';

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

describe('IA: evaluatePosition', () => {
  it('retourne un objet avec total et breakdown detailles', () => {
    const a = makePlayer({ id: 'a1', team: 'A', pos: { x: 10, y: 7 } });
    const b = makePlayer({ id: 'b1', team: 'B', pos: { x: 15, y: 7 } });
    const state = baseState([a, b]);

    const evaluation = evaluatePosition(state, 'A');

    expect(evaluation).toHaveProperty('total');
    expect(evaluation).toHaveProperty('breakdown');
    expect(typeof evaluation.total).toBe('number');
    expect(evaluation.breakdown).toHaveProperty('score');
    expect(evaluation.breakdown).toHaveProperty('possession');
    expect(evaluation.breakdown).toHaveProperty('ballProgress');
    expect(evaluation.breakdown).toHaveProperty('playerCount');
    expect(evaluation.breakdown).toHaveProperty('carrierSafety');
    expect(evaluation.breakdown).toHaveProperty('attrition');
  });

  it('le score de TD domine toutes les autres considerations', () => {
    const a = makePlayer({ id: 'a1', team: 'A' });
    const b = makePlayer({ id: 'b1', team: 'B' });
    const equal = baseState([a, b]);
    const winning = { ...equal, score: { teamA: 2, teamB: 0 } };

    const equalEval = evaluatePosition(equal, 'A');
    const winningEval = evaluatePosition(winning, 'A');

    expect(winningEval.total - equalEval.total).toBe(EVAL_WEIGHTS.TOUCHDOWN * 2);
    expect(winningEval.breakdown.score).toBe(EVAL_WEIGHTS.TOUCHDOWN * 2);
  });

  it('inverse le score selon la perspective de l equipe', () => {
    const a = makePlayer({ id: 'a1', team: 'A' });
    const b = makePlayer({ id: 'b1', team: 'B' });
    const state = baseState([a, b], { score: { teamA: 1, teamB: 0 } });

    const evalA = evaluatePosition(state, 'A');
    const evalB = evaluatePosition(state, 'B');

    expect(evalA.breakdown.score).toBeGreaterThan(0);
    expect(evalB.breakdown.score).toBeLessThan(0);
    expect(evalA.breakdown.score).toBe(-evalB.breakdown.score);
  });

  it('attribue un bonus de possession de balle', () => {
    const carrier = makePlayer({ id: 'a1', team: 'A', hasBall: true });
    const b = makePlayer({ id: 'b1', team: 'B' });
    const withBall = baseState([carrier, b], { ball: carrier.pos });

    const none = makePlayer({ id: 'a2', team: 'A' });
    const withoutBall = baseState([none, b]);

    const withEval = evaluatePosition(withBall, 'A');
    const withoutEval = evaluatePosition(withoutBall, 'A');

    expect(withEval.breakdown.possession).toBeGreaterThan(withoutEval.breakdown.possession);
  });

  it('valorise l avance du porteur vers la endzone adverse', () => {
    const nearOwn = makePlayer({ id: 'a1', team: 'A', pos: { x: 2, y: 7 }, hasBall: true });
    const nearOpp = makePlayer({ id: 'a1', team: 'A', pos: { x: 23, y: 7 }, hasBall: true });
    const b = makePlayer({ id: 'b1', team: 'B' });
    const deepState = baseState([nearOwn, b], { ball: nearOwn.pos });
    const advancedState = baseState([nearOpp, b], { ball: nearOpp.pos });

    expect(evaluatePosition(advancedState, 'A').breakdown.ballProgress).toBeGreaterThan(
      evaluatePosition(deepState, 'A').breakdown.ballProgress
    );
  });

  it('penalise les joueurs blesses et valorise les blessures adverses', () => {
    const a = makePlayer({ id: 'a1', team: 'A' });
    const b1 = makePlayer({ id: 'b1', team: 'B' });
    const b2 = makePlayer({ id: 'b2', team: 'B', state: 'casualty' });
    const state = baseState([a, b1, b2]);

    const evaluation = evaluatePosition(state, 'A');
    expect(evaluation.breakdown.attrition).toBeGreaterThan(0);
  });

  it('pays zero for ended matches without score', () => {
    const a = makePlayer({ id: 'a1', team: 'A' });
    const state = baseState([a], { gamePhase: 'ended' });

    const evaluation = evaluatePosition(state, 'A');
    expect(evaluation.total).toBe(0);
  });

  it('valorise le placement des joueurs de l equipe en possession vers la endzone adverse', () => {
    const carrier = makePlayer({ id: 'a1', team: 'A', pos: { x: 13, y: 7 }, hasBall: true });
    const supportClose = makePlayer({ id: 'a2', team: 'A', pos: { x: 18, y: 7 } });
    const supportFar = makePlayer({ id: 'a2', team: 'A', pos: { x: 4, y: 7 } });
    const opponent = makePlayer({ id: 'b1', team: 'B', pos: { x: 24, y: 7 } });

    const closeState = baseState([carrier, supportClose, opponent], { ball: carrier.pos });
    const farState = baseState([carrier, supportFar, opponent], { ball: carrier.pos });

    expect(evaluatePosition(closeState, 'A').breakdown.positioning).toBeGreaterThan(
      evaluatePosition(farState, 'A').breakdown.positioning
    );
  });

  it('valorise les defenseurs proches du porteur adverse quand l equipe ne porte pas la balle', () => {
    const carrierB = makePlayer({ id: 'b1', team: 'B', pos: { x: 13, y: 7 }, hasBall: true });
    const defenderClose = makePlayer({ id: 'a1', team: 'A', pos: { x: 11, y: 7 } });
    const defenderFar = makePlayer({ id: 'a1', team: 'A', pos: { x: 2, y: 0 } });

    const closeState = baseState([defenderClose, carrierB], { ball: carrierB.pos });
    const farState = baseState([defenderFar, carrierB], { ball: carrierB.pos });

    expect(evaluatePosition(closeState, 'A').breakdown.positioning).toBeGreaterThan(
      evaluatePosition(farState, 'A').breakdown.positioning
    );
  });

  it('valorise les joueurs proches du ballon libre quand personne ne le porte', () => {
    const close = makePlayer({ id: 'a1', team: 'A', pos: { x: 11, y: 7 } });
    const far = makePlayer({ id: 'a1', team: 'A', pos: { x: 2, y: 0 } });
    const opponent = makePlayer({ id: 'b1', team: 'B', pos: { x: 25, y: 14 } });
    const ballPos = { x: 13, y: 7 };

    const closeState = baseState([close, opponent], { ball: ballPos });
    const farState = baseState([far, opponent], { ball: ballPos });

    expect(evaluatePosition(closeState, 'A').breakdown.positioning).toBeGreaterThan(
      evaluatePosition(farState, 'A').breakdown.positioning
    );
  });
});

describe('IA: scoreMove', () => {
  it('retourne un score fini pour END_TURN', () => {
    const a = makePlayer({ id: 'a1', team: 'A' });
    const b = makePlayer({ id: 'b1', team: 'B' });
    const state = baseState([a, b]);

    const score = scoreMove(state, { type: 'END_TURN' }, 'A');
    expect(Number.isFinite(score)).toBe(true);
  });

  it('prefere un MOVE qui avance le porteur vers l endzone adverse', () => {
    const carrier = makePlayer({
      id: 'a1',
      team: 'A',
      pos: { x: 10, y: 7 },
      hasBall: true,
      pm: 6,
    });
    const b = makePlayer({ id: 'b1', team: 'B', pos: { x: 20, y: 7 } });
    const state = baseState([carrier, b], { ball: carrier.pos });

    const forward: Move = { type: 'MOVE', playerId: 'a1', to: { x: 11, y: 7 } };
    const backward: Move = { type: 'MOVE', playerId: 'a1', to: { x: 9, y: 7 } };

    expect(scoreMove(state, forward, 'A')).toBeGreaterThan(scoreMove(state, backward, 'A'));
  });

  it('donne un score positif a un BLOCK avec avantage de force', () => {
    const strong = makePlayer({ id: 'a1', team: 'A', pos: { x: 5, y: 5 }, st: 5 });
    const weak = makePlayer({ id: 'b1', team: 'B', pos: { x: 6, y: 5 }, st: 2 });
    const state = baseState([strong, weak]);

    const score = scoreMove(state, { type: 'BLOCK', playerId: 'a1', targetId: 'b1' }, 'A');
    expect(score).toBeGreaterThan(0);
  });

  it('penalise un BLOCK avec desavantage de force', () => {
    const weak = makePlayer({ id: 'a1', team: 'A', pos: { x: 5, y: 5 }, st: 2 });
    const strong = makePlayer({ id: 'b1', team: 'B', pos: { x: 6, y: 5 }, st: 5 });
    const state = baseState([weak, strong]);

    const strongBlock: Move = { type: 'BLOCK', playerId: 'a1', targetId: 'b1' };
    const safe: Move = { type: 'END_TURN' };

    expect(scoreMove(state, strongBlock, 'A')).toBeLessThan(scoreMove(state, safe, 'A'));
  });

  it('valorise une passe vers un coequipier plus avance', () => {
    const passer = makePlayer({
      id: 'a1',
      team: 'A',
      pos: { x: 8, y: 7 },
      hasBall: true,
    });
    const receiver = makePlayer({ id: 'a2', team: 'A', pos: { x: 14, y: 7 } });
    const b = makePlayer({ id: 'b1', team: 'B', pos: { x: 20, y: 7 } });
    const state = baseState([passer, receiver, b], { ball: passer.pos });

    const pass: Move = { type: 'PASS', playerId: 'a1', targetId: 'a2' };
    const end: Move = { type: 'END_TURN' };

    expect(scoreMove(state, pass, 'A')).toBeGreaterThan(scoreMove(state, end, 'A'));
  });

  it('un MOVE non-porteur vers le porteur adverse score plus haut que END_TURN', () => {
    const carrier = makePlayer({ id: 'b1', team: 'B', pos: { x: 18, y: 7 }, hasBall: true });
    const defender = makePlayer({ id: 'a1', team: 'A', pos: { x: 5, y: 7 }, pm: 6 });
    const state = baseState([defender, carrier], { ball: carrier.pos });

    const towardCarrier: Move = { type: 'MOVE', playerId: 'a1', to: { x: 6, y: 7 } };
    const endTurn: Move = { type: 'END_TURN' };

    expect(scoreMove(state, towardCarrier, 'A')).toBeGreaterThan(scoreMove(state, endTurn, 'A'));
  });

  it('un MOVE non-porteur vers le porteur adverse score plus haut qu un MOVE qui s eloigne', () => {
    const carrier = makePlayer({ id: 'b1', team: 'B', pos: { x: 18, y: 7 }, hasBall: true });
    const defender = makePlayer({ id: 'a1', team: 'A', pos: { x: 5, y: 7 }, pm: 6 });
    const state = baseState([defender, carrier], { ball: carrier.pos });

    const toward: Move = { type: 'MOVE', playerId: 'a1', to: { x: 6, y: 7 } };
    const away: Move = { type: 'MOVE', playerId: 'a1', to: { x: 4, y: 7 } };

    expect(scoreMove(state, toward, 'A')).toBeGreaterThan(scoreMove(state, away, 'A'));
  });

  it('un MOVE de support qui s avance vers la endzone adverse score plus haut que END_TURN', () => {
    const carrier = makePlayer({ id: 'a1', team: 'A', pos: { x: 13, y: 7 }, hasBall: true });
    const support = makePlayer({ id: 'a2', team: 'A', pos: { x: 12, y: 9 }, pm: 6 });
    const opp = makePlayer({ id: 'b1', team: 'B', pos: { x: 22, y: 7 } });
    const state = baseState([carrier, support, opp], { ball: carrier.pos });

    const advance: Move = { type: 'MOVE', playerId: 'a2', to: { x: 13, y: 9 } };
    const endTurn: Move = { type: 'END_TURN' };

    expect(scoreMove(state, advance, 'A')).toBeGreaterThan(scoreMove(state, endTurn, 'A'));
  });

  it('un BLOCK 50/50 (forces egales) score plus haut que END_TURN', () => {
    const equal1 = makePlayer({ id: 'a1', team: 'A', pos: { x: 5, y: 5 }, st: 3 });
    const equal2 = makePlayer({ id: 'b1', team: 'B', pos: { x: 6, y: 5 }, st: 3 });
    const state = baseState([equal1, equal2]);

    const blockMove: Move = { type: 'BLOCK', playerId: 'a1', targetId: 'b1' };
    const endTurn: Move = { type: 'END_TURN' };

    expect(scoreMove(state, blockMove, 'A')).toBeGreaterThan(scoreMove(state, endTurn, 'A'));
  });
});

describe('IA: pickBestMove', () => {
  it('retourne null si aucun mouvement legal', () => {
    const a = makePlayer({ id: 'a1', team: 'A' });
    const state = baseState([a], { gamePhase: 'ended' });
    expect(pickBestMove(state, 'A')).toBeNull();
  });

  it('retourne un mouvement legal lorsque des options existent', () => {
    const carrier = makePlayer({
      id: 'a1',
      team: 'A',
      pos: { x: 10, y: 7 },
      hasBall: true,
      pm: 6,
    });
    const b = makePlayer({ id: 'b1', team: 'B', pos: { x: 20, y: 7 } });
    const state = baseState([carrier, b], { ball: carrier.pos });

    const move = pickBestMove(state, 'A');
    expect(move).not.toBeNull();
  });

  it('choisit un mouvement en avant plutot qu en arriere quand c est la meilleure option', () => {
    const carrier = makePlayer({
      id: 'a1',
      team: 'A',
      pos: { x: 10, y: 7 },
      hasBall: true,
      pm: 6,
    });
    const b = makePlayer({ id: 'b1', team: 'B', pos: { x: 22, y: 14 } });
    const state = baseState([carrier, b], { ball: carrier.pos });

    const move = pickBestMove(state, 'A');
    expect(move).not.toBeNull();
    if (move && move.type === 'MOVE') {
      expect(move.to.x).toBeGreaterThanOrEqual(carrier.pos.x);
    }
  });

  it('est deterministe (meme etat => meme choix)', () => {
    const carrier = makePlayer({
      id: 'a1',
      team: 'A',
      pos: { x: 10, y: 7 },
      hasBall: true,
      pm: 6,
    });
    const b = makePlayer({ id: 'b1', team: 'B', pos: { x: 20, y: 7 } });
    const state = baseState([carrier, b], { ball: carrier.pos });

    const m1 = pickBestMove(state, 'A');
    const m2 = pickBestMove(state, 'A');
    expect(m1).toEqual(m2);
  });

  it('ne choisit pas END_TURN quand au moins une action concrete est disponible', () => {
    // Deux joueurs eloignes sans porteur ni cible : la majorite des MOVE
    // ne change pas l evaluation globale. END_TURN doit malgre tout perdre
    // contre une action disponible (tie-break en faveur du jeu actif).
    const a = makePlayer({ id: 'a1', team: 'A', pos: { x: 5, y: 5 }, pm: 6 });
    const b = makePlayer({ id: 'b1', team: 'B', pos: { x: 22, y: 14 } });
    const state = baseState([a, b]);

    const move = pickBestMove(state, 'A');
    expect(move).not.toBeNull();
    expect(move?.type).not.toBe('END_TURN');
  });
});
