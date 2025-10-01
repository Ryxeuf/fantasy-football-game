import { describe, it, expect } from "vitest";
import { setup, applyMove, makeRNG } from "@bb/game-engine";
import { type GameState, type Move, type Player } from "@bb/game-engine";

describe("Test de stress - Simulation intensive", () => {
  it("devrait simuler 20 tours avec des actions aléatoires", () => {
    const state = setup();
    const rng = makeRNG("stress-test-seed");

    let gameState = { ...state };
    let actionCount = 0;
    let blockCount = 0;
    let moveCount = 0;
    let followUpCount = 0;

    // Fonction pour obtenir des actions légales
    const getRandomAction = (playerId: string): Move | null => {
      const player = gameState.players.find((p) => p.id === playerId);
      if (!player) return null;

      const actions: Move[] = [];

      // Ajouter des mouvements légaux
      for (
        let x = Math.max(0, player.pos.x - 2);
        x <= Math.min(gameState.width - 1, player.pos.x + 2);
        x++
      ) {
        for (
          let y = Math.max(0, player.pos.y - 2);
          y <= Math.min(gameState.height - 1, player.pos.y + 2);
          y++
        ) {
          if (x !== player.pos.x || y !== player.pos.y) {
            actions.push({ type: "MOVE", playerId, to: { x, y } });
          }
        }
      }

      // Ajouter des blocages sur les joueurs adjacents
      const adjacentPlayers = gameState.players.filter(
        (p: Player) =>
          p.team !== player.team &&
          Math.abs(p.pos.x - player.pos.x) <= 1 &&
          Math.abs(p.pos.y - player.pos.y) <= 1,
      );

      for (const target of adjacentPlayers) {
        actions.push({ type: "BLOCK", playerId, targetId: target.id });
      }

      return actions.length > 0
        ? actions[Math.floor(Math.random() * actions.length)]
        : null;
    };

    // Fonction pour exécuter une action et gérer toutes les popups
    const executeActionWithPopups = (move: Move): GameState => {
      let currentState = applyMove(gameState, move, rng);
      actionCount++;

      if (move.type === "MOVE") moveCount++;
      if (move.type === "BLOCK") blockCount++;

      // Gérer les popups de blocage
      while (currentState.pendingBlock) {
        const blockOptions = currentState.pendingBlock.options;
        const chosenResult =
          blockOptions[Math.floor(Math.random() * blockOptions.length)];

        currentState = applyMove(
          currentState,
          {
            type: "BLOCK_CHOOSE",
            playerId: currentState.pendingBlock.attackerId,
            targetId: currentState.pendingBlock.targetId,
            result: chosenResult,
          },
          rng,
        );
      }

      // Gérer les popups de choix de direction de poussée
      while (currentState.pendingPushChoice) {
        const directions = currentState.pendingPushChoice.availableDirections;
        const chosenDirection =
          directions[Math.floor(Math.random() * directions.length)];

        currentState = applyMove(
          currentState,
          {
            type: "PUSH_CHOOSE",
            playerId: currentState.pendingPushChoice.attackerId,
            targetId: currentState.pendingPushChoice.targetId,
            direction: chosenDirection,
          },
          rng,
        );
      }

      // Gérer les popups de follow-up
      while (currentState.pendingFollowUpChoice) {
        const followUp = Math.random() > 0.3; // 70% de chance de suivre

        if (followUp) followUpCount++;

        currentState = applyMove(
          currentState,
          {
            type: "FOLLOW_UP_CHOOSE",
            playerId: currentState.pendingFollowUpChoice.attackerId,
            targetId: currentState.pendingFollowUpChoice.targetId,
            followUp,
          },
          rng,
        );
      }

      return currentState;
    };

    // Simulation de 20 tours
    for (let turn = 1; turn <= 20; turn++) {
      const maxActionsPerTurn = 8; // Limite pour éviter les boucles infinies
      let actionsThisTurn = 0;

      // Équipe A joue
      const teamAPlayers = gameState.players.filter(
        (p: Player) => p.team === "A" && !gameState.isTurnover,
      );
      for (const player of teamAPlayers) {
        if (gameState.isTurnover || actionsThisTurn >= maxActionsPerTurn) break;

        const action = getRandomAction(player.id);
        if (action) {
          gameState = executeActionWithPopups(action);
          actionsThisTurn++;
        }
      }

      // Fin du tour de l'équipe A
      if (!gameState.isTurnover) {
        gameState = applyMove(gameState, { type: "END_TURN" }, rng);
      }

      // Équipe B joue
      const teamBPlayers = gameState.players.filter(
        (p: Player) => p.team === "B" && !gameState.isTurnover,
      );
      actionsThisTurn = 0;

      for (const player of teamBPlayers) {
        if (gameState.isTurnover || actionsThisTurn >= maxActionsPerTurn) break;

        const action = getRandomAction(player.id);
        if (action) {
          gameState = executeActionWithPopups(action);
          actionsThisTurn++;
        }
      }

      // Fin du tour de l'équipe B
      if (!gameState.isTurnover) {
        gameState = applyMove(gameState, { type: "END_TURN" }, rng);
      }

      // Vérifier que l'état reste cohérent
      expect(gameState.turn).toBeGreaterThanOrEqual(1);
      expect(gameState.players.length).toBe(state.players.length);

      // Vérifier qu'il n'y a pas de popups en attente
      expect(gameState.pendingBlock).toBeUndefined();
      expect(gameState.pendingPushChoice).toBeUndefined();
      expect(gameState.pendingFollowUpChoice).toBeUndefined();
    }

    console.log(`\n=== RÉSULTATS DU TEST DE STRESS ===`);
    console.log(`Actions totales: ${actionCount}`);
    console.log(`Mouvements: ${moveCount}`);
    console.log(`Blocages: ${blockCount}`);
    console.log(`Follow-ups: ${followUpCount}`);
    console.log(`Tour final: ${gameState.turn}`);
    console.log(`Mi-temps: ${gameState.half}`);
    console.log(
      `Score: A=${gameState.score.teamA}, B=${gameState.score.teamB}`,
    );

    // Vérifications finales
    expect(actionCount).toBeGreaterThan(0);
    expect(gameState.turn).toBeGreaterThan(0);

    // Vérifier que tous les joueurs ont des positions valides
    for (const player of gameState.players) {
      expect(player.pos.x).toBeGreaterThanOrEqual(0);
      expect(player.pos.x).toBeLessThan(gameState.width);
      expect(player.pos.y).toBeGreaterThanOrEqual(0);
      expect(player.pos.y).toBeLessThan(gameState.height);
    }
  });

  it("devrait tester la robustesse avec des actions invalides", () => {
    const state = setup();
    const rng = makeRNG("robustness-test-seed");

    const gameState = { ...state };

    // Test avec des mouvements vers des positions invalides
    const invalidMoves: Move[] = [
      { type: "MOVE", playerId: "A1", to: { x: -1, y: 0 } }, // Position négative
      { type: "MOVE", playerId: "A1", to: { x: 1000, y: 0 } }, // Position hors limites
      { type: "MOVE", playerId: "INVALID_ID", to: { x: 5, y: 5 } }, // Joueur inexistant
      { type: "BLOCK", playerId: "A1", targetId: "INVALID_ID" }, // Cible inexistante
    ];

    for (const move of invalidMoves) {
      const result = applyMove(gameState, move, rng);

      // L'état ne devrait pas changer pour des actions invalides (ou très peu)
      expect(result.turn).toBe(gameState.turn);
      expect(result.players.length).toBe(gameState.players.length);
    }

    // Test avec des popups invalides
    const invalidPopupMoves: Move[] = [
      {
        type: "BLOCK_CHOOSE",
        playerId: "A1",
        targetId: "B1",
        result: "INVALID" as any,
      },
      {
        type: "PUSH_CHOOSE",
        playerId: "A1",
        targetId: "B1",
        direction: { x: 0, y: 0 },
      },
      {
        type: "FOLLOW_UP_CHOOSE",
        playerId: "A1",
        targetId: "B1",
        followUp: true,
      },
    ];

    for (const move of invalidPopupMoves) {
      const result = applyMove(gameState, move, rng);

      // L'état ne devrait pas changer pour des popups invalides (ou très peu)
      expect(result.turn).toBe(gameState.turn);
      expect(result.players.length).toBe(gameState.players.length);
    }
  });

  it("devrait tester la performance avec de nombreuses actions", () => {
    const state = setup();
    const rng = makeRNG("performance-test-seed");

    const startTime = Date.now();
    let gameState = { ...state };
    let actionCount = 0;

    // Exécuter 100 actions rapides
    for (let i = 0; i < 100; i++) {
      const player = gameState.players[i % gameState.players.length];
      const move: Move = {
        type: "MOVE",
        playerId: player.id,
        to: {
          x: Math.floor(Math.random() * gameState.width),
          y: Math.floor(Math.random() * gameState.height),
        },
      };

      gameState = applyMove(gameState, move, rng);
      actionCount++;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`\n=== TEST DE PERFORMANCE ===`);
    console.log(`Actions exécutées: ${actionCount}`);
    console.log(`Durée: ${duration}ms`);
    console.log(
      `Actions par seconde: ${((actionCount / duration) * 1000).toFixed(2)}`,
    );

    // Vérifier que la performance est acceptable (moins de 1 seconde pour 100 actions)
    expect(duration).toBeLessThan(1000);
    expect(actionCount).toBe(100);
  });
});
