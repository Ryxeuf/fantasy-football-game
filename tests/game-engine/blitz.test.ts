import { describe, it, expect, beforeEach } from 'vitest';
import {
  setup,
  getLegalMoves,
  applyMove,
  makeRNG,
  canBlitz,
  type GameState,
  type Move,
  type TeamId,
} from '@bb/game-engine';

describe('Action de Blitz', () => {
  let state: GameState;
  let rng: () => number;

  beforeEach(() => {
    state = setup();
    rng = makeRNG('blitz-test-seed');
  });

  describe('canBlitz', () => {
    it('devrait permettre un blitz valide', () => {
      // Positionner les joueurs pour un blitz possible
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 12, y: 7 }, stunned: false, pm: 8 };
          return p;
        }),
      };

      const attacker = newState.players.find(p => p.id === 'A1')!;
      const target = newState.players.find(p => p.id === 'B1')!;
      const to = { x: 11, y: 7 }; // Position entre l'attaquant et la cible

      expect(canBlitz(newState, attacker.id, to, target.id)).toBe(true);
    });

    it("ne devrait pas permettre un blitz si l'attaquant est étourdi", () => {
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: true, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 12, y: 7 }, stunned: false, pm: 8 };
          return p;
        }),
      };

      const attacker = newState.players.find(p => p.id === 'A1')!;
      const target = newState.players.find(p => p.id === 'B1')!;
      const to = { x: 11, y: 7 };

      expect(canBlitz(newState, attacker.id, to, target.id)).toBe(false);
    });

    it('ne devrait pas permettre un blitz si la cible est étourdie', () => {
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 12, y: 7 }, stunned: true, pm: 8 };
          return p;
        }),
      };

      const attacker = newState.players.find(p => p.id === 'A1')!;
      const target = newState.players.find(p => p.id === 'B1')!;
      const to = { x: 11, y: 7 };

      expect(canBlitz(newState, attacker.id, to, target.id)).toBe(false);
    });

    it("ne devrait pas permettre un blitz si l'attaquant n'a pas assez de PM", () => {
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 0 }; // Pas de PM du tout
          if (p.id === 'B1') return { ...p, pos: { x: 12, y: 7 }, stunned: false, pm: 8 };
          return p;
        }),
      };

      const attacker = newState.players.find(p => p.id === 'A1')!;
      const target = newState.players.find(p => p.id === 'B1')!;
      const to = { x: 11, y: 7 }; // Distance 1, le blocage coûtera 1 PM supplémentaire après

      expect(canBlitz(newState, attacker.id, to, target.id)).toBe(false);
    });

    it('ne devrait pas permettre un blitz si la cible ne sera pas adjacente après le mouvement', () => {
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 15, y: 7 }, stunned: false, pm: 8 }; // Trop loin
          return p;
        }),
      };

      const attacker = newState.players.find(p => p.id === 'A1')!;
      const target = newState.players.find(p => p.id === 'B1')!;
      const to = { x: 11, y: 7 };

      expect(canBlitz(newState, attacker.id, to, target.id)).toBe(false);
    });

    it('ne devrait pas permettre un blitz entre joueurs de la même équipe', () => {
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === 'A2') return { ...p, pos: { x: 12, y: 7 }, stunned: false, pm: 8 }; // Même équipe
          return p;
        }),
      };

      const attacker = newState.players.find(p => p.id === 'A1')!;
      const target = newState.players.find(p => p.id === 'A2')!;
      const to = { x: 11, y: 7 };

      expect(canBlitz(newState, attacker.id, to, target.id)).toBe(false);
    });
  });

  describe('getLegalMoves - Blitz', () => {
    it('devrait inclure les actions de blitz dans les mouvements légaux', () => {
      // Positionner les joueurs pour un blitz possible
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 12, y: 7 }, stunned: false, pm: 8 };
          return p;
        }),
      };

      const moves = getLegalMoves(newState);
      const blitzMoves = moves.filter(m => m.type === 'BLITZ');

      expect(blitzMoves.length).toBeGreaterThan(0);

      // Vérifier qu'il y a un blitz vers la position entre A1 et B1
      const expectedBlitz = blitzMoves.find(
        m =>
          m.type === 'BLITZ' &&
          m.playerId === 'A1' &&
          m.to.x === 11 &&
          m.to.y === 7 &&
          m.targetId === 'B1'
      );

      expect(expectedBlitz).toBeDefined();
    });

    it("ne devrait pas inclure de blitz si l'attaquant est étourdi", () => {
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: true, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 12, y: 7 }, stunned: false, pm: 8 };
          return p;
        }),
      };

      const moves = getLegalMoves(newState);
      const blitzMoves = moves.filter(m => m.type === 'BLITZ' && m.playerId === 'A1');

      expect(blitzMoves.length).toBe(0);
    });
  });

  describe('applyMove - BLITZ', () => {
    it('devrait effectuer un blitz complet (mouvement + blocage)', () => {
      // Positionner les joueurs pour un blitz
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 12, y: 7 }, stunned: false, pm: 8 };
          return p;
        }),
      };

      const blitzMove: Move = {
        type: 'BLITZ',
        playerId: 'A1',
        to: { x: 11, y: 7 },
        targetId: 'B1',
      };

      const result = applyMove(newState, blitzMove, rng);

      // Vérifier que le joueur s'est déplacé
      const attacker = result.players.find(p => p.id === 'A1')!;
      expect(attacker.pos).toEqual({ x: 11, y: 7 });

      // Vérifier que les PM ont été consommés (distance 1 seulement, le blocage coûtera 1 PM supplémentaire après)
      expect(attacker.pm).toBe(6); // 7 - 1 = 6

      // Vérifier qu'un blocage est en attente
      expect(result.pendingBlock).toBeDefined();
      expect(result.pendingBlock?.attackerId).toBe('A1');
      expect(result.pendingBlock?.targetId).toBe('B1');

      // Vérifier que l'action a été enregistrée
      expect(result.playerActions.get('A1')).toBe('BLITZ');
    });

    it("devrait gérer l'échec d'esquive lors d'un blitz", () => {
      // Positionner les joueurs pour un blitz avec un adversaire adjacent (nécessite esquive)
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 12, y: 7 }, stunned: false, pm: 8 };
          if (p.id === 'B2') return { ...p, pos: { x: 11, y: 8 }, stunned: false, pm: 6 }; // Adjacent à la case d'arrivée
          return p;
        }),
      };

      // Utiliser un RNG déterministe qui force un échec d'esquive
      // Le jet d'esquive se fait sur 1D6, et avec AG=3, il faut 3+
      // Donc on veut un résultat de 1 ou 2 pour échouer
      const failRng = () => 0.1; // 0.1 * 6 = 0.6, donc résultat = 1 (échec) // Valeur très basse pour échouer

      const blitzMove: Move = {
        type: 'BLITZ',
        playerId: 'A1',
        to: { x: 11, y: 7 },
        targetId: 'B1',
      };

      const result = applyMove(newState, blitzMove, failRng);

      // Vérifier que le joueur s'est déplacé malgré l'échec
      const attacker = result.players.find(p => p.id === 'A1')!;
      expect(attacker.pos).toEqual({ x: 11, y: 7 });

      // Vérifier qu'il y a un turnover
      expect(result.isTurnover).toBe(true);

      // Vérifier que le joueur est sonné
      expect(attacker.stunned).toBe(true);

      // Vérifier qu'un jet d'armure a été effectué
      expect(result.lastDiceResult).toBeDefined();
      expect(result.lastDiceResult?.type).toBe('armor');
    });

    it("devrait gérer la perte de ballon lors d'un échec de blitz", () => {
      // Positionner les joueurs pour un blitz avec ballon
      // B2 doit être adjacent à A1 pour déclencher un jet d'esquive
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1')
            return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7, hasBall: true };
          if (p.id === 'B1') return { ...p, pos: { x: 12, y: 7 }, stunned: false, pm: 8 };
          if (p.id === 'B2') return { ...p, pos: { x: 11, y: 8 }, stunned: false, pm: 6 }; // Adjacent à A1
          return p;
        }),
        ball: undefined,
      };

      // Utiliser un RNG déterministe qui force un échec d'esquive
      // Le jet d'esquive se fait sur 1D6, et avec AG=3, il faut 3+
      // Donc on veut un résultat de 1 ou 2 pour échouer
      const failRng = () => 0.1; // 0.1 * 6 = 0.6, donc résultat = 1 (échec)

      const blitzMove: Move = {
        type: 'BLITZ',
        playerId: 'A1',
        to: { x: 11, y: 7 },
        targetId: 'B1',
      };

      const result = applyMove(newState, blitzMove, failRng);

      // Vérifier que le joueur a perdu le ballon
      const attacker = result.players.find(p => p.id === 'A1')!;
      expect(attacker.hasBall).toBe(false);

      // Vérifier que le ballon rebondit
      expect(result.ball).toBeDefined();
      expect(result.ball).not.toEqual(attacker.pos);
    });

    it("devrait permettre un touchdown lors d'un blitz réussi", () => {
      // Positionner un joueur avec ballon près de l'en-but adverse
      // B1 doit être adjacente à la position de destination pour permettre le blitz
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1')
            return { ...p, pos: { x: 24, y: 7 }, stunned: false, pm: 7, hasBall: true };
          if (p.id === 'B1') return { ...p, pos: { x: 25, y: 8 }, stunned: false, pm: 8 }; // Adjacente à (25, 7)
          return p;
        }),
        ball: undefined,
        currentPlayer: 'A' as TeamId,
      };

      const blitzMove: Move = {
        type: 'BLITZ',
        playerId: 'A1',
        to: { x: 25, y: 7 }, // Entrer dans l'en-but
        targetId: 'B1',
      };

      // Utiliser un RNG qui donne des résultats favorables pour éviter que le joueur soit mis à terre
      const goodRng = () => 0.9; // Valeur élevée pour réussir les jets
      const result = applyMove(newState, blitzMove, goodRng);

      // Vérifier que le touchdown a été marqué
      expect(result.score.teamA).toBe(state.score.teamA + 1);
      expect(result.isTurnover).toBe(true);
      expect(result.ball).toBeUndefined();
      expect(result.players.some(p => p.hasBall)).toBe(false);
    });

    it("devrait enregistrer correctement l'action de blitz", () => {
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 12, y: 7 }, stunned: false, pm: 8 };
          return p;
        }),
      };

      const blitzMove: Move = {
        type: 'BLITZ',
        playerId: 'A1',
        to: { x: 11, y: 7 },
        targetId: 'B1',
      };

      const result = applyMove(newState, blitzMove, rng);

      // Vérifier que l'action de blitz a été enregistrée
      expect(result.playerActions.get('A1')).toBe('BLITZ');
    });
  });

  describe('Intégration Blitz avec choix de blocage', () => {
    it('devrait permettre de choisir le résultat du blocage après un blitz', () => {
      // Positionner les joueurs pour un blitz
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 12, y: 7 }, stunned: false, pm: 8 };
          return p;
        }),
      };

      // Effectuer le blitz
      const blitzMove: Move = {
        type: 'BLITZ',
        playerId: 'A1',
        to: { x: 11, y: 7 },
        targetId: 'B1',
      };

      let result = applyMove(newState, blitzMove, rng);

      // Vérifier qu'un blocage est en attente
      expect(result.pendingBlock).toBeDefined();

      // Choisir un résultat de blocage
      const blockChooseMove: Move = {
        type: 'BLOCK_CHOOSE',
        playerId: 'A1',
        targetId: 'B1',
        result: 'PUSH_BACK',
      };

      result = applyMove(result, blockChooseMove, rng);

      // Vérifier que l'action finale est bien BLITZ
      expect(result.playerActions.get('A1')).toBe('BLITZ');
    });

    it('devrait permettre de continuer à bouger après un blitz et consommer 1 PM pour le blocage', () => {
      // Positionner les joueurs pour un blitz
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 12, y: 7 }, stunned: false, pm: 8 };
          return p;
        }),
      };

      // Effectuer le blitz
      const blitzMove: Move = {
        type: 'BLITZ',
        playerId: 'A1',
        to: { x: 11, y: 7 },
        targetId: 'B1',
      };

      let result = applyMove(newState, blitzMove, rng);

      // Vérifier que le joueur a 6 PM après le mouvement (7 - 1 = 6)
      let attacker = result.players.find(p => p.id === 'A1')!;
      expect(attacker.pm).toBe(6);

      // Choisir un résultat de blocage (PUSH_BACK pour éviter un turnover)
      const blockChooseMove: Move = {
        type: 'BLOCK_CHOOSE',
        playerId: 'A1',
        targetId: 'B1',
        result: 'PUSH_BACK',
      };

      result = applyMove(result, blockChooseMove, rng);

      // Vérifier que le joueur a maintenant 5 PM (6 - 1 pour le blocage = 5)
      attacker = result.players.find(p => p.id === 'A1')!;
      expect(attacker.pm).toBe(5);

      // Vérifier que le joueur peut continuer à bouger
      const moves = getLegalMoves(result);
      const continueMoves = moves.filter(m => m.type === 'MOVE' && m.playerId === 'A1');
      expect(continueMoves.length).toBeGreaterThan(0);
    });
  });
});
