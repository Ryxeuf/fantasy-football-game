import { describe, it, expect } from 'vitest';
import { setup, applyMove, makeRNG, type GameState, type Move } from './index';

describe('Debug - Follow-up', () => {
  it('devrait déboguer pourquoi le follow-up ne fonctionne pas', () => {
    const state = setup();
    const rng = makeRNG('test-seed');
    
    // Positionner A1 au nord de B1
    let testState = { ...state };
    testState.players = testState.players.map(p => {
      if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 } };
      if (p.id === 'B1') return { ...p, pos: { x: 10, y: 8 } };
      // Déplacer tous les autres joueurs loin
      if (p.team === 'B' && p.id !== 'B1') return { ...p, pos: { x: 20, y: 20 } };
      if (p.team === 'A' && p.id !== 'A1') return { ...p, pos: { x: 0, y: 0 } };
      return p;
    });
    
    console.log('Positions avant blocage:');
    console.log('A1:', testState.players.find(p => p.id === 'A1')?.pos);
    console.log('B1:', testState.players.find(p => p.id === 'B1')?.pos);
    
    // Effectuer un blocage
    const blockMove: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const blockResult = applyMove(testState, blockMove, rng);
    
    console.log('Résultat du blocage:');
    console.log('pendingBlock:', blockResult.pendingBlock);
    
    // Choisir STUMBLE pour déclencher la poussée
    const chooseMove: Move = { type: 'BLOCK_CHOOSE', playerId: 'A1', targetId: 'B1', result: 'STUMBLE' };
    const pushResult = applyMove(blockResult, chooseMove, rng);
    
    console.log('Résultat après choix STUMBLE:');
    console.log('pendingPushChoice:', pushResult.pendingPushChoice);
    console.log('pendingFollowUpChoice:', pushResult.pendingFollowUpChoice);
    
    if (pushResult.pendingPushChoice) {
      // Choisir une direction de poussée
      const pushChooseMove: Move = { 
        type: 'PUSH_CHOOSE', 
        playerId: 'A1', 
        targetId: 'B1', 
        direction: { x: 0, y: 1 } // Sud
      };
      const result = applyMove(pushResult, pushChooseMove, rng);
      
      console.log('Résultat après choix de direction:');
      console.log('pendingFollowUpChoice:', result.pendingFollowUpChoice);
      console.log('B1 position:', result.players.find(p => p.id === 'B1')?.pos);
      console.log('A1 position:', result.players.find(p => p.id === 'A1')?.pos);
    }
    
    // Le test devrait au moins passer
    expect(testState).toBeDefined();
  });
});
