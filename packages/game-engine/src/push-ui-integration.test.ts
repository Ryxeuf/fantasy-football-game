import { describe, it, expect } from 'vitest';
import { setup, applyMove, makeRNG, type GameState, type Move } from './index';

describe('Intégration UI - Choix de direction de poussée', () => {
  it('devrait créer un pendingPushChoice quand plusieurs directions sont disponibles', () => {
    const state = setup();
    const rng = makeRNG('test-seed');
    
    // Créer une situation où l'attaquant est au nord du défenseur
    // et où il y a plusieurs directions de poussée possibles
    let testState = { ...state };
    
    // Positionner A1 au nord de B1, et s'assurer qu'il n'y a pas d'autres joueurs qui bloquent
    testState.players = testState.players.map(p => {
      if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 } }; // Position plus centrale
      if (p.id === 'B1') return { ...p, pos: { x: 10, y: 8 } };
      // Déplacer tous les autres joueurs loin pour éviter qu'ils bloquent les directions
      if (p.team === 'B' && p.id !== 'B1') return { ...p, pos: { x: 20, y: 20 } };
      if (p.team === 'A' && p.id !== 'A1') return { ...p, pos: { x: 0, y: 0 } };
      return p;
    });
    
    // Effectuer un blocage
    const blockMove: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const blockResult = applyMove(testState, blockMove, rng);
    
    // Vérifier qu'il y a un pendingBlock (choix de dé)
    expect(blockResult.pendingBlock).toBeDefined();
    
    // Choisir STUMBLE pour déclencher la poussée
    const chooseMove: Move = { type: 'BLOCK_CHOOSE', playerId: 'A1', targetId: 'B1', result: 'STUMBLE' };
    const result = applyMove(blockResult, chooseMove, rng);
    
    // Vérifier qu'il y a un pendingPushChoice
    expect(result.pendingPushChoice).toBeDefined();
    expect(result.pendingPushChoice?.attackerId).toBe('A1');
    expect(result.pendingPushChoice?.targetId).toBe('B1');
    expect(result.pendingPushChoice?.availableDirections.length).toBeGreaterThanOrEqual(2);
    
    // Vérifier que les directions sont correctes (opposées à l'attaquant)
    // Les directions disponibles sont les directions diagonales car la direction directe est bloquée
    const availableDirections = result.pendingPushChoice?.availableDirections || [];
    expect(availableDirections.length).toBeGreaterThanOrEqual(2);
    
    // Vérifier que les directions sont dans la bonne direction générale (vers le sud)
    for (const dir of availableDirections) {
      expect(dir.y).toBeLessThan(0); // Toutes les directions doivent être vers le sud (y négatif car l'attaquant est au nord)
    }
  });

  it('devrait permettre de choisir une direction de poussée', () => {
    const state = setup();
    const rng = makeRNG('test-seed');
    
    // Créer une situation avec pendingPushChoice
    let testState = { ...state };
    testState.players = testState.players.map(p => {
      if (p.id === 'A1') return { ...p, pos: { x: 5, y: 4 } };
      if (p.id === 'B1') return { ...p, pos: { x: 5, y: 5 } };
      return p;
    });
    
    // Créer un pendingPushChoice manuellement
    testState.pendingPushChoice = {
      attackerId: 'A1',
      targetId: 'B1',
      availableDirections: [
        { x: 0, y: 1 },   // Sud
        { x: 1, y: 1 },   // Sud-Est
        { x: -1, y: 1 }   // Sud-Ouest
      ],
      blockResult: 'STUMBLE',
      offensiveAssists: 0,
      defensiveAssists: 0,
      totalStrength: 3,
      targetStrength: 2
    };
    
    // Choisir la direction Sud-Est
    const pushChooseMove: Move = { 
      type: 'PUSH_CHOOSE', 
      playerId: 'A1', 
      targetId: 'B1', 
      direction: { x: 1, y: 1 } 
    };
    
    const result = applyMove(testState, pushChooseMove, rng);
    
    // Vérifier que B1 a été poussé vers (6, 6)
    const pushedPlayer = result.players.find(p => p.id === 'B1');
    expect(pushedPlayer?.pos).toEqual({ x: 6, y: 6 });
    
    // Vérifier que A1 a suivi (follow-up)
    const attacker = result.players.find(p => p.id === 'A1');
    expect(attacker?.pos).toEqual({ x: 5, y: 5 }); // Position de l'ancien B1
    
    // Vérifier qu'il n'y a plus de pendingPushChoice
    expect(result.pendingPushChoice).toBeUndefined();
  });

  it('devrait rejeter une direction invalide', () => {
    const state = setup();
    const rng = makeRNG('test-seed');
    
    // Créer une situation avec pendingPushChoice
    let testState = { ...state };
    testState.players = testState.players.map(p => {
      if (p.id === 'A1') return { ...p, pos: { x: 5, y: 4 } };
      if (p.id === 'B1') return { ...p, pos: { x: 5, y: 5 } };
      return p;
    });
    
    testState.pendingPushChoice = {
      attackerId: 'A1',
      targetId: 'B1',
      availableDirections: [
        { x: 0, y: 1 },   // Sud
        { x: 1, y: 1 },   // Sud-Est
        { x: -1, y: 1 }   // Sud-Ouest
      ],
      blockResult: 'STUMBLE',
      offensiveAssists: 0,
      defensiveAssists: 0,
      totalStrength: 3,
      targetStrength: 2
    };
    
    // Essayer de choisir une direction invalide (Nord)
    const pushChooseMove: Move = { 
      type: 'PUSH_CHOOSE', 
      playerId: 'A1', 
      targetId: 'B1', 
      direction: { x: 0, y: -1 } // Direction invalide
    };
    
    const result = applyMove(testState, pushChooseMove, rng);
    
    // Vérifier que rien n'a changé (direction invalide rejetée)
    const pushedPlayer = result.players.find(p => p.id === 'B1');
    expect(pushedPlayer?.pos).toEqual({ x: 5, y: 5 }); // Position inchangée
    
    // Vérifier que le pendingPushChoice est toujours là
    expect(result.pendingPushChoice).toBeDefined();
  });
});
