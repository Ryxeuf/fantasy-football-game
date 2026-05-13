import { describe, expect, it } from "vitest";

import type { GameState, Move } from "@bb/game-engine";

import { getReplayAnnotations } from "./replay-annotations";

const mkState = (
  players: { id: string; team: "A" | "B"; x: number; y: number }[],
): GameState =>
  ({
    players: players.map((p) => ({
      id: p.id,
      team: p.team,
      pos: { x: p.x, y: p.y },
    })),
  }) as unknown as GameState;

describe("getReplayAnnotations — Lot 3.E.3", () => {
  it("retourne [] pour move null / état null", () => {
    expect(getReplayAnnotations(null, null, null)).toEqual([]);
    expect(getReplayAnnotations({ type: "END_TURN" } as Move, null, null)).toEqual(
      [],
    );
    const state = mkState([{ id: "p1", team: "A", x: 5, y: 7 }]);
    expect(
      getReplayAnnotations({ type: "END_TURN" } as Move, state, state),
    ).toEqual([]);
  });

  it("MOVE → annotation movement from→to avec team A", () => {
    const prev = mkState([{ id: "p1", team: "A", x: 5, y: 7 }]);
    const curr = mkState([{ id: "p1", team: "A", x: 6, y: 7 }]);
    const out = getReplayAnnotations(
      { type: "MOVE", playerId: "p1", to: { x: 6, y: 7 } } as Move,
      prev,
      curr,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      kind: "movement",
      from: { x: 5, y: 7 },
      to: { x: 6, y: 7 },
      team: "A",
      variant: "MOVE",
    });
  });

  it("DODGE → utilise move.from / move.to directement", () => {
    const prev = mkState([{ id: "p1", team: "B", x: 5, y: 7 }]);
    const out = getReplayAnnotations(
      {
        type: "DODGE",
        playerId: "p1",
        from: { x: 5, y: 7 },
        to: { x: 6, y: 8 },
      } as Move,
      prev,
      prev,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: "movement",
      variant: "DODGE",
      from: { x: 5, y: 7 },
      to: { x: 6, y: 8 },
      team: "B",
    });
  });

  it("BLITZ → annotation blitz from→to + targetPos", () => {
    const prev = mkState([
      { id: "atk", team: "A", x: 3, y: 3 },
      { id: "def", team: "B", x: 5, y: 4 },
    ]);
    const out = getReplayAnnotations(
      {
        type: "BLITZ",
        playerId: "atk",
        to: { x: 4, y: 4 },
        targetId: "def",
      } as Move,
      prev,
      prev,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      kind: "blitz",
      from: { x: 3, y: 3 },
      to: { x: 4, y: 4 },
      targetPos: { x: 5, y: 4 },
      team: "A",
    });
  });

  it("BLOCK → annotation block avec attackerPos + un targetPos", () => {
    const prev = mkState([
      { id: "atk", team: "A", x: 3, y: 3 },
      { id: "def", team: "B", x: 4, y: 3 },
    ]);
    const out = getReplayAnnotations(
      { type: "BLOCK", playerId: "atk", targetId: "def" } as Move,
      prev,
      prev,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      kind: "block",
      attackerPos: { x: 3, y: 3 },
      targetPositions: [{ x: 4, y: 3 }],
      team: "A",
      variant: "BLOCK",
    });
  });

  it("MULTI_BLOCK → annotation block avec deux targets", () => {
    const prev = mkState([
      { id: "atk", team: "A", x: 3, y: 3 },
      { id: "d1", team: "B", x: 4, y: 3 },
      { id: "d2", team: "B", x: 4, y: 2 },
    ]);
    const out = getReplayAnnotations(
      {
        type: "MULTI_BLOCK",
        playerId: "atk",
        firstTargetId: "d1",
        secondTargetId: "d2",
      } as Move,
      prev,
      prev,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: "block",
      variant: "MULTI_BLOCK",
      targetPositions: [
        { x: 4, y: 3 },
        { x: 4, y: 2 },
      ],
    });
  });

  it("PASS → annotation pass from→to", () => {
    const prev = mkState([
      { id: "thr", team: "A", x: 2, y: 7 },
      { id: "rcv", team: "A", x: 10, y: 7 },
    ]);
    const out = getReplayAnnotations(
      { type: "PASS", playerId: "thr", targetId: "rcv" } as Move,
      prev,
      prev,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      kind: "pass",
      from: { x: 2, y: 7 },
      to: { x: 10, y: 7 },
      team: "A",
      variant: "PASS",
    });
  });

  it("BOMB_THROW → pass vers move.target", () => {
    const prev = mkState([{ id: "bomb", team: "B", x: 1, y: 0 }]);
    const out = getReplayAnnotations(
      {
        type: "BOMB_THROW",
        playerId: "bomb",
        target: { x: 20, y: 7 },
      } as Move,
      prev,
      prev,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      kind: "pass",
      from: { x: 1, y: 0 },
      to: { x: 20, y: 7 },
      team: "B",
      variant: "BOMB_THROW",
    });
  });

  it("acteur introuvable → [] (état stale / réplique partielle)", () => {
    const prev = mkState([]);
    expect(
      getReplayAnnotations(
        { type: "MOVE", playerId: "ghost", to: { x: 1, y: 1 } } as Move,
        prev,
        prev,
      ),
    ).toEqual([]);
  });
});
