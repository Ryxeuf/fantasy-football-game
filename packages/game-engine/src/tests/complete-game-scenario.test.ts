import { describe, it, expect } from 'vitest';
import { setup, applyMove, makeRNG, type GameState, type Move } from '../index';

describe('Scénario de jeu complet - Actions spécifiques', () => {
  it('devrait simuler un scénario de jeu réaliste avec blocages et follow-ups', () => {
    const state = setup();
    const rng = makeRNG('realistic-game-seed');

    let gameState = { ...state };
    const gameLog: string[] = [];

    // Fonction utilitaire pour logger
    const log = (message: string) => {
      gameLog.push(message);
      console.log(message);
    };

    // Fonction pour exécuter une action et gérer toutes les popups
    const executeAction = (move: Move): GameState => {
      let currentState = applyMove(gameState, move, rng);

      // Gérer les popups de blocage
      while (currentState.pendingBlock) {
        const blockOptions = currentState.pendingBlock.options;
        const chosenResult = blockOptions[Math.floor(Math.random() * blockOptions.length)];

        log(
          `${currentState.players.find(p => p.id === currentState.pendingBlock!.attackerId)?.name} choisit ${chosenResult}`
        );

        currentState = applyMove(
          currentState,
          {
            type: 'BLOCK_CHOOSE',
            playerId: currentState.pendingBlock.attackerId,
            targetId: currentState.pendingBlock.targetId,
            result: chosenResult,
          },
          rng
        );
      }

      // Gérer les popups de choix de direction de poussée
      while (currentState.pendingPushChoice) {
        const directions = currentState.pendingPushChoice.availableDirections;
        const chosenDirection = directions[Math.floor(Math.random() * directions.length)];

        log(
          `${currentState.players.find(p => p.id === currentState.pendingPushChoice!.attackerId)?.name} choisit direction (${chosenDirection.x}, ${chosenDirection.y})`
        );

        currentState = applyMove(
          currentState,
          {
            type: 'PUSH_CHOOSE',
            playerId: currentState.pendingPushChoice.attackerId,
            targetId: currentState.pendingPushChoice.targetId,
            direction: chosenDirection,
          },
          rng
        );
      }

      // Gérer les popups de follow-up
      while (currentState.pendingFollowUpChoice) {
        const followUp = Math.random() > 0.3; // 70% de chance de suivre

        log(
          `${currentState.players.find(p => p.id === currentState.pendingFollowUpChoice!.attackerId)?.name} ${followUp ? 'suit' : 'ne suit pas'}`
        );

        currentState = applyMove(
          currentState,
          {
            type: 'FOLLOW_UP_CHOOSE',
            playerId: currentState.pendingFollowUpChoice.attackerId,
            targetId: currentState.pendingFollowUpChoice.targetId,
            followUp,
          },
          rng
        );
      }

      return currentState;
    };

    log('=== DÉBUT DU MATCH ===');

    // Tour 1 - Équipe A
    log('\n--- Tour 1 - Équipe A ---');

    // A1 se déplace vers le centre
    const move1: Move = { type: 'MOVE', playerId: 'A1', to: { x: 13, y: 7 } };
    gameState = executeAction(move1);
    log('A1 se déplace vers le centre');

    // A2 se déplace vers A1
    const move2: Move = { type: 'MOVE', playerId: 'A2', to: { x: 12, y: 7 } };
    gameState = executeAction(move2);
    log('A2 se déplace vers A1');

    // Fin du tour A
    gameState = applyMove(gameState, { type: 'END_TURN' }, rng);
    log('Fin du tour A');

    // Tour 1 - Équipe B
    log('\n--- Tour 1 - Équipe B ---');

    // B1 se déplace vers A1
    const move3: Move = { type: 'MOVE', playerId: 'B1', to: { x: 14, y: 7 } };
    gameState = executeAction(move3);
    log('B1 se déplace vers A1');

    // B2 se déplace vers A2
    const move4: Move = { type: 'MOVE', playerId: 'B2', to: { x: 11, y: 7 } };
    gameState = executeAction(move4);
    log('B2 se déplace vers A2');

    // Fin du tour B
    gameState = applyMove(gameState, { type: 'END_TURN' }, rng);
    log('Fin du tour B');

    // Tour 2 - Équipe A
    log('\n--- Tour 2 - Équipe A ---');

    // A1 bloque B1
    const block1: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    gameState = executeAction(block1);
    log('A1 bloque B1');

    // A2 bloque B2
    const block2: Move = { type: 'BLOCK', playerId: 'A2', targetId: 'B2' };
    gameState = executeAction(block2);
    log('A2 bloque B2');

    // Fin du tour A
    gameState = applyMove(gameState, { type: 'END_TURN' }, rng);
    log('Fin du tour A');

    // Tour 2 - Équipe B
    log('\n--- Tour 2 - Équipe B ---');

    // B1 se déplace vers la zone d'en-but
    const move5: Move = { type: 'MOVE', playerId: 'B1', to: { x: 25, y: 7 } };
    gameState = executeAction(move5);
    log("B1 se déplace vers la zone d'en-but");

    // B2 se déplace vers B1
    const move6: Move = { type: 'MOVE', playerId: 'B2', to: { x: 24, y: 7 } };
    gameState = executeAction(move6);
    log('B2 se déplace vers B1');

    // Fin du tour B
    gameState = applyMove(gameState, { type: 'END_TURN' }, rng);
    log('Fin du tour B');

    // Tour 3 - Équipe A
    log('\n--- Tour 3 - Équipe A ---');

    // A1 poursuit B1
    const move7: Move = { type: 'MOVE', playerId: 'A1', to: { x: 24, y: 6 } };
    gameState = executeAction(move7);
    log('A1 poursuit B1');

    // A2 se déplace vers A1
    const move8: Move = { type: 'MOVE', playerId: 'A2', to: { x: 23, y: 6 } };
    gameState = executeAction(move8);
    log('A2 se déplace vers A1');

    // A1 bloque B1
    const block3: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    gameState = executeAction(block3);
    log('A1 bloque B1');

    // Fin du tour A
    gameState = applyMove(gameState, { type: 'END_TURN' }, rng);
    log('Fin du tour A');

    // Tour 3 - Équipe B
    log('\n--- Tour 3 - Équipe B ---');

    // B1 se déplace vers la zone d'en-but (touchdown potentiel)
    const move9: Move = { type: 'MOVE', playerId: 'B1', to: { x: 25, y: 8 } };
    gameState = executeAction(move9);
    log("B1 se déplace vers la zone d'en-but");

    // Fin du tour B
    gameState = applyMove(gameState, { type: 'END_TURN' }, rng);
    log('Fin du tour B');

    // Vérifications finales
    log('\n=== RÉSULTATS FINAUX ===');
    log(`Score: A=${gameState.score.teamA}, B=${gameState.score.teamB}`);
    log(`Tour actuel: ${gameState.turn}`);
    log(`Mi-temps: ${gameState.half}`);
    log(`Turnover: ${gameState.isTurnover}`);

    // Vérifier que le jeu s'est déroulé correctement
    expect(gameState.turn).toBeGreaterThan(2);
    expect(gameState.players.length).toBe(4);

    // Vérifier que tous les joueurs ont des positions valides
    for (const player of gameState.players) {
      expect(player.pos.x).toBeGreaterThanOrEqual(0);
      expect(player.pos.x).toBeLessThan(gameState.width);
      expect(player.pos.y).toBeGreaterThanOrEqual(0);
      expect(player.pos.y).toBeLessThan(gameState.height);
    }

    // Vérifier qu'il n'y a pas de popups en attente
    expect(gameState.pendingBlock).toBeUndefined();
    expect(gameState.pendingPushChoice).toBeUndefined();
    expect(gameState.pendingFollowUpChoice).toBeUndefined();

    log(`\nActions exécutées: ${gameLog.length}`);
    expect(gameLog.length).toBeGreaterThan(10);
  });

  it('devrait tester un scénario avec turnovers et récupération', () => {
    const state = setup();
    const rng = makeRNG('turnover-test-seed');

    const gameState = { ...state };

    // Positionner des joueurs pour un blocage
    gameState.players = gameState.players.map(p => {
      if (p.id === 'A1') return { ...p, pos: { x: 10, y: 7 } };
      if (p.id === 'B1') return { ...p, pos: { x: 10, y: 8 } };
      return p;
    });

    // Effectuer un blocage qui peut causer un turnover
    const blockMove: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    let result = applyMove(gameState, blockMove, rng);

    // Choisir un résultat qui peut causer un turnover
    const turnoverResults = ['BOTH_DOWN', 'PLAYER_DOWN'];
    const chosenResult = turnoverResults[Math.floor(Math.random() * turnoverResults.length)];

    result = applyMove(
      result,
      {
        type: 'BLOCK_CHOOSE',
        playerId: 'A1',
        targetId: 'B1',
        result: chosenResult as any,
      },
      rng
    );

    // Vérifier que le turnover a été géré correctement
    expect(result.pendingBlock).toBeUndefined();
    expect(result.pendingPushChoice).toBeUndefined();
    expect(result.pendingFollowUpChoice).toBeUndefined();

    // Vérifier que les logs ont été créés
    const blockLogs = result.gameLog.filter(
      log =>
        log.message.includes('Blocage:') ||
        log.message.includes('repoussé') ||
        log.message.includes('suiv')
    );
    expect(blockLogs.length).toBeGreaterThan(0);
  });
});
