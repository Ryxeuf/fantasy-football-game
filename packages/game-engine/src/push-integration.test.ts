import { describe, it, expect } from 'vitest';
import { setup, applyMove, type Move } from './index';

describe('Intégration - Poussée avec 3 directions', () => {
  it('devrait pousser un joueur dans la direction directe si possible', () => {
    const state = setup();
    // RNG qui donne PUSH_BACK (3 sur 5 = 0.6)
    const rng = () => 0.6;
    
    // Positionner les joueurs pour un blocage horizontal
    const newState = {
      ...state,
      players: state.players.map(p => {
        if (p.id === 'A1') return { ...p, pos: { x: 5, y: 5 }, stunned: false, pm: 7 };
        if (p.id === 'B1') return { ...p, pos: { x: 6, y: 5 }, stunned: false, pm: 8, skills: ['Dodge'] };
        return p;
      })
    };

    // Effectuer un blocage qui devrait donner PUSH_BACK
    const blockMove: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const blockResult = applyMove(newState, blockMove, rng);

    // Debug: afficher l'état après le blocage
    console.log('Pending block:', blockResult.pendingBlock);
    console.log('B1 position after block:', blockResult.players.find(p => p.id === 'B1')?.pos);

    // Si il y a un pendingBlock, choisir STUMBLE (qui devient PUSH_BACK si la cible a Dodge)
    if (blockResult.pendingBlock) {
      const chooseMove: Move = { type: 'BLOCK_CHOOSE', playerId: 'A1', targetId: 'B1', result: 'STUMBLE' };
      const result = applyMove(blockResult, chooseMove, rng);

      // Si il y a un pendingPushChoice, choisir la direction directe
      if (result.pendingPushChoice) {
        const pushChooseMove: Move = { 
          type: 'PUSH_CHOOSE', 
          playerId: 'A1', 
          targetId: 'B1', 
          direction: { x: 1, y: 0 } 
        };
        const finalResult = applyMove(result, pushChooseMove, rng);
        
        // Vérifier que B1 a été poussé vers (7, 5) - direction directe
        const pushedPlayer = finalResult.players.find(p => p.id === 'B1');
        expect(pushedPlayer?.pos).toEqual({ x: 7, y: 5 });
      } else {
        // Vérifier que B1 a été poussé automatiquement
        const pushedPlayer = result.players.find(p => p.id === 'B1');
        expect(pushedPlayer?.pos).toEqual({ x: 7, y: 5 });
      }
    } else {
      // Si pas de pendingBlock, vérifier directement
      const pushedPlayer = blockResult.players.find(p => p.id === 'B1');
      expect(pushedPlayer?.pos).toEqual({ x: 7, y: 5 });
    }
  });

  it('devrait essayer les 3 directions si la direction directe est bloquée', () => {
    const state = setup();
    // RNG qui donne PUSH_BACK (3 sur 5 = 0.6)
    const rng = () => 0.6;
    
    // Positionner les joueurs pour un blocage horizontal avec un obstacle
    const newState = {
      ...state,
      players: state.players.map(p => {
        if (p.id === 'A1') return { ...p, pos: { x: 5, y: 5 }, stunned: false, pm: 7 };
        if (p.id === 'B1') return { ...p, pos: { x: 6, y: 5 }, stunned: false, pm: 8, skills: ['Dodge'] };
        if (p.id === 'B2') return { ...p, pos: { x: 7, y: 5 }, stunned: false, pm: 6 }; // Obstacle
        return p;
      })
    };

    // Effectuer un blocage qui devrait donner PUSH_BACK
    const blockMove: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const blockResult = applyMove(newState, blockMove, rng);

    // Si il y a un pendingBlock, choisir STUMBLE (qui devient PUSH_BACK si la cible a Dodge)
    if (blockResult.pendingBlock) {
      const chooseMove: Move = { type: 'BLOCK_CHOOSE', playerId: 'A1', targetId: 'B1', result: 'STUMBLE' };
      const result = applyMove(blockResult, chooseMove, rng);

      // Si il y a un pendingPushChoice, choisir une direction diagonale
      if (result.pendingPushChoice) {
        const pushChooseMove: Move = { 
          type: 'PUSH_CHOOSE', 
          playerId: 'A1', 
          targetId: 'B1', 
          direction: { x: 1, y: 1 } // Direction diagonale
        };
        const finalResult = applyMove(result, pushChooseMove, rng);
        
        // Vérifier que B1 a été poussé dans une direction alternative
        const pushedPlayer = finalResult.players.find(p => p.id === 'B1');
        expect(pushedPlayer?.pos).not.toEqual({ x: 6, y: 5 }); // Pas à la position originale
        expect(pushedPlayer?.pos).not.toEqual({ x: 7, y: 5 }); // Pas bloqué par B2
        
        // Devrait être poussé vers (7, 6) - direction diagonale choisie
        expect(pushedPlayer?.pos).toEqual({ x: 7, y: 6 });
      } else {
        // Vérifier que B1 a été poussé automatiquement
        const pushedPlayer = result.players.find(p => p.id === 'B1');
        expect(pushedPlayer?.pos).not.toEqual({ x: 6, y: 5 });
      }
    } else {
      // Si pas de pendingBlock, vérifier directement
      const pushedPlayer = blockResult.players.find(p => p.id === 'B1');
      expect(pushedPlayer?.pos).not.toEqual({ x: 6, y: 5 });
    }
  });

  it('devrait ne pas pousser si toutes les directions sont bloquées', () => {
    const state = setup();
    // RNG qui donne PUSH_BACK (3 sur 5 = 0.6)
    const rng = () => 0.6;
    
    // Positionner les joueurs avec des obstacles dans toutes les directions
    const newState = {
      ...state,
      players: state.players.map(p => {
        if (p.id === 'A1') return { ...p, pos: { x: 5, y: 5 }, stunned: false, pm: 7 };
        if (p.id === 'B1') return { ...p, pos: { x: 6, y: 5 }, stunned: false, pm: 8 };
        if (p.id === 'B2') return { ...p, pos: { x: 7, y: 5 }, stunned: false, pm: 6 }; // Direction directe
        if (p.id === 'B3') return { ...p, pos: { x: 7, y: 6 }, stunned: false, pm: 6 }; // Direction diagonale 1
        if (p.id === 'B4') return { ...p, pos: { x: 7, y: 4 }, stunned: false, pm: 6 }; // Direction diagonale 2
        return p;
      })
    };

    // Effectuer un blocage qui devrait donner PUSH_BACK
    const blockMove: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(newState, blockMove, rng);

    // Vérifier que B1 n'a pas été poussé (toutes les directions bloquées)
    const pushedPlayer = result.players.find(p => p.id === 'B1');
    expect(pushedPlayer?.pos).toEqual({ x: 6, y: 5 }); // Reste à la position originale
  });

  it('devrait fonctionner avec un blocage diagonal', () => {
    const state = setup();
    // RNG qui donne PUSH_BACK (3 sur 5 = 0.6)
    const rng = () => 0.6;
    
    // Positionner les joueurs pour un blocage diagonal
    const newState = {
      ...state,
      players: state.players.map(p => {
        if (p.id === 'A1') return { ...p, pos: { x: 5, y: 5 }, stunned: false, pm: 7 };
        if (p.id === 'B1') return { ...p, pos: { x: 6, y: 6 }, stunned: false, pm: 8, skills: ['Dodge'] };
        return p;
      })
    };

    // Effectuer un blocage qui devrait donner PUSH_BACK
    const blockMove: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const blockResult = applyMove(newState, blockMove, rng);

    // Si il y a un pendingBlock, choisir STUMBLE (qui devient PUSH_BACK si la cible a Dodge)
    if (blockResult.pendingBlock) {
      const chooseMove: Move = { type: 'BLOCK_CHOOSE', playerId: 'A1', targetId: 'B1', result: 'STUMBLE' };
      const result = applyMove(blockResult, chooseMove, rng);

      // Si il y a un pendingPushChoice, choisir la direction directe
      if (result.pendingPushChoice) {
        const pushChooseMove: Move = { 
          type: 'PUSH_CHOOSE', 
          playerId: 'A1', 
          targetId: 'B1', 
          direction: { x: 1, y: 1 } // Direction directe pour un blocage diagonal
        };
        const finalResult = applyMove(result, pushChooseMove, rng);
        
        // Vérifier que B1 a été poussé vers (7, 7) - direction directe
        const pushedPlayer = finalResult.players.find(p => p.id === 'B1');
        expect(pushedPlayer?.pos).toEqual({ x: 7, y: 7 });
      } else {
        // Vérifier que B1 a été poussé automatiquement
        const pushedPlayer = result.players.find(p => p.id === 'B1');
        expect(pushedPlayer?.pos).toEqual({ x: 7, y: 7 });
      }
    } else {
      // Si pas de pendingBlock, vérifier directement
      const pushedPlayer = blockResult.players.find(p => p.id === 'B1');
      expect(pushedPlayer?.pos).toEqual({ x: 7, y: 7 });
    }
  });
});
