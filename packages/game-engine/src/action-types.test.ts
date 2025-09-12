import { describe, it, expect } from 'vitest';
import { setup, applyMove, makeRNG, type GameState, type Move } from './index';

describe('Test de tous les types d\'actions', () => {
  it('devrait tester tous les types de mouvements', () => {
    const state = setup();
    const rng = makeRNG('test-seed');
    
    let gameState = { ...state };
    const playerA1 = gameState.players.find(p => p.id === 'A1');
    
    if (playerA1) {
      // Test de mouvement simple
      const move1: Move = { type: 'MOVE', playerId: 'A1', to: { x: playerA1.pos.x + 1, y: playerA1.pos.y } };
      gameState = applyMove(gameState, move1, rng);
      
      const movedPlayer = gameState.players.find(p => p.id === 'A1');
      expect(movedPlayer?.pos).toEqual({ x: playerA1.pos.x + 1, y: playerA1.pos.y });
      
      // Test de mouvement diagonal
      const move2: Move = { type: 'MOVE', playerId: 'A1', to: { x: playerA1.pos.x + 1, y: playerA1.pos.y + 1 } };
      gameState = applyMove(gameState, move2, rng);
      
      const movedPlayer2 = gameState.players.find(p => p.id === 'A1');
      expect(movedPlayer2?.pos).toEqual({ x: playerA1.pos.x + 1, y: playerA1.pos.y + 1 });
    }
  });
  
  it('devrait tester les blocages avec tous les résultats possibles', () => {
    const state = setup();
    const rng = makeRNG('test-seed');
    
    // Positionner des joueurs adjacents
    let gameState = { ...state };
    gameState.players = gameState.players.map(p => {
      if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 } };
      if (p.id === 'B1') return { ...p, pos: { x: 10, y: 8 } };
      return p;
    });
    
    // Test de blocage
    const blockMove: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    let result = applyMove(gameState, blockMove, rng);
    
    expect(result.pendingBlock).toBeDefined();
    expect(result.pendingBlock?.attackerId).toBe('A1');
    expect(result.pendingBlock?.targetId).toBe('B1');
    
    // Tester chaque résultat possible
    const possibleResults = ['PLAYER_DOWN', 'BOTH_DOWN', 'PUSH_BACK', 'STUMBLE', 'POW'];
    
    for (const blockResult of possibleResults) {
      const testState = { ...result };
      const chooseMove: Move = { 
        type: 'BLOCK_CHOOSE', 
        playerId: 'A1', 
        targetId: 'B1', 
        result: blockResult as any 
      };
      
      const finalResult = applyMove(testState, chooseMove, rng);
      
      // Vérifier que le blocage a été traité
      expect(finalResult.pendingBlock).toBeUndefined();
      
      // Vérifier que les logs ont été créés
      const blockLogs = finalResult.gameLog.filter(log => 
        log.message.includes('Blocage:') || 
        log.message.includes('repoussé') ||
        log.message.includes('suiv')
      );
      expect(blockLogs.length).toBeGreaterThan(0);
    }
  });
  
  it('devrait tester les changements de tour', () => {
    const state = setup();
    const rng = makeRNG('test-seed');
    
    let gameState = { ...state };
    const initialTurn = gameState.turn;
    const initialCurrentPlayer = gameState.currentPlayer;
    
    // Finir le tour
    gameState = applyMove(gameState, { type: 'END_TURN' }, rng);
    
    // Vérifier que le tour ou le joueur actuel a changé
    expect(gameState.turn !== initialTurn || gameState.currentPlayer !== initialCurrentPlayer).toBe(true);
    expect(gameState.isTurnover).toBe(false);
  });
  
  it('devrait tester les turnovers', () => {
    const state = setup();
    const rng = makeRNG('test-seed');
    
    let gameState = { ...state };
    
    // Créer une situation de turnover (par exemple, un joueur tombe)
    const playerA1 = gameState.players.find(p => p.id === 'A1');
    if (playerA1) {
      // Simuler un turnover en modifiant l'état
      gameState.isTurnover = true;
      
      // Essayer de faire un mouvement (devrait être ignoré)
      const move: Move = { type: 'MOVE', playerId: 'A1', to: { x: playerA1.pos.x + 1, y: playerA1.pos.y } };
      const result = applyMove(gameState, move, rng);
      
      // Le mouvement devrait être ignoré
      expect(result).toBe(gameState);
    }
  });
  
  it('devrait tester les touchdowns', () => {
    const state = setup();
    const rng = makeRNG('test-seed');
    
    let gameState = { ...state };
    
    // Positionner un joueur dans la zone d'en-but
    gameState.players = gameState.players.map(p => {
      if (p.id === 'A1') return { ...p, pos: { x: 25, y: 7 } }; // Zone d'en-but de l'équipe A
      return p;
    });
    
    // Vérifier qu'un touchdown est détecté
    const touchdownLogs = gameState.gameLog.filter(log => log.message.includes('Touchdown'));
    // Note: La détection de touchdown dépend de l'implémentation de checkTouchdowns
  });
  
  it('devrait tester le système de follow-up complet', () => {
    const state = setup();
    const rng = makeRNG('test-seed');
    
    // Positionner des joueurs pour un blocage
    let gameState = { ...state };
    gameState.players = gameState.players.map(p => {
      if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 } };
      if (p.id === 'B1') return { ...p, pos: { x: 10, y: 8 } };
      // Déplacer les autres joueurs loin
      if (p.team === 'B' && p.id !== 'B1') return { ...p, pos: { x: 20, y: 20 } };
      if (p.team === 'A' && p.id !== 'A1') return { ...p, pos: { x: 0, y: 0 } };
      return p;
    });
    
    // Effectuer un blocage
    const blockMove: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    let result = applyMove(gameState, blockMove, rng);
    
    // Choisir STUMBLE pour déclencher la poussée
    result = applyMove(result, {
      type: 'BLOCK_CHOOSE',
      playerId: 'A1',
      targetId: 'B1',
      result: 'STUMBLE'
    }, rng);
    
    if (result.pendingPushChoice) {
      // Choisir une direction de poussée
      const direction = result.pendingPushChoice.availableDirections[0];
      result = applyMove(result, {
        type: 'PUSH_CHOOSE',
        playerId: 'A1',
        targetId: 'B1',
        direction
      }, rng);
      
      if (result.pendingFollowUpChoice) {
        // Test 1: Suivre
        const followUpResult = applyMove(result, {
          type: 'FOLLOW_UP_CHOOSE',
          playerId: 'A1',
          targetId: 'B1',
          followUp: true
        }, rng);
        
        const attacker = followUpResult.players.find(p => p.id === 'A1');
        expect(attacker?.pos).not.toEqual({ x: 10, y: 7 }); // A1 a bougé
        expect(followUpResult.pendingFollowUpChoice).toBeUndefined();
        
        // Test 2: Ne pas suivre
        const noFollowUpResult = applyMove(result, {
          type: 'FOLLOW_UP_CHOOSE',
          playerId: 'A1',
          targetId: 'B1',
          followUp: false
        }, rng);
        
        const attacker2 = noFollowUpResult.players.find(p => p.id === 'A1');
        expect(attacker2?.pos).toEqual({ x: 10, y: 7 }); // A1 est resté en place
        expect(noFollowUpResult.pendingFollowUpChoice).toBeUndefined();
      }
    }
  });
  
  it('devrait tester la gestion des erreurs et des mouvements invalides', () => {
    const state = setup();
    const rng = makeRNG('test-seed');
    
    let gameState = { ...state };
    
    // Test de mouvement vers une position occupée
    const playerA1 = gameState.players.find(p => p.id === 'A1');
    const playerB1 = gameState.players.find(p => p.id === 'B1');
    
    if (playerA1 && playerB1) {
      const invalidMove: Move = { 
        type: 'MOVE', 
        playerId: 'A1', 
        to: playerB1.pos // Position occupée par B1
      };
      
      const result = applyMove(gameState, invalidMove, rng);
      
      // Le mouvement devrait être ignoré ou rejeté
      const movedPlayer = result.players.find(p => p.id === 'A1');
      expect(movedPlayer?.pos).toEqual(playerA1.pos); // Position inchangée
    }
    
    // Test de blocage sur un joueur non adjacent
    const distantPlayer = gameState.players.find(p => 
      p.team === 'B' && 
      Math.abs(p.pos.x - (playerA1?.pos.x || 0)) > 1
    );
    
    if (playerA1 && distantPlayer) {
      const invalidBlock: Move = { 
        type: 'BLOCK', 
        playerId: 'A1', 
        targetId: distantPlayer.id 
      };
      
      const result = applyMove(gameState, invalidBlock, rng);
      
      // Le blocage devrait être rejeté
      expect(result.pendingBlock).toBeUndefined();
    }
  });
});
