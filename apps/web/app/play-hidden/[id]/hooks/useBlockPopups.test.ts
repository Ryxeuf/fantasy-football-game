import { describe, it, expect } from "vitest";
import {
  shouldShowBlockPopup,
  shouldShowPushPopup,
  shouldShowFollowUpPopup,
  buildBlockChooseMove,
  buildPushChooseMove,
  buildFollowUpChooseMove,
  computeBlockTargets,
} from "./useBlockPopups";
import type { GameState, Position, Move, BlockResult } from "@bb/game-engine";

// Minimal GameState factory for testing
function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    width: 26,
    height: 15,
    players: [],
    ball: undefined,
    currentPlayer: "A",
    turn: 1,
    half: 1,
    selectedPlayerId: null,
    isTurnover: false,
    playerActions: {},
    teamBlitzCount: {},
    teamFoulCount: {},
    matchStats: {},
    gamePhase: "playing" as const,
    score: { teamA: 0, teamB: 0 },
    dugouts: { teamA: { reserves: [], knocked: [], injured: [], dead: [] }, teamB: { reserves: [], knocked: [], injured: [], dead: [] } },
    gameLog: [],
    rerollsLeft: { teamA: 3, teamB: 3 },
    rerollUsedThisTurn: false,
    teamNames: { teamA: "Team A", teamB: "Team B" },
    ...overrides,
  } as GameState;
}

describe("shouldShowBlockPopup", () => {
  it("returns true when pendingBlock exists", () => {
    const state = makeState({
      pendingBlock: {
        attackerId: "a1",
        targetId: "b1",
        options: ["POW", "STUMBLE"] as BlockResult[],
        chooser: "attacker",
        offensiveAssists: 0,
        defensiveAssists: 0,
        totalStrength: 4,
        targetStrength: 3,
      },
    });
    expect(shouldShowBlockPopup(state)).toBe(true);
  });

  it("returns false when no pendingBlock", () => {
    const state = makeState();
    expect(shouldShowBlockPopup(state)).toBe(false);
  });
});

describe("shouldShowPushPopup", () => {
  it("returns true when pendingPushChoice exists", () => {
    const state = makeState({
      pendingPushChoice: {
        attackerId: "a1",
        targetId: "b1",
        availableDirections: [{ x: 1, y: 0 }, { x: 0, y: 1 }],
        blockResult: "POW" as BlockResult,
        offensiveAssists: 0,
        defensiveAssists: 0,
        totalStrength: 4,
        targetStrength: 3,
      },
    });
    expect(shouldShowPushPopup(state)).toBe(true);
  });

  it("returns false when no pendingPushChoice", () => {
    const state = makeState();
    expect(shouldShowPushPopup(state)).toBe(false);
  });
});

describe("shouldShowFollowUpPopup", () => {
  it("returns true when pendingFollowUpChoice exists", () => {
    const state = makeState({
      pendingFollowUpChoice: {
        attackerId: "a1",
        targetId: "b1",
        targetNewPosition: { x: 11, y: 8 },
        targetOldPosition: { x: 10, y: 8 },
      },
    });
    expect(shouldShowFollowUpPopup(state)).toBe(true);
  });

  it("returns false when no pendingFollowUpChoice", () => {
    const state = makeState();
    expect(shouldShowFollowUpPopup(state)).toBe(false);
  });
});

describe("buildBlockChooseMove", () => {
  it("builds a BLOCK_CHOOSE move from pendingBlock and chosen result", () => {
    const pending = {
      attackerId: "a1",
      targetId: "b1",
      options: ["POW", "STUMBLE"] as BlockResult[],
      chooser: "attacker" as const,
      offensiveAssists: 0,
      defensiveAssists: 0,
      totalStrength: 4,
      targetStrength: 3,
    };
    const move = buildBlockChooseMove(pending, "POW");
    expect(move).toEqual({
      type: "BLOCK_CHOOSE",
      playerId: "a1",
      targetId: "b1",
      result: "POW",
    });
  });
});

describe("buildPushChooseMove", () => {
  it("builds a PUSH_CHOOSE move from pendingPushChoice and direction", () => {
    const pending = {
      attackerId: "a1",
      targetId: "b1",
      availableDirections: [{ x: 1, y: 0 }] as Position[],
      blockResult: "POW" as BlockResult,
      offensiveAssists: 0,
      defensiveAssists: 0,
      totalStrength: 4,
      targetStrength: 3,
    };
    const move = buildPushChooseMove(pending, { x: 1, y: 0 });
    expect(move).toEqual({
      type: "PUSH_CHOOSE",
      playerId: "a1",
      targetId: "b1",
      direction: { x: 1, y: 0 },
    });
  });
});

describe("buildFollowUpChooseMove", () => {
  it("builds a FOLLOW_UP_CHOOSE move with followUp=true", () => {
    const pending = {
      attackerId: "a1",
      targetId: "b1",
      targetNewPosition: { x: 11, y: 8 },
      targetOldPosition: { x: 10, y: 8 },
    };
    const move = buildFollowUpChooseMove(pending, true);
    expect(move).toEqual({
      type: "FOLLOW_UP_CHOOSE",
      playerId: "a1",
      targetId: "b1",
      followUp: true,
    });
  });

  it("builds a FOLLOW_UP_CHOOSE move with followUp=false", () => {
    const pending = {
      attackerId: "a1",
      targetId: "b1",
      targetNewPosition: { x: 11, y: 8 },
      targetOldPosition: { x: 10, y: 8 },
    };
    const move = buildFollowUpChooseMove(pending, false);
    expect(move).toEqual({
      type: "FOLLOW_UP_CHOOSE",
      playerId: "a1",
      targetId: "b1",
      followUp: false,
    });
  });
});

describe("computeBlockTargets", () => {
  it("extracts target positions from BLOCK legal moves for a selected player", () => {
    const players = [
      { id: "a1", team: "A" as const, pos: { x: 10, y: 7 }, name: "Attacker", ma: 6, st: 3, ag: 3, av: 8, pm: 6, skills: [], status: "active" as const },
      { id: "b1", team: "B" as const, pos: { x: 10, y: 8 }, name: "Defender", ma: 6, st: 3, ag: 3, av: 8, pm: 6, skills: [], status: "active" as const },
      { id: "b2", team: "B" as const, pos: { x: 11, y: 7 }, name: "Defender2", ma: 6, st: 3, ag: 3, av: 8, pm: 6, skills: [], status: "active" as const },
    ];
    const legalMoves = [
      { type: "BLOCK", playerId: "a1", targetId: "b1" },
      { type: "BLOCK", playerId: "a1", targetId: "b2" },
      { type: "MOVE", playerId: "a1", to: { x: 9, y: 7 } },
    ] as Move[];

    const targets = computeBlockTargets("a1", legalMoves, players as any);
    expect(targets).toEqual([
      { x: 10, y: 8 },
      { x: 11, y: 7 },
    ]);
  });

  it("returns empty array when no player is selected", () => {
    const targets = computeBlockTargets(null, [], []);
    expect(targets).toEqual([]);
  });

  it("returns empty array when no BLOCK moves exist", () => {
    const legalMoves = [
      { type: "MOVE", playerId: "a1", to: { x: 9, y: 7 } },
    ] as Move[];
    const targets = computeBlockTargets("a1", legalMoves, []);
    expect(targets).toEqual([]);
  });
});
