/**
 * Lot 1 « match complet » — garde-fous moteur :
 *  - un joueur À TERRE se relève (STAND_UP, 3 PM, Jump Up gratuit) ;
 *  - un joueur SONNÉ devient Prone à la fin du tour de son équipe ;
 *  - un choix en attente ferme la liste des coups légaux et bloque
 *    `applyMove` ;
 *  - l'activation d'un joueur est contiguë ;
 *  - l'IA préfère clore une activation plutôt que le tour entier.
 */

import { describe, it, expect } from 'vitest';

import { applyMove } from './actions';
import { getLegalMoves } from './legal-moves';
import { makePlayer, baseState } from '../__tests__/helpers';
import { makeRNG } from '../utils/rng';
import { scoreMove } from '../ai/evaluator';
import { isProne, canPlayerStandUp } from '../core/game-state';
import { checkTouchdowns } from '../mechanics/ball';
import type { Move } from '../core/types';

const rng = makeRNG('lot1');

function twoTeamsState(overrides: Parameters<typeof baseState>[1] = {}) {
  const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, name: 'A1' });
  const a2 = makePlayer({ id: 'A2', team: 'A', pos: { x: 5, y: 9 }, name: 'A2' });
  const b1 = makePlayer({ id: 'B1', team: 'B', pos: { x: 20, y: 7 }, name: 'B1' });
  return baseState([a1, a2, b1], { currentPlayer: 'A', kickingTeam: 'B', ...overrides });
}

describe('Lot 1 — se relever (Prone)', () => {
  it('un joueur à terre se relève pour 3 PM et peut continuer', () => {
    const state = twoTeamsState();
    state.players = state.players.map((p) => (p.id === 'A1' ? { ...p, stunned: true } : p));
    expect(isProne(state.players[0])).toBe(true);
    expect(canPlayerStandUp(state, 'A1')).toBe(true);

    const legal = getLegalMoves(state);
    expect(legal).toContainEqual({ type: 'STAND_UP', playerId: 'A1' });
    // Prone : aucun MOVE pour lui tant qu'il n'est pas debout.
    expect(legal.some((m) => m.type === 'MOVE' && m.playerId === 'A1')).toBe(false);

    const stood = applyMove(state, { type: 'STAND_UP', playerId: 'A1' }, rng);
    const a1 = stood.players.find((p) => p.id === 'A1')!;
    expect(a1.stunned).toBe(false);
    expect(a1.pm).toBe(3);
    expect(stood.playerActions['A1']).toBe('MOVE');
    expect(getLegalMoves(stood).some((m) => m.type === 'MOVE' && m.playerId === 'A1')).toBe(true);
  });

  it('Jump Up : se relever ne coûte rien', () => {
    const state = twoTeamsState();
    state.players = state.players.map((p) =>
      p.id === 'A1' ? { ...p, stunned: true, skills: ['jump-up'] } : p,
    );
    const stood = applyMove(state, { type: 'STAND_UP', playerId: 'A1' }, rng);
    expect(stood.players.find((p) => p.id === 'A1')!.pm).toBe(6);
  });

  it('un joueur SONNÉ ne se relève pas, puis devient Prone à la fin du tour de son équipe', () => {
    const state = twoTeamsState();
    state.players = state.players.map((p) =>
      p.id === 'A1' ? { ...p, stunned: true, state: 'stunned' as const } : p,
    );
    expect(canPlayerStandUp(state, 'A1')).toBe(false);
    expect(getLegalMoves(state).some((m) => m.type === 'STAND_UP')).toBe(false);

    const afterA = applyMove(state, { type: 'END_TURN' }, rng); // fin du tour de A
    const a1 = afterA.players.find((p) => p.id === 'A1')!;
    expect(a1.stunned).toBe(true);
    expect(a1.state).toBe('active'); // retourné face visible = Prone
    expect(isProne(a1)).toBe(true);

    const afterB = applyMove(afterA, { type: 'END_TURN' }, rng); // tour de B passé
    expect(afterB.currentPlayer).toBe('A');
    expect(canPlayerStandUp(afterB, 'A1')).toBe(true);
  });

  it('un état ancien (stunned sans state) est lu comme Prone', () => {
    const state = twoTeamsState();
    state.players = state.players.map((p) =>
      p.id === 'A1' ? { ...p, stunned: true, state: undefined } : p,
    );
    expect(canPlayerStandUp(state, 'A1')).toBe(true);
  });
});

