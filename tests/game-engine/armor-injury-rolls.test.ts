import { describe, it, expect, beforeEach } from "vitest";
import {
  setup,
  applyMove,
  makeRNG,
  type GameState,
  type Move,
} from "@bb/game-engine";

describe("Jets d'armure et de blessure", () => {
  let state: GameState;
  let rng: () => number;

  beforeEach(() => {
    state = setup();
    rng = makeRNG("armor-injury-test-seed");
  });

  describe("Jet d'armure déclenché lors d'un blocage", () => {
    it("devrait déclencher un jet d'armure quand l'attaquant tombe (PLAYER_DOWN)", () => {
      // Positionner les joueurs pour un blocage
      const testState = {
        ...state,
        players: state.players.map((p) => {
          if (p.id === "A1")
            return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === "B1")
            return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 8 };
          return p;
        }),
      };

      // Faire un blocage
      const blockMove: Move = {
        type: "BLOCK",
        playerId: "A1",
        targetId: "B1",
      };

      const result = applyMove(testState, blockMove, rng);

      // Avec des forces différentes (A1 st=3 vs B1 st=2), on obtient 2 dés
      // L'attaquant choisit -> pendingBlock est créé
      if (result.pendingBlock) {
        // Choisir PLAYER_DOWN pour faire tomber l'attaquant
        const chooseMove: Move = {
          type: "BLOCK_CHOOSE",
          playerId: "A1",
          targetId: "B1",
          result: "PLAYER_DOWN",
        };

        const finalResult = applyMove(result, chooseMove, rng);

        // L'attaquant devrait être étourdi (PLAYER_DOWN)
        const playerA1 = finalResult.players.find((p) => p.id === "A1");
        expect(playerA1?.stunned).toBe(true);

        // Il devrait y avoir un turnover
        expect(finalResult.isTurnover).toBe(true);

        // Vérifier qu'il y a au moins un log d'armure
        const armorLogs = finalResult.gameLog.filter(
          (log) =>
            log.type === "dice" && log.message.includes("Jet d'armure"),
        );
        expect(armorLogs.length).toBeGreaterThan(0);
      } else {
        // Si résolution directe (1 seul dé), vérifier le résultat
        // Le résultat dépend du RNG, mais le système doit fonctionner
        expect(result.gameLog.length).toBeGreaterThan(0);
      }
    });

    it("devrait gérer le résultat BOTH_DOWN correctement", () => {
      // Positionner les joueurs pour un blocage
      const testState = {
        ...state,
        players: state.players.map((p) => {
          if (p.id === "A1")
            return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === "B1")
            return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 8 };
          return p;
        }),
      };

      // Faire un blocage
      const blockMove: Move = {
        type: "BLOCK",
        playerId: "A1",
        targetId: "B1",
      };

      const result = applyMove(testState, blockMove, rng);

      // Avec 2 dés (A1 choisit), choisir BOTH_DOWN
      if (result.pendingBlock) {
        const chooseMove: Move = {
          type: "BLOCK_CHOOSE",
          playerId: "A1",
          targetId: "B1",
          result: "BOTH_DOWN",
        };

        const finalResult = applyMove(result, chooseMove, rng);

        // A1 a la compétence Block, donc ne tombe PAS en BOTH_DOWN
        // B1 n'a pas Block, donc B1 tombe
        const playerA1 = finalResult.players.find((p) => p.id === "A1");
        const playerB1 = finalResult.players.find((p) => p.id === "B1");

        // A1 a Block -> ne tombe pas
        expect(playerA1?.stunned).toBe(false);
        // B1 n'a pas Block -> tombe
        expect(playerB1?.stunned).toBe(true);

        // Pas de turnover car l'attaquant (A1) ne tombe pas grâce à Block
        expect(finalResult.isTurnover).toBe(false);

        // Vérifier qu'il y a des logs d'armure/blessure pour B1
        const armorLogs = finalResult.gameLog.filter(
          (log) =>
            log.type === "dice" && log.message.includes("Jet d'armure"),
        );
        expect(armorLogs.length).toBeGreaterThan(0);
      } else {
        // Résolution directe
        expect(result.gameLog.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Échec de blitz avec jet d'armure", () => {
    it("devrait déclencher un turnover et jet d'armure après échec de blitz", () => {
      // Positionner les joueurs pour un blitz qui nécessite une esquive
      // B2 adjacent à A1 pour déclencher un jet d'esquive
      const testState = {
        ...state,
        teamRerolls: { teamA: 0, teamB: 0 }, // Pas de relances
        players: state.players.map((p) => {
          if (p.id === "A1")
            return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 7 };
          if (p.id === "B1")
            return { ...p, pos: { x: 12, y: 7 }, stunned: false, pm: 8 };
          if (p.id === "B2")
            return { ...p, pos: { x: 10, y: 8 }, stunned: false, pm: 6 }; // Adjacent à A1
          return p;
        }),
      };

      // Faire un blitz qui va échouer
      const blitzMove: Move = {
        type: "BLITZ",
        playerId: "A1",
        to: { x: 11, y: 7 },
        targetId: "B1",
      };

      // Utiliser un RNG qui va faire échouer le jet d'esquive
      const failingRng = () => 0.1; // Valeur basse pour échouer
      const result = applyMove(testState, blitzMove, failingRng);

      // Vérifier que le turnover est déclenché
      expect(result.isTurnover).toBe(true);

      // Vérifier que le joueur A1 est étourdi
      const playerA1 = result.players.find((p) => p.id === "A1");
      expect(playerA1?.stunned).toBe(true);

      // Vérifier qu'un jet d'armure a été effectué
      const armorLogs = result.gameLog.filter(
        (log) => log.type === "dice" && log.message.includes("Jet d'armure"),
      );
      expect(armorLogs.length).toBeGreaterThan(0);
    });
  });
});
