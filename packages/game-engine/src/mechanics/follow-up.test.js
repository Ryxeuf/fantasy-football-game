import { describe, it, expect } from 'vitest';
import { setup, applyMove, makeRNG } from '../index';
describe('Système de follow-up', () => {
  it('devrait créer un pendingFollowUpChoice après une poussée', () => {
    const state = setup();
    const rng = makeRNG('test-seed');
    // Positionner A1 au nord de B1
    const testState = { ...state };
    testState.players = testState.players.map(p => {
      if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 } };
      if (p.id === 'B1') return { ...p, pos: { x: 10, y: 8 } };
      // Déplacer tous les autres joueurs loin
      if (p.team === 'B' && p.id !== 'B1') return { ...p, pos: { x: 20, y: 20 } };
      if (p.team === 'A' && p.id !== 'A1') return { ...p, pos: { x: 0, y: 0 } };
      return p;
    });
    // Effectuer un blocage
    const blockMove = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const blockResult = applyMove(testState, blockMove, rng);
    // Choisir STUMBLE pour déclencher la poussée
    const chooseMove = {
      type: 'BLOCK_CHOOSE',
      playerId: 'A1',
      targetId: 'B1',
      result: 'STUMBLE',
    };
    const pushResult = applyMove(blockResult, chooseMove, rng);
    // Vérifier qu'il y a un pendingPushChoice
    expect(pushResult.pendingPushChoice).toBeDefined();
    // Choisir une direction de poussée (utiliser une direction valide)
    const availableDirections = pushResult.pendingPushChoice?.availableDirections || [];
    const validDirection = availableDirections[0]; // Prendre la première direction disponible
    const pushChooseMove = {
      type: 'PUSH_CHOOSE',
      playerId: 'A1',
      targetId: 'B1',
      direction: validDirection,
    };
    const result = applyMove(pushResult, pushChooseMove, rng);
    // Vérifier qu'il y a un pendingFollowUpChoice
    expect(result.pendingFollowUpChoice).toBeDefined();
    expect(result.pendingFollowUpChoice?.attackerId).toBe('A1');
    expect(result.pendingFollowUpChoice?.targetId).toBe('B1');
    // Vérifier que B1 a été poussé
    const pushedPlayer = result.players.find(p => p.id === 'B1');
    expect(pushedPlayer?.pos).not.toEqual({ x: 10, y: 8 }); // Plus à sa position originale
  });
  it("devrait permettre à l'attaquant de suivre", () => {
    const state = setup();
    const rng = makeRNG('test-seed');
    // Créer une situation avec pendingFollowUpChoice
    const testState = { ...state };
    testState.players = testState.players.map(p => {
      if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 } };
      if (p.id === 'B1') return { ...p, pos: { x: 10, y: 8 } };
      return p;
    });
    // Créer un pendingFollowUpChoice manuellement
    testState.pendingFollowUpChoice = {
      attackerId: 'A1',
      targetId: 'B1',
      targetNewPosition: { x: 10, y: 9 },
      targetOldPosition: { x: 10, y: 8 },
    };
    // Choisir de suivre
    const followUpMove = {
      type: 'FOLLOW_UP_CHOOSE',
      playerId: 'A1',
      targetId: 'B1',
      followUp: true,
    };
    const result = applyMove(testState, followUpMove, rng);
    // Vérifier que A1 a suivi
    const attacker = result.players.find(p => p.id === 'A1');
    expect(attacker?.pos).toEqual({ x: 10, y: 8 }); // Position de l'ancien B1
    // Vérifier qu'il n'y a plus de pendingFollowUpChoice
    expect(result.pendingFollowUpChoice).toBeUndefined();
  });
  it("devrait permettre à l'attaquant de ne pas suivre", () => {
    const state = setup();
    const rng = makeRNG('test-seed');
    // Créer une situation avec pendingFollowUpChoice
    const testState = { ...state };
    testState.players = testState.players.map(p => {
      if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 } };
      if (p.id === 'B1') return { ...p, pos: { x: 10, y: 8 } };
      return p;
    });
    // Créer un pendingFollowUpChoice manuellement
    testState.pendingFollowUpChoice = {
      attackerId: 'A1',
      targetId: 'B1',
      targetNewPosition: { x: 10, y: 9 },
      targetOldPosition: { x: 10, y: 8 },
    };
    // Choisir de ne pas suivre
    const followUpMove = {
      type: 'FOLLOW_UP_CHOOSE',
      playerId: 'A1',
      targetId: 'B1',
      followUp: false,
    };
    const result = applyMove(testState, followUpMove, rng);
    // Vérifier que A1 n'a pas bougé
    const attacker = result.players.find(p => p.id === 'A1');
    expect(attacker?.pos).toEqual({ x: 10, y: 7 }); // Position originale
    // Vérifier qu'il n'y a plus de pendingFollowUpChoice
    expect(result.pendingFollowUpChoice).toBeUndefined();
  });
});