describe('Lot 1 — choix en attente obligatoires', () => {
  it('pendingBlock : seuls les BLOCK_CHOOSE sont légaux et applyMove refuse un MOVE', () => {
    const state = twoTeamsState({
      pendingBlock: {
        attackerId: 'A1',
        targetId: 'B1',
        options: ['POW', 'PUSH_BACK', 'PUSH_BACK'],
        chooser: 'attacker',
        offensiveAssists: 0,
        defensiveAssists: 0,
        totalStrength: 4,
        targetStrength: 3,
      },
    });
    const legal = getLegalMoves(state);
    expect(legal.every((m) => m.type === 'BLOCK_CHOOSE')).toBe(true);
    expect(legal).toHaveLength(2); // résultats dédoublonnés
    const rejected = applyMove(state, { type: 'MOVE', playerId: 'A2', to: { x: 6, y: 9 } }, rng);
    expect(rejected).toBe(state);
  });

  it('pendingPushChoice / pendingFollowUpChoice : coups de résolution seuls', () => {
    const push = twoTeamsState({
      pendingPushChoice: {
        attackerId: 'A1',
        targetId: 'B1',
        availableDirections: [
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
        blockResult: 'PUSH_BACK',
        offensiveAssists: 0,
        defensiveAssists: 0,
        totalStrength: 3,
        targetStrength: 3,
      },
    });
    const pushMoves = getLegalMoves(push);
    expect(pushMoves).toHaveLength(2);
    expect(pushMoves.every((m) => m.type === 'PUSH_CHOOSE')).toBe(true);

    const follow = twoTeamsState({
      pendingFollowUpChoice: {
        attackerId: 'A1',
        targetId: 'B1',
        targetNewPosition: { x: 21, y: 7 },
        targetOldPosition: { x: 20, y: 7 },
      },
    });
    const followMoves = getLegalMoves(follow);
    expect(followMoves.map((m) => m.type)).toEqual(['FOLLOW_UP_CHOOSE', 'FOLLOW_UP_CHOOSE']);
  });

  it("END_TURN reste un nettoyage de secours, journalisé", () => {
    const state = twoTeamsState({
      pendingFollowUpChoice: {
        attackerId: 'A1',
        targetId: 'B1',
        targetNewPosition: { x: 21, y: 7 },
        targetOldPosition: { x: 20, y: 7 },
      },
    });
    const next = applyMove(state, { type: 'END_TURN' }, rng);
    expect(next.pendingFollowUpChoice).toBeUndefined();
    expect(
      next.gameLog.some((e) => e.details?.warning === 'pending-cleared'),
    ).toBe(true);
  });

  it('le choix de dé est décidé dans l’intérêt de celui qui choisit', () => {
    const base = twoTeamsState({
      pendingBlock: {
        attackerId: 'A1',
        targetId: 'B1',
        options: ['POW', 'PLAYER_DOWN'],
        chooser: 'attacker',
        offensiveAssists: 0,
        defensiveAssists: 0,
        totalStrength: 4,
        targetStrength: 3,
      },
    });
    const pow: Move = { type: 'BLOCK_CHOOSE', playerId: 'A1', targetId: 'B1', result: 'POW' };
    const down: Move = { type: 'BLOCK_CHOOSE', playerId: 'A1', targetId: 'B1', result: 'PLAYER_DOWN' };
    expect(scoreMove(base, pow, 'A')).toBeGreaterThan(scoreMove(base, down, 'A'));

    const defenderChooses = { ...base, pendingBlock: { ...base.pendingBlock!, chooser: 'defender' as const } };
    expect(scoreMove(defenderChooses, down, 'A')).toBeGreaterThan(scoreMove(defenderChooses, pow, 'A'));
  });
});

describe('Lot 1 — activation contiguë', () => {
  it('tant que A1 a une activation ouverte, seuls ses coups sont légaux', () => {
    const state = twoTeamsState();
    const moved = applyMove(state, { type: 'MOVE', playerId: 'A1', to: { x: 6, y: 5 } }, rng);
    expect(moved.playerActions['A1']).toBe('MOVE');
    const legal = getLegalMoves(moved);
    const playerIds = new Set(
      legal.filter((m) => 'playerId' in m).map((m) => (m as { playerId: string }).playerId),
    );
    expect(playerIds).toEqual(new Set(['A1']));
    expect(legal).toContainEqual({ type: 'END_PLAYER_TURN', playerId: 'A1' });

    const closed = applyMove(moved, { type: 'END_PLAYER_TURN', playerId: 'A1' }, rng);
    expect(getLegalMoves(closed).some((m) => m.type === 'MOVE' && m.playerId === 'A2')).toBe(true);
  });

  it("END_PLAYER_TURN est préféré à END_TURN par l'évaluateur", () => {
    const state = twoTeamsState();
    expect(scoreMove(state, { type: 'END_PLAYER_TURN', playerId: 'A1' }, 'A')).toBeGreaterThan(
      scoreMove(state, { type: 'END_TURN' }, 'A'),
    );
  });
});

describe('touchdown par poussée (lot 2)', () => {
  it('un TD marqué par le joueur repoussé efface le choix de suivi en attente', () => {
    // Le porteur B1 est repoussé dans l'en-but de A (x = 0) : TD pour B.
    const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: 1, y: 7 }, name: 'A1' });
    const b1 = makePlayer({ id: 'B1', team: 'B', pos: { x: 0, y: 7 }, name: 'B1', hasBall: true });
    const state = baseState([a1, b1], {
      currentPlayer: 'A',
      kickingTeam: 'B',
      ball: undefined,
      pendingFollowUpChoice: {
        attackerId: 'A1',
        targetId: 'B1',
        targetNewPosition: { x: 0, y: 7 },
        targetOldPosition: { x: 1, y: 7 },
      },
    });
    const next = checkTouchdowns(state);
    expect(next.gamePhase).toBe('post-td');
    expect(next.score.teamB).toBe(1);
    expect(next.pendingFollowUpChoice).toBeUndefined();
    expect(next.pendingPushChoice).toBeUndefined();
    expect(getLegalMoves(next).some((m) => m.type === 'FOLLOW_UP_CHOOSE')).toBe(false);
  });
});
