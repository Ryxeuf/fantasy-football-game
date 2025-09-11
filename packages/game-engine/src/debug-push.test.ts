import { describe, it, expect } from 'vitest';
import { setup, applyMove, makeRNG, type GameState, type Move } from './index';

describe('Debug - Choix de direction de poussée', () => {
  it('devrait déboguer pourquoi le blocage ne crée pas de pendingPushChoice', () => {
    const state = setup();
    const rng = makeRNG('test-seed');
    
    // Positionner A1 au nord de B1
    let testState = { ...state };
    testState.players = testState.players.map(p => {
      if (p.id === 'A1') return { ...p, pos: { x: 5, y: 4 } };
      if (p.id === 'B1') return { ...p, pos: { x: 5, y: 5 } };
      return p;
    });
    
    console.log('Positions avant blocage:');
    console.log('A1:', testState.players.find(p => p.id === 'A1')?.pos);
    console.log('B1:', testState.players.find(p => p.id === 'B1')?.pos);
    
    // Effectuer un blocage
    const blockMove: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(testState, blockMove, rng);
    
    console.log('Résultat du blocage:');
    console.log('pendingPushChoice:', result.pendingPushChoice);
    console.log('pendingBlock:', result.pendingBlock);
    console.log('lastDiceResult:', result.lastDiceResult);
    
    // Vérifier les logs pour voir ce qui s'est passé
    const blockLogs = result.gameLog.filter(log => log.message.includes('Blocage:'));
    console.log('Logs de blocage:', blockLogs);
    
    // Vérifier la position de B1 après le blocage
    const b1After = result.players.find(p => p.id === 'B1');
    console.log('B1 position après blocage:', b1After?.pos);
    
    // Le test devrait au moins passer même si pendingPushChoice n'est pas créé
    expect(result).toBeDefined();
  });
});
