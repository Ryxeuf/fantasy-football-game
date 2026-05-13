import { describe, expect, it } from "vitest";

import type { GameState, Move } from "@bb/game-engine";

import {
  compactReplaySequence,
  isFillerMove,
} from "./compact-replay";

const fakeState = (turn: number): GameState =>
  ({ turn }) as unknown as GameState;

describe("isFillerMove — Lot 3.E.2", () => {
  it("retourne true pour les choix tactiques sans effet visuel", () => {
    expect(isFillerMove({ type: "BLOCK_CHOOSE" } as Move)).toBe(true);
    expect(isFillerMove({ type: "PUSH_CHOOSE" } as Move)).toBe(true);
    expect(isFillerMove({ type: "FOLLOW_UP_CHOOSE" } as Move)).toBe(true);
    expect(isFillerMove({ type: "REROLL_CHOOSE" } as Move)).toBe(true);
    expect(isFillerMove({ type: "APOTHECARY_CHOOSE" } as Move)).toBe(true);
    expect(isFillerMove({ type: "DUMP_OFF_CHOOSE" } as Move)).toBe(true);
  });

  it("retourne false pour les moves visuellement impactants", () => {
    expect(isFillerMove({ type: "MOVE" } as Move)).toBe(false);
    expect(isFillerMove({ type: "BLOCK" } as Move)).toBe(false);
    expect(isFillerMove({ type: "BLITZ" } as Move)).toBe(false);
    expect(isFillerMove({ type: "PASS" } as Move)).toBe(false);
    expect(isFillerMove({ type: "DODGE" } as Move)).toBe(false);
    expect(isFillerMove({ type: "END_TURN" } as Move)).toBe(false);
  });

  it("retourne false pour null/undefined", () => {
    expect(isFillerMove(null)).toBe(false);
    expect(isFillerMove(undefined)).toBe(false);
  });
});

describe("compactReplaySequence — Lot 3.E.2", () => {
  it("séquence vide → résultat vide", () => {
    const out = compactReplaySequence({ moves: [], states: [] });
    expect(out.moves).toEqual([]);
    expect(out.states).toEqual([]);
    expect(out.originalIndices).toEqual([]);
  });

  it("séquence sans filler → identique", () => {
    const moves: Move[] = [
      { type: "MOVE" } as Move,
      { type: "BLOCK" } as Move,
      { type: "END_TURN" } as Move,
    ];
    const states = [fakeState(1), fakeState(2), fakeState(3)];
    const out = compactReplaySequence({ moves, states });
    expect(out.moves).toEqual(moves);
    expect(out.states).toEqual(states);
    expect(out.originalIndices).toEqual([0, 1, 2]);
  });

  it("retire les filler et garde les indices originaux", () => {
    const moves: Move[] = [
      { type: "MOVE" } as Move, // 0 — kept
      { type: "BLOCK" } as Move, // 1 — kept
      { type: "BLOCK_CHOOSE" } as Move, // 2 — filler
      { type: "PUSH_CHOOSE" } as Move, // 3 — filler
      { type: "FOLLOW_UP_CHOOSE" } as Move, // 4 — filler
      { type: "PASS" } as Move, // 5 — kept
      { type: "REROLL_CHOOSE" } as Move, // 6 — filler
      { type: "END_TURN" } as Move, // 7 — kept
    ];
    const states = moves.map((_, i) => fakeState(i));
    const out = compactReplaySequence({ moves, states });
    expect(out.moves.map((m) => m.type)).toEqual([
      "MOVE",
      "BLOCK",
      "PASS",
      "END_TURN",
    ]);
    expect(out.originalIndices).toEqual([0, 1, 5, 7]);
    // states gardés sont ceux post-action non-filler (donc incluent les
    // effets des filler précédents)
    expect(out.states).toEqual([
      fakeState(0),
      fakeState(1),
      fakeState(5),
      fakeState(7),
    ]);
  });

  it("séquence 100% filler → résultat vide", () => {
    const moves: Move[] = [
      { type: "BLOCK_CHOOSE" } as Move,
      { type: "PUSH_CHOOSE" } as Move,
    ];
    const states = [fakeState(0), fakeState(1)];
    const out = compactReplaySequence({ moves, states });
    expect(out.moves).toEqual([]);
    expect(out.states).toEqual([]);
    expect(out.originalIndices).toEqual([]);
  });
});
