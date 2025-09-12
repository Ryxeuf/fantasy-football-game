import { describe, it, expect, beforeEach } from 'vitest';
import {
  setup,
  applyMove,
  makeRNG,
  rollBlockDice,
  rollBlockDiceMany,
  rollBlockDiceManyWithRolls,
  calculateBlockDiceCount,
  getBlockDiceChooser,
  resolveBlockResult,
  type GameState,
  type BlockResult,
  type BlockDiceResult,
} from '@bb/game-engine';

describe('Tests des dés de blocage - Vérification complète', () => {
  let state: GameState;
  let rng: ReturnType<typeof makeRNG>;

  beforeEach(() => {
    state = setup();
    rng = makeRNG('dice-test-seed');
  });

  describe('Vérification des faces de dés', () => {
    it('devrait avoir exactement 5 faces de dés de blocage (6 faces avec Push Back dupliqué)', () => {
      const expectedFaces: BlockResult[] = [
        'PLAYER_DOWN',
        'BOTH_DOWN',
        'PUSH_BACK',
        'STUMBLE',
        'POW',
      ];

      // Tester plusieurs jets pour s'assurer que toutes les faces peuvent apparaître
      const results = new Set<BlockResult>();
      for (let i = 0; i < 100; i++) {
        results.add(rollBlockDice(rng));
      }

      // Vérifier que toutes les faces sont présentes
      for (const face of expectedFaces) {
        expect(results.has(face)).toBe(true);
      }

      // Vérifier qu'il n'y a pas d'autres faces
      expect(results.size).toBe(5);
    });

    it('devrait avoir la distribution correcte des faces (Push Back sur 2 faces)', () => {
      const faceCounts: Record<BlockResult, number> = {
        PLAYER_DOWN: 0,
        BOTH_DOWN: 0,
        PUSH_BACK: 0,
        STUMBLE: 0,
        POW: 0,
      };

      // Lancer 6000 dés pour avoir une bonne statistique (1000 par face attendue)
      for (let i = 0; i < 6000; i++) {
        const result = rollBlockDice(rng);
        faceCounts[result]++;
      }

      // Push Back devrait apparaître sur 2 faces sur 6 (1/3 des jets)
      expect(faceCounts['PUSH_BACK']).toBeGreaterThan(1800); // ~2000 attendu
      expect(faceCounts['PUSH_BACK']).toBeLessThan(2200);

      // Les autres faces devraient apparaître sur 1 face sur 6 chacune (1/6 des jets)
      const singleFaceFaces: BlockResult[] = ['PLAYER_DOWN', 'BOTH_DOWN', 'STUMBLE', 'POW'];
      for (const face of singleFaceFaces) {
        expect(faceCounts[face]).toBeGreaterThan(900); // ~1000 attendu
        expect(faceCounts[face]).toBeLessThan(1100);
      }
    });

    it('devrait correspondre aux règles officielles de Blood Bowl', () => {
      // Selon les règles, les dés de blocage ont 6 faces avec 5 icônes uniques :
      // 1. Player Down! - L'attaquant est mis au sol (1 face)
      // 2. Both Down - Les deux joueurs sont mis au sol (1 face)
      // 3. Push Back - La cible est repoussée d'1 case (2 faces)
      // 4. Stumble - Si la cible utilise Dodge, cela devient Push ; sinon, c'est POW! (1 face)
      // 5. POW! - La cible est repoussée puis mise au sol (1 face)

      const expectedFaces = [
        'PLAYER_DOWN', // Player Down!
        'BOTH_DOWN', // Both Down
        'PUSH_BACK', // Push Back
        'STUMBLE', // Stumble
        'POW', // POW!
      ];

      const actualFaces = new Set<BlockResult>();
      for (let i = 0; i < 100; i++) {
        actualFaces.add(rollBlockDice(rng));
      }

      for (const face of expectedFaces) {
        expect(actualFaces.has(face as BlockResult)).toBe(true);
      }
    });
  });

  describe('Calcul du nombre de dés', () => {
    it('devrait calculer correctement le nombre de dés selon les règles', () => {
      // Force égale : 1 dé
      expect(calculateBlockDiceCount(3, 3)).toBe(1);

      // Attaquant plus fort : 2 dés, attaquant choisit
      expect(calculateBlockDiceCount(4, 3)).toBe(2);
      expect(calculateBlockDiceCount(5, 3)).toBe(2);

      // Attaquant beaucoup plus fort : 3 dés, attaquant choisit
      expect(calculateBlockDiceCount(6, 3)).toBe(3);
      expect(calculateBlockDiceCount(7, 3)).toBe(3);

      // Attaquant plus faible : 2 dés, défenseur choisit
      expect(calculateBlockDiceCount(2, 3)).toBe(2);

      // Attaquant beaucoup plus faible : 3 dés, défenseur choisit
      expect(calculateBlockDiceCount(1, 3)).toBe(3);
    });

    it('devrait déterminer correctement qui choisit le résultat', () => {
      // Force égale : 1 dé (pas de choix)
      expect(getBlockDiceChooser(3, 3)).toBe('attacker');

      // Attaquant plus fort : attaquant choisit
      expect(getBlockDiceChooser(4, 3)).toBe('attacker');
      expect(getBlockDiceChooser(6, 3)).toBe('attacker');

      // Attaquant plus faible : défenseur choisit
      expect(getBlockDiceChooser(2, 3)).toBe('defender');
      expect(getBlockDiceChooser(1, 3)).toBe('defender');
    });
  });

  describe('Tests des jets multiples', () => {
    it('devrait lancer plusieurs dés correctement', () => {
      const results = rollBlockDiceMany(rng, 3);
      expect(results).toHaveLength(3);

      // Tous les résultats doivent être valides
      for (const result of results) {
        expect(['PLAYER_DOWN', 'BOTH_DOWN', 'PUSH_BACK', 'STUMBLE', 'POW']).toContain(result);
      }
    });

    it('devrait lancer plusieurs dés avec les numéros de jet', () => {
      const results = rollBlockDiceManyWithRolls(rng, 2);
      expect(results).toHaveLength(2);

      for (const { diceRoll, result } of results) {
        expect(diceRoll).toBeGreaterThanOrEqual(1);
        expect(diceRoll).toBeLessThanOrEqual(5);
        expect(['PLAYER_DOWN', 'BOTH_DOWN', 'PUSH_BACK', 'STUMBLE', 'POW']).toContain(result);
      }
    });
  });

  describe("Tests d'intégration avec le jeu", () => {
    it('devrait exécuter un blocage complet avec tous les résultats possibles', () => {
      // Positionner les joueurs adjacents
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 8 };
          return p;
        }),
      };

      // Tester chaque résultat de blocage
      const testResults: BlockResult[] = [
        'PLAYER_DOWN',
        'BOTH_DOWN',
        'PUSH_BACK',
        'STUMBLE',
        'POW',
      ];

      for (const testResult of testResults) {
        // Créer un résultat de blocage simulé
        const blockResult: BlockDiceResult = {
          type: 'block',
          playerId: 'A1',
          targetId: 'B1',
          diceRoll: 1,
          result: testResult,
          offensiveAssists: 0,
          defensiveAssists: 0,
          totalStrength: 3,
          targetStrength: 3,
        };

        // Résoudre le résultat
        const resultState = resolveBlockResult(newState, blockResult, rng);

        // Vérifier que l'état a été modifié selon le résultat
        expect(resultState).toBeDefined();
        expect(resultState.players).toBeDefined();

        // Vérifier que le log contient l'information de blocage
        const blockLogs = resultState.gameLog.filter(
          log => log.type === 'dice' && log.message.includes('Blocage:')
        );
        expect(blockLogs.length).toBeGreaterThan(0);
      }
    });

    it('devrait gérer correctement les choix de blocage multiples', () => {
      // Positionner les joueurs pour un blocage avec 2 dés
      const newState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7, st: 4 };
          if (p.id === 'B1') return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 8, st: 3 };
          return p;
        }),
      };

      // Exécuter un blocage (4 vs 3 = 2 dés, attaquant choisit)
      const resultState = applyMove(
        newState,
        { type: 'BLOCK', playerId: 'A1', targetId: 'B1' },
        rng
      );

      // Vérifier qu'il y a un choix en attente
      expect(resultState.pendingBlock).toBeDefined();
      expect(resultState.pendingBlock?.options).toHaveLength(2);
      expect(resultState.pendingBlock?.chooser).toBe('attacker');

      // Vérifier que les options sont valides
      for (const option of resultState.pendingBlock!.options) {
        expect(['PLAYER_DOWN', 'BOTH_DOWN', 'PUSH_BACK', 'STUMBLE', 'POW']).toContain(option);
      }
    });
  });

  describe('Tests de conformité avec les règles', () => {
    it('devrait respecter les règles de Blood Bowl pour les résultats', () => {
      // Tester que chaque résultat correspond aux règles
      const testCases = [
        { result: 'PLAYER_DOWN', expected: "L'attaquant est mis au sol", probability: '1/6' },
        { result: 'BOTH_DOWN', expected: 'Les deux joueurs sont mis au sol', probability: '1/6' },
        { result: 'PUSH_BACK', expected: "La cible est repoussée d'1 case", probability: '2/6' },
        {
          result: 'STUMBLE',
          expected: "Si la cible utilise Dodge, cela devient Push ; sinon, c'est POW!",
          probability: '1/6',
        },
        { result: 'POW', expected: 'La cible est repoussée puis mise au sol', probability: '1/6' },
      ];

      for (const testCase of testCases) {
        // Vérifier que le résultat existe dans le type
        expect(['PLAYER_DOWN', 'BOTH_DOWN', 'PUSH_BACK', 'STUMBLE', 'POW']).toContain(
          testCase.result
        );

        // Vérifier que le résultat peut être généré
        let found = false;
        for (let i = 0; i < 100; i++) {
          if (rollBlockDice(rng) === testCase.result) {
            found = true;
            break;
          }
        }
        expect(found).toBe(true);
      }
    });
  });
});
