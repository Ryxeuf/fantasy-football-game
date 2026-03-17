import { describe, it, expect, beforeEach } from "vitest";
import { setup, applyMove, makeRNG, getLegalMoves } from "@bb/game-engine";

describe("Bug de continuation de mouvement après blitz", () => {
  let state: any;
  let rng: any;

  beforeEach(() => {
    state = setup();
    rng = makeRNG("test");
  });

  it("devrait permettre à A2 de continuer à bouger après un blitz", () => {
    // Configuration initiale
    const initialState = {
      ...state,
      currentPlayer: "A",
      players: state.players.map((p) => {
        if (p.id === "A2")
          return {
            ...p,
            pos: { x: 16, y: 9 },
            stunned: false,
            pm: 6,
            hasBall: false,
          };
        if (p.id === "B2")
          return {
            ...p,
            pos: { x: 18, y: 9 },
            stunned: false,
            pm: 6,
            hasBall: false,
          };
        return p;
      }),
    };

    // A2 annonce un blitz vers B2
    const blitzMove = {
      type: "BLITZ" as const,
      playerId: "A2",
      to: { x: 17, y: 9 },
      targetId: "B2",
    };

    // Vérifier que le blitz est possible avant de l'exécuter
    const movesBeforeBlitz = getLegalMoves(initialState);
    const blitzMoves = movesBeforeBlitz.filter(
      (m) => m.type === "BLITZ" && m.playerId === "A2",
    );
    expect(blitzMoves.length).toBeGreaterThan(0);

    // Exécuter le blitz
    let currentState = applyMove(initialState, blitzMove, rng);

    // Vérifier que A2 a bougé et a des PM restants
    const a2AfterMove = currentState.players.find((p) => p.id === "A2");
    expect(a2AfterMove.pos).toEqual({ x: 17, y: 9 });
    expect(a2AfterMove.pm).toBeGreaterThan(0);

    // Vérifier que le blocage est en attente
    expect(currentState.pendingBlock).toBeDefined();
    expect(currentState.pendingBlock.attackerId).toBe("A2");

    // Choisir un résultat de blocage (PUSH_BACK pour éviter un turnover)
    const blockChooseMove = {
      type: "BLOCK_CHOOSE" as const,
      playerId: "A2",
      targetId: "B2",
      result: "PUSH_BACK" as const,
    };

    currentState = applyMove(currentState, blockChooseMove, rng);

    // Vérifier que A2 a encore des PM après le blocage
    const a2AfterBlock = currentState.players.find((p) => p.id === "A2");
    expect(a2AfterBlock.pm).toBeGreaterThan(0);

    // Vérifier que A2 peut continuer à bouger
    const movesAfterBlitz = getLegalMoves(currentState);
    const continueMoves = movesAfterBlitz.filter(
      (m) => m.type === "MOVE" && m.playerId === "A2",
    );

    console.log("A2 PM après blitz:", a2AfterBlock.pm);
    console.log("A2 action:", currentState.playerActions["A2"]);

    // Après un blitz avec PUSH_BACK, A2 devrait pouvoir continuer à bouger
    expect(continueMoves.length).toBeGreaterThan(0);
  });
});
