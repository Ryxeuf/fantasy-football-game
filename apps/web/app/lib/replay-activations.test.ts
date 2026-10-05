import { describe, expect, it } from "vitest";

import type { Move } from "@bb/game-engine";

import {
  activationStarts,
  nextActivationIndex,
  previousActivationIndex,
} from "./replay-activations";

const moves: Move[] = [
  { type: "MOVE", playerId: "A1", to: { x: 1, y: 1 } }, // 0 — ouvre A1
  { type: "MOVE", playerId: "A1", to: { x: 2, y: 1 } }, // 1
  { type: "BLOCK", playerId: "A1", targetId: "B1" }, // 2
  { type: "BLOCK_CHOOSE", playerId: "A1", result: "PUSH_BACK" } as Move, // 3 — prolonge
  { type: "PUSH_CHOOSE", playerId: "A1", direction: { x: 1, y: 0 } } as Move, // 4
  { type: "END_PLAYER_TURN", playerId: "A1" } as Move, // 5
  { type: "STAND_UP", playerId: "A2" } as Move, // 6 — ouvre A2
  { type: "MOVE", playerId: "A2", to: { x: 5, y: 5 } }, // 7
  { type: "END_TURN" }, // 8 — segment sans joueur
  { type: "MOVE", playerId: "B1", to: { x: 9, y: 9 } }, // 9 — ouvre B1
];

describe("replay-activations (lot 2)", () => {
  it("détecte les débuts d'activation, choix compris dans l'activation", () => {
    expect(activationStarts(moves)).toEqual([0, 6, 8, 9]);
  });

  it("navigue vers l'activation suivante", () => {
    expect(nextActivationIndex(moves, -1)).toBe(0);
    expect(nextActivationIndex(moves, 0)).toBe(6);
    expect(nextActivationIndex(moves, 3)).toBe(6);
    expect(nextActivationIndex(moves, 8)).toBe(9);
    expect(nextActivationIndex(moves, 9)).toBe(9); // dernier coup
  });

  it("navigue vers l'activation précédente (début de la courante d'abord)", () => {
    expect(previousActivationIndex(moves, 7)).toBe(6);
    expect(previousActivationIndex(moves, 6)).toBe(0);
    expect(previousActivationIndex(moves, 0)).toBe(-1);
    expect(previousActivationIndex(moves, -1)).toBe(-1);
  });

  it("liste vide", () => {
    expect(activationStarts([])).toEqual([]);
    expect(nextActivationIndex([], -1)).toBe(-1);
  });
});
