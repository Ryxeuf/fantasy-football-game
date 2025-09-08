import { describe, it, expect } from 'vitest';
import {
  setup,
  applyMove,
  makeRNG,
  canBlock,
  calculateOffensiveAssists,
  calculateDefensiveAssists,
  performBlockRoll,
  resolveBlockResult,
  getAdjacentOpponents,
  isAdjacent,
  getPushDirection,
  isPositionOccupied,
  type GameState,
  type Player,
  type Position
} from './index';

describe('Système de blocage', () => {
  let state: GameState;
  let rng: ReturnType<typeof makeRNG>;

  beforeEach(() => {
    state = setup('test-seed');
    rng = makeRNG('test-seed');
  });

  describe('Détection des joueurs adjacents', () => {
    it('devrait détecter les joueurs adjacents', () => {
      // Positionner les joueurs adjacents
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 } };
          if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 } };
          return p;
        })
      };
      
      const playerAPos = { x: 10, y: 7 };
      const adjacentOpponents = getAdjacentOpponents(newState, playerAPos, 'A');
      expect(adjacentOpponents).toHaveLength(1);
      expect(adjacentOpponents[0].id).toBe('B1');
    });

    it('devrait vérifier si deux positions sont adjacentes', () => {
      const pos1: Position = { x: 10, y: 7 };
      const pos2: Position = { x: 11, y: 7 };
      const pos3: Position = { x: 12, y: 7 };
      
      expect(isAdjacent(pos1, pos2)).toBe(true);
      expect(isAdjacent(pos1, pos3)).toBe(false);
      expect(isAdjacent(pos1, pos1)).toBe(false);
    });
  });

  describe('Validation du blocage', () => {
    it('devrait permettre le blocage entre joueurs adjacents d\'équipes différentes', () => {
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 8 };
          return p;
        })
      };
      
      expect(canBlock(newState, 'A1', 'B1')).toBe(true);
    });

    it('ne devrait pas permettre le blocage entre joueurs de la même équipe', () => {
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === 'A2') return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 6 };
          return p;
        })
      };
      
      expect(canBlock(newState, 'A1', 'A2')).toBe(false);
    });

    it('ne devrait pas permettre le blocage si l\'attaquant est étourdi', () => {
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: true, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 8 };
          return p;
        })
      };
      
      expect(canBlock(newState, 'A1', 'B1')).toBe(false);
    });

    it('ne devrait pas permettre le blocage si la cible est étourdie', () => {
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 }, stunned: true, pm: 8 };
          return p;
        })
      };
      
      expect(canBlock(newState, 'A1', 'B1')).toBe(false);
    });
  });

  describe('Calcul des assists', () => {
    it('devrait calculer les assists offensifs', () => {
      // Positionner un coéquipier de l'attaquant qui marque la cible
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 } };
          if (p.id === 'A2') return { ...p, pos: { x: 11, y: 8 }, stunned: false, pm: 6 }; // Adjacent à la cible
          if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 } };
          if (p.id === 'B2') return { ...p, pos: { x: 20, y: 20 } }; // Loin pour éviter les conflits
          return p;
        })
      };
      
      const attacker = newState.players.find(p => p.id === 'A1')!;
      const target = newState.players.find(p => p.id === 'B1')!;
      
      const assists = calculateOffensiveAssists(newState, attacker, target);
      expect(assists).toBe(1);
    });

    it('devrait calculer les assists défensifs', () => {
      // Positionner un coéquipier de la cible qui marque l'attaquant
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 } };
          if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 } };
          if (p.id === 'B2') return { ...p, pos: { x: 10, y: 8 }, stunned: false, pm: 6 }; // Adjacent à l'attaquant
          return p;
        })
      };
      
      const attacker = newState.players.find(p => p.id === 'A1')!;
      const target = newState.players.find(p => p.id === 'B1')!;
      
      const assists = calculateDefensiveAssists(newState, attacker, target);
      expect(assists).toBe(1);
    });
  });

  describe('Système de dés de blocage', () => {
    it('devrait lancer un dé de blocage', () => {
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      
      const blockResult = performBlockRoll(attacker, target, rng, 0, 0);
      
      expect(blockResult.type).toBe('block');
      expect(blockResult.playerId).toBe('A1');
      expect(blockResult.targetId).toBe('B1');
      expect(blockResult.offensiveAssists).toBe(0);
      expect(blockResult.defensiveAssists).toBe(0);
      expect(blockResult.totalStrength).toBe(attacker.st);
      expect(blockResult.targetStrength).toBe(target.st);
    });
  });

  describe('Résolution des résultats de blocage', () => {
    it('devrait gérer le résultat PLAYER_DOWN', () => {
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      
      const blockResult = {
        type: 'block' as const,
        playerId: attacker.id,
        targetId: target.id,
        diceRoll: 1,
        result: 'PLAYER_DOWN' as const,
        offensiveAssists: 0,
        defensiveAssists: 0,
        totalStrength: attacker.st,
        targetStrength: target.st
      };
      
      const newState = resolveBlockResult(state, blockResult, rng);
      
      // L'attaquant devrait être étourdi
      const updatedAttacker = newState.players.find(p => p.id === attacker.id)!;
      expect(updatedAttacker.stunned).toBe(true);
      
      // Il devrait y avoir un turnover
      expect(newState.isTurnover).toBe(true);
    });

    it('devrait gérer le résultat PUSH_BACK', () => {
      const attacker = state.players.find(p => p.id === 'A1')!;
      const target = state.players.find(p => p.id === 'B1')!;
      
      // Positionner les joueurs pour un push back
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 } };
          if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 } };
          return p;
        })
      };
      
      const blockResult = {
        type: 'block' as const,
        playerId: attacker.id,
        targetId: target.id,
        diceRoll: 3,
        result: 'PUSH_BACK' as const,
        offensiveAssists: 0,
        defensiveAssists: 0,
        totalStrength: attacker.st,
        targetStrength: target.st
      };
      
      const resultState = resolveBlockResult(newState, blockResult, rng);
      
      // Vérifier qu'il y a un pendingPushChoice (plusieurs directions disponibles)
      expect(resultState.pendingPushChoice).toBeDefined();
      expect(resultState.pendingPushChoice?.attackerId).toBe(attacker.id);
      expect(resultState.pendingPushChoice?.targetId).toBe(target.id);
      expect(resultState.pendingPushChoice?.availableDirections).toHaveLength(3);
      
      // Choisir la direction directe (1, 0)
      const pushChooseMove = {
        type: 'PUSH_CHOOSE' as const,
        playerId: attacker.id,
        targetId: target.id,
        direction: { x: 1, y: 0 }
      };
      const finalState = applyMove(resultState, pushChooseMove, rng);
      
      // La cible devrait être repoussée
      const updatedTarget = finalState.players.find(p => p.id === target.id)!;
      expect(updatedTarget.pos.x).toBe(12); // Repoussée d'une case vers la droite
      expect(updatedTarget.pos.y).toBe(7);
      
      // L'attaquant devrait suivre
      const updatedAttacker = finalState.players.find(p => p.id === attacker.id)!;
      expect(updatedAttacker.pos.x).toBe(11); // Prend la place de la cible
      expect(updatedAttacker.pos.y).toBe(7);
    });
  });

  describe('Fonctions utilitaires', () => {
    it('devrait calculer la direction de poussée', () => {
      const attackerPos: Position = { x: 10, y: 7 };
      const targetPos: Position = { x: 11, y: 7 };
      
      const direction = getPushDirection(attackerPos, targetPos);
      expect(direction).toEqual({ x: 1, y: 0 });
    });

    it('devrait vérifier si une position est occupée', () => {
      const occupiedPos: Position = { x: 11, y: 7 }; // Position d'un joueur (A1)
      const freePos: Position = { x: 5, y: 5 }; // Position libre
      
      expect(isPositionOccupied(state, occupiedPos)).toBe(true);
      expect(isPositionOccupied(state, freePos)).toBe(false);
    });
  });

  describe('Intégration dans le jeu', () => {
    it('devrait inclure les actions de blocage dans les mouvements légaux', () => {
      // Positionner les joueurs adjacents
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 8 };
          return p;
        })
      };
      
      const legalMoves = newState.players
        .filter(p => p.team === 'A')
        .flatMap(p => {
          const moves = [];
          // Vérifier les mouvements de blocage
          const adjacentOpponents = getAdjacentOpponents(newState, p.pos, 'A');
          for (const opponent of adjacentOpponents) {
            if (canBlock(newState, p.id, opponent.id)) {
              moves.push({ type: 'BLOCK', playerId: p.id, targetId: opponent.id });
            }
          }
          return moves;
        });
      
      expect(legalMoves.length).toBeGreaterThan(0);
      expect(legalMoves[0].type).toBe('BLOCK');
    });

    it('devrait exécuter une action de blocage', () => {
      // Positionner les joueurs adjacents
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 8 };
          return p;
        })
      };
      
      const resultState = applyMove(
        newState,
        { type: 'BLOCK', playerId: 'A1', targetId: 'B1' },
        rng
      );
      
      // Vérifier que l'action a été enregistrée
      expect(resultState.playerActions.get('A1')).toBe('BLOCK');
      
      // Vérifier qu'il y a un résultat de dés
      expect(resultState.lastDiceResult).toBeDefined();
      expect(resultState.lastDiceResult?.type).toBe('block');
    });
  });
});
