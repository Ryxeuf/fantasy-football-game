import { describe, it, expect } from 'vitest';
import { setup, applyMove, type Move } from './index';

describe('Choix de direction de poussée', () => {
  it('devrait créer un pendingPushChoice quand plusieurs directions sont disponibles', () => {
    const state = setup();
    // RNG qui donne PUSH_BACK (3 sur 5 = 0.6)
    const rng = () => 0.6;
    
    // Positionner les joueurs pour un blocage horizontal avec plusieurs directions libres
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

    // Si il y a un pendingBlock, choisir STUMBLE (qui devient PUSH_BACK si la cible a Dodge)
    if (blockResult.pendingBlock) {
      const chooseMove: Move = { type: 'BLOCK_CHOOSE', playerId: 'A1', targetId: 'B1', result: 'STUMBLE' };
      const result = applyMove(blockResult, chooseMove, rng);

      // Vérifier qu'il y a un pendingPushChoice
      expect(result.pendingPushChoice).toBeDefined();
      expect(result.pendingPushChoice?.attackerId).toBe('A1');
      expect(result.pendingPushChoice?.targetId).toBe('B1');
      expect(result.pendingPushChoice?.availableDirections).toHaveLength(3);
      
      // Vérifier que les directions disponibles sont correctes
      const expectedDirections = [
        { x: 1, y: 0 },  // Direction directe
        { x: 1, y: 1 },  // Diagonale 1
        { x: 1, y: -1 }  // Diagonale 2
      ];
      
      for (const expectedDir of expectedDirections) {
        expect(result.pendingPushChoice?.availableDirections).toContainEqual(expectedDir);
      }
    }
  });

  it('devrait permettre à l\'attaquant de choisir la direction de poussée', () => {
    const state = setup();
    const rng = () => 0.6;
    
    // Positionner les joueurs
    const newState = {
      ...state,
      players: state.players.map(p => {
        if (p.id === 'A1') return { ...p, pos: { x: 5, y: 5 }, stunned: false, pm: 7 };
        if (p.id === 'B1') return { ...p, pos: { x: 6, y: 5 }, stunned: false, pm: 8, skills: ['Dodge'] };
        return p;
      })
    };

    // Effectuer un blocage et choisir STUMBLE
    const blockMove: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const blockResult = applyMove(newState, blockMove, rng);

    if (blockResult.pendingBlock) {
      const chooseMove: Move = { type: 'BLOCK_CHOOSE', playerId: 'A1', targetId: 'B1', result: 'STUMBLE' };
      const result = applyMove(blockResult, chooseMove, rng);

      // Choisir la direction diagonale (1, 1)
      const pushChooseMove: Move = { 
        type: 'PUSH_CHOOSE', 
        playerId: 'A1', 
        targetId: 'B1', 
        direction: { x: 1, y: 1 } 
      };
      const finalResult = applyMove(result, pushChooseMove, rng);

      // Vérifier que B1 a été poussé vers (7, 6)
      const pushedPlayer = finalResult.players.find(p => p.id === 'B1');
      expect(pushedPlayer?.pos).toEqual({ x: 7, y: 6 });
      
      // Vérifier que A1 a suivi (follow-up)
      const attacker = finalResult.players.find(p => p.id === 'A1');
      expect(attacker?.pos).toEqual({ x: 6, y: 5 });
      
      // Vérifier qu'il n'y a plus de pendingPushChoice
      expect(finalResult.pendingPushChoice).toBeUndefined();
    }
  });

  it('devrait rejeter une direction invalide', () => {
    const state = setup();
    const rng = () => 0.6;
    
    // Positionner les joueurs
    const newState = {
      ...state,
      players: state.players.map(p => {
        if (p.id === 'A1') return { ...p, pos: { x: 5, y: 5 }, stunned: false, pm: 7 };
        if (p.id === 'B1') return { ...p, pos: { x: 6, y: 5 }, stunned: false, pm: 8, skills: ['Dodge'] };
        return p;
      })
    };

    // Effectuer un blocage et choisir STUMBLE
    const blockMove: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const blockResult = applyMove(newState, blockMove, rng);

    if (blockResult.pendingBlock) {
      const chooseMove: Move = { type: 'BLOCK_CHOOSE', playerId: 'A1', targetId: 'B1', result: 'STUMBLE' };
      const result = applyMove(blockResult, chooseMove, rng);

      // Essayer de choisir une direction invalide
      const invalidPushMove: Move = { 
        type: 'PUSH_CHOOSE', 
        playerId: 'A1', 
        targetId: 'B1', 
        direction: { x: 2, y: 0 } // Direction non disponible
      };
      const finalResult = applyMove(result, invalidPushMove, rng);

      // Vérifier que l'état n'a pas changé (direction invalide rejetée)
      expect(finalResult.players.find(p => p.id === 'B1')?.pos).toEqual({ x: 6, y: 5 });
      expect(finalResult.pendingPushChoice).toBeDefined(); // Toujours en attente
    }
  });

  it('devrait pousser automatiquement si une seule direction est disponible', () => {
    const state = setup();
    const rng = () => 0.6;
    
    // Positionner les joueurs avec des obstacles pour ne laisser qu'une direction
    const newState = {
      ...state,
      players: [
        ...state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 5, y: 5 }, stunned: false, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 6, y: 5 }, stunned: false, pm: 8, skills: ['Dodge'] };
          return p;
        }),
        // Ajouter des joueurs obstacles
        {
          id: 'B5',
          team: 'B',
          pos: { x: 7, y: 6 },
          name: 'Obstacle 1',
          number: 2,
          position: 'Lineman',
          ma: 6,
          st: 3,
          ag: 3,
          pa: 4,
          av: 8,
          skills: [],
          pm: 6,
          hasBall: false,
          stunned: false
        },
        {
          id: 'B6',
          team: 'B',
          pos: { x: 7, y: 4 },
          name: 'Obstacle 2',
          number: 3,
          position: 'Lineman',
          ma: 6,
          st: 3,
          ag: 3,
          pa: 4,
          av: 8,
          skills: [],
          pm: 6,
          hasBall: false,
          stunned: false
        },
      ]
    };

    // Effectuer un blocage et choisir STUMBLE
    const blockMove: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const blockResult = applyMove(newState, blockMove, rng);

    if (blockResult.pendingBlock) {
      const chooseMove: Move = { type: 'BLOCK_CHOOSE', playerId: 'A1', targetId: 'B1', result: 'STUMBLE' };
      const result = applyMove(blockResult, chooseMove, rng);

      // Debug: afficher les directions disponibles et les positions des joueurs
      console.log('Available directions:', result.pendingPushChoice?.availableDirections);
      console.log('Player positions:');
      result.players.forEach(p => {
        if (p.id.startsWith('B')) {
          console.log(`${p.id}: (${p.pos.x}, ${p.pos.y})`);
        }
      });
      
      // Vérifier qu'il n'y a pas de pendingPushChoice (poussée automatique)
      expect(result.pendingPushChoice).toBeUndefined();
      
      // Vérifier que B1 a été poussé vers la seule direction disponible (7, 5)
      const pushedPlayer = result.players.find(p => p.id === 'B1');
      expect(pushedPlayer?.pos).toEqual({ x: 7, y: 5 });
    }
  });
});
