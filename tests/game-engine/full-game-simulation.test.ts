import { describe, it, expect } from "vitest";
import {
  setup,
  applyMove,
  makeRNG,
  type GameState,
  type Move,
} from "@bb/game-engine";

describe("Simulation complète de jeu - 4 tours", () => {
  it("devrait simuler 4 tours complets avec toutes les actions possibles", () => {
    const state = setup();
    const rng = makeRNG("test-seed");

    let gameState = { ...state };
    const gameLog: string[] = [];

    // Fonction utilitaire pour logger les actions
    const logAction = (action: string, playerId: string) => {
      const player = gameState.players.find((p) => p.id === playerId);
      const log = `Tour ${gameState.turn} - ${player?.name || playerId}: ${action}`;
      gameLog.push(log);
      console.log(log);
    };

    // Fonction utilitaire pour obtenir les mouvements légaux
    const getLegalMoves = (playerId: string) => {
      const moves: Move[] = [];
      const player = gameState.players.find((p) => p.id === playerId);
      if (!player) return moves;

      // Mouvements de base
      for (let x = 0; x < gameState.width; x++) {
        for (let y = 0; y < gameState.height; y++) {
          const move: Move = { type: "MOVE", playerId, to: { x, y } };
          try {
            const testState = applyMove(gameState, move, rng);
            if (testState !== gameState) {
              moves.push(move);
            }
          } catch (e) {
            // Ignorer les mouvements illégaux
          }
        }
      }

      // Blocages
      const adjacentPlayers = gameState.players.filter(
        (p) =>
          p.team !== player.team &&
          Math.abs(p.pos.x - player.pos.x) <= 1 &&
          Math.abs(p.pos.y - player.pos.y) <= 1,
      );

      for (const target of adjacentPlayers) {
        moves.push({ type: "BLOCK", playerId, targetId: target.id });
      }

      return moves;
    };

    // Fonction utilitaire pour exécuter une action et gérer les popups
    const executeAction = (move: Move): GameState => {
      let currentState = applyMove(gameState, move, rng);

      // Gérer les popups de blocage
      while (currentState.pendingBlock) {
        const blockOptions = currentState.pendingBlock.options;
        const chosenResult =
          blockOptions[Math.floor(Math.random() * blockOptions.length)];

        logAction(
          `Choisit ${chosenResult} pour le blocage`,
          currentState.pendingBlock.attackerId,
        );

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

        logAction(
          `Choisit direction de poussée (${chosenDirection.x}, ${chosenDirection.y})`,
          currentState.pendingPushChoice.attackerId,
        );

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
        const followUp = Math.random() > 0.5; // 50% de chance de suivre

        logAction(
          followUp ? "Suit le joueur poussé" : "Ne suit pas le joueur poussé",
          currentState.pendingFollowUpChoice.attackerId,
        );

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

    // Simulation de 4 tours
    for (let turn = 1; turn <= 4; turn++) {
      console.log(`\n=== TOUR ${turn} ===`);

      // Équipe A joue
      const teamAPlayers = gameState.players.filter(
        (p) => p.team === "A" && !gameState.isTurnover,
      );
      for (const player of teamAPlayers) {
        if (gameState.isTurnover) break;

        const legalMoves = getLegalMoves(player.id);
        if (legalMoves.length === 0) continue;

        // Choisir une action aléatoire
        const randomMove =
          legalMoves[Math.floor(Math.random() * legalMoves.length)];

        if (randomMove.type === "MOVE") {
          logAction(
            `Se déplace vers (${randomMove.to.x}, ${randomMove.to.y})`,
            player.id,
          );
        } else if (randomMove.type === "BLOCK") {
          const target = gameState.players.find(
            (p) => p.id === randomMove.targetId,
          );
          logAction(`Bloque ${target?.name || randomMove.targetId}`, player.id);
        }

        gameState = executeAction(randomMove);

        // Vérifier les conditions de fin de tour
        if (gameState.isTurnover) {
          logAction("TURNOVER!", player.id);
          break;
        }
      }

      // Fin du tour de l'équipe A
      if (!gameState.isTurnover) {
        logAction("Fin du tour", "A1");
        gameState = applyMove(gameState, { type: "END_TURN" }, rng);
      }

      // Équipe B joue
      const teamBPlayers = gameState.players.filter(
        (p) => p.team === "B" && !gameState.isTurnover,
      );
      for (const player of teamBPlayers) {
        if (gameState.isTurnover) break;

        const legalMoves = getLegalMoves(player.id);
        if (legalMoves.length === 0) continue;

        // Choisir une action aléatoire
        const randomMove =
          legalMoves[Math.floor(Math.random() * legalMoves.length)];

        if (randomMove.type === "MOVE") {
          logAction(
            `Se déplace vers (${randomMove.to.x}, ${randomMove.to.y})`,
            player.id,
          );
        } else if (randomMove.type === "BLOCK") {
          const target = gameState.players.find(
            (p) => p.id === randomMove.targetId,
          );
          logAction(`Bloque ${target?.name || randomMove.targetId}`, player.id);
        }

        gameState = executeAction(randomMove);

        // Vérifier les conditions de fin de tour
        if (gameState.isTurnover) {
          logAction("TURNOVER!", player.id);
          break;
        }
      }

      // Fin du tour de l'équipe B
      if (!gameState.isTurnover) {
        logAction("Fin du tour", "B1");
        gameState = applyMove(gameState, { type: "END_TURN" }, rng);
      }

      // Vérifier les touchdowns
      const touchdowns = gameState.gameLog.filter((log) =>
        log.message.includes("Touchdown"),
      );
      if (touchdowns.length > 0) {
        logAction(
          "TOUCHDOWN!",
          touchdowns[touchdowns.length - 1]?.playerId || "unknown",
        );
      }
    }

    // Vérifications finales
    console.log("\n=== RÉSULTATS FINAUX ===");
    console.log(
      `Score: A=${gameState.score.teamA}, B=${gameState.score.teamB}`,
    );
    console.log(`Tour actuel: ${gameState.turn}`);
    console.log(`Mi-temps: ${gameState.half}`);
    console.log(`Turnover: ${gameState.isTurnover}`);

    // Vérifier que le jeu s'est déroulé correctement
    expect(gameState.turn).toBeGreaterThan(1);
    expect(gameState.half).toBeGreaterThanOrEqual(1);

    // Vérifier que les joueurs ont des positions valides
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

    console.log(`\nActions exécutées: ${gameLog.length}`);
    console.log("Log complet:", gameLog);
  });

  it("devrait tester spécifiquement les actions de blocage avec follow-up", () => {
    const state = setup();
    const rng = makeRNG("test-seed");

    const gameState = { ...state };

    // Positionner des joueurs pour un blocage
    gameState.players = gameState.players.map((p) => {
      if (p.id === "A1") return { ...p, pos: { x: 10, y: 7 } };
      if (p.id === "B1") return { ...p, pos: { x: 10, y: 8 } };
      // Déplacer les autres joueurs loin
      if (p.team === "B" && p.id !== "B1")
        return { ...p, pos: { x: 20, y: 20 } };
      if (p.team === "A" && p.id !== "A1") return { ...p, pos: { x: 0, y: 0 } };
      return p;
    });

    // Effectuer un blocage
    const blockMove: Move = { type: "BLOCK", playerId: "A1", targetId: "B1" };
    let result = applyMove(gameState, blockMove, rng);

    // Choisir un résultat qui déclenche une poussée
    const pushResults = ["PUSH_BACK", "STUMBLE", "POW"];
    const chosenResult =
      pushResults[Math.floor(Math.random() * pushResults.length)];

    result = applyMove(
      result,
      {
        type: "BLOCK_CHOOSE",
        playerId: "A1",
        targetId: "B1",
        result: chosenResult as any,
      },
      rng,
    );

    if (result.pendingPushChoice) {
      // Choisir une direction de poussée
      const direction = result.pendingPushChoice.availableDirections[0];
      result = applyMove(
        result,
        {
          type: "PUSH_CHOOSE",
          playerId: "A1",
          targetId: "B1",
          direction,
        },
        rng,
      );

      if (result.pendingFollowUpChoice) {
        // Choisir de suivre ou non
        const followUp = Math.random() > 0.5;
        result = applyMove(
          result,
          {
            type: "FOLLOW_UP_CHOOSE",
            playerId: "A1",
            targetId: "B1",
            followUp,
          },
          rng,
        );

        // Vérifier le résultat
        const attacker = result.players.find((p) => p.id === "A1");
        const target = result.players.find((p) => p.id === "B1");

        expect(attacker).toBeDefined();
        expect(target).toBeDefined();
        expect(result.pendingFollowUpChoice).toBeUndefined();

        if (followUp) {
          // L'attaquant devrait être dans l'ancienne position de la cible
          expect(attacker?.pos).not.toEqual({ x: 10, y: 7 });
        } else {
          // L'attaquant devrait être resté en place
          expect(attacker?.pos).toEqual({ x: 10, y: 7 });
        }
      }
    }
  });

  it("devrait tester les mouvements et changements de tour", () => {
    const state = setup();
    const rng = makeRNG("test-seed");

    let gameState = { ...state };
    const initialTurn = gameState.turn;
    const initialCurrentPlayer = gameState.currentPlayer;

    // Effectuer quelques mouvements
    const playerA1 = gameState.players.find((p) => p.id === "A1");
    if (playerA1) {
      const move1: Move = {
        type: "MOVE",
        playerId: "A1",
        to: { x: playerA1.pos.x + 1, y: playerA1.pos.y },
      };
      gameState = applyMove(gameState, move1, rng);
    }

    // Finir le tour
    gameState = applyMove(gameState, { type: "END_TURN" }, rng);

    // Vérifier que le tour ou le joueur actuel a changé
    expect(
      gameState.turn !== initialTurn ||
        gameState.currentPlayer !== initialCurrentPlayer,
    ).toBe(true);

    // Effectuer un mouvement avec l'équipe B
    const playerB1 = gameState.players.find((p) => p.id === "B1");
    if (playerB1) {
      const move2: Move = {
        type: "MOVE",
        playerId: "B1",
        to: { x: playerB1.pos.x + 1, y: playerB1.pos.y },
      };
      gameState = applyMove(gameState, move2, rng);
    }

    // Finir le tour
    gameState = applyMove(gameState, { type: "END_TURN" }, rng);

    // Vérifier que le tour a encore changé
    expect(gameState.turn).toBeGreaterThan(initialTurn);
  });
});
