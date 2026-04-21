import { describe, it, expect } from "vitest";
import {
  shouldShowBlockPopup,
  shouldShowPushPopup,
  shouldShowFollowUpPopup,
  shouldShowRerollPopup,
  buildBlockChooseMove,
  buildPushChooseMove,
  buildFollowUpChooseMove,
  buildRerollChooseMove,
  computeBlockTargets,
  describeDirection,
  rollTypeLabel,
} from "./block-popups";
import type { GameState, Position, Move, BlockResult } from "@bb/game-engine";

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
    dugouts: {
      teamA: { reserves: [], knocked: [], injured: [], dead: [] },
      teamB: { reserves: [], knocked: [], injured: [], dead: [] },
    },
    gameLog: [],
    teamRerolls: { teamA: 3, teamB: 3 },
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
    expect(shouldShowBlockPopup(makeState())).toBe(false);
  });
});

describe("shouldShowPushPopup", () => {
  it("returns true when pendingPushChoice exists", () => {
    const state = makeState({
      pendingPushChoice: {
        attackerId: "a1",
        targetId: "b1",
        availableDirections: [{ x: 1, y: 0 }],
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
    expect(shouldShowPushPopup(makeState())).toBe(false);
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
    expect(shouldShowFollowUpPopup(makeState())).toBe(false);
  });
});

describe("shouldShowRerollPopup", () => {
  it("returns true when pendingReroll exists", () => {
    const state = makeState({
      pendingReroll: {
        rollType: "dodge",
        playerId: "a1",
        team: "A",
        targetNumber: 3,
        modifiers: 0,
        playerIndex: 0,
        from: { x: 5, y: 5 },
        to: { x: 6, y: 5 },
      },
    });
    expect(shouldShowRerollPopup(state)).toBe(true);
  });

  it("returns false when no pendingReroll", () => {
    expect(shouldShowRerollPopup(makeState())).toBe(false);
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
    expect(buildBlockChooseMove(pending, "POW")).toEqual({
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
    expect(buildPushChooseMove(pending, { x: 1, y: 0 })).toEqual({
      type: "PUSH_CHOOSE",
      playerId: "a1",
      targetId: "b1",
      direction: { x: 1, y: 0 },
    });
  });
});

describe("buildFollowUpChooseMove", () => {
  it("builds FOLLOW_UP_CHOOSE with followUp=true", () => {
    const pending = {
      attackerId: "a1",
      targetId: "b1",
      targetNewPosition: { x: 11, y: 8 },
      targetOldPosition: { x: 10, y: 8 },
    };
    expect(buildFollowUpChooseMove(pending, true)).toEqual({
      type: "FOLLOW_UP_CHOOSE",
      playerId: "a1",
      targetId: "b1",
      followUp: true,
    });
  });

  it("builds FOLLOW_UP_CHOOSE with followUp=false", () => {
    const pending = {
      attackerId: "a1",
      targetId: "b1",
      targetNewPosition: { x: 11, y: 8 },
      targetOldPosition: { x: 10, y: 8 },
    };
    expect(buildFollowUpChooseMove(pending, false)).toEqual({
      type: "FOLLOW_UP_CHOOSE",
      playerId: "a1",
      targetId: "b1",
      followUp: false,
    });
  });
});

describe("buildRerollChooseMove", () => {
  it("builds REROLL_CHOOSE useReroll=true", () => {
    expect(buildRerollChooseMove(true)).toEqual({
      type: "REROLL_CHOOSE",
      useReroll: true,
    });
  });

  it("builds REROLL_CHOOSE useReroll=false", () => {
    expect(buildRerollChooseMove(false)).toEqual({
      type: "REROLL_CHOOSE",
      useReroll: false,
    });
  });
});

describe("computeBlockTargets", () => {
  it("extracts target positions from BLOCK legal moves for a selected player", () => {
    const players = [
      {
        id: "a1",
        team: "A" as const,
        pos: { x: 10, y: 7 },
        name: "Attacker",
        ma: 6,
        st: 3,
        ag: 3,
        av: 8,
        pm: 6,
        skills: [],
        status: "active" as const,
      },
      {
        id: "b1",
        team: "B" as const,
        pos: { x: 10, y: 8 },
        name: "Defender",
        ma: 6,
        st: 3,
        ag: 3,
        av: 8,
        pm: 6,
        skills: [],
        status: "active" as const,
      },
      {
        id: "b2",
        team: "B" as const,
        pos: { x: 11, y: 7 },
        name: "Defender2",
        ma: 6,
        st: 3,
        ag: 3,
        av: 8,
        pm: 6,
        skills: [],
        status: "active" as const,
      },
    ];
    const legalMoves = [
      { type: "BLOCK", playerId: "a1", targetId: "b1" },
      { type: "BLOCK", playerId: "a1", targetId: "b2" },
      { type: "MOVE", playerId: "a1", to: { x: 9, y: 7 } },
    ] as Move[];

    expect(computeBlockTargets("a1", legalMoves, players as any)).toEqual([
      { x: 10, y: 8 },
      { x: 11, y: 7 },
    ]);
  });

  it("returns empty array when no player is selected", () => {
    expect(computeBlockTargets(null, [], [])).toEqual([]);
  });
});

describe("describeDirection", () => {
  it("returns compass label and arrow for cardinal directions", () => {
    expect(describeDirection({ x: 0, y: -1 })).toEqual({
      label: "Nord",
      arrow: "↑",
    });
    expect(describeDirection({ x: 0, y: 1 })).toEqual({
      label: "Sud",
      arrow: "↓",
    });
    expect(describeDirection({ x: -1, y: 0 })).toEqual({
      label: "Ouest",
      arrow: "←",
    });
    expect(describeDirection({ x: 1, y: 0 })).toEqual({
      label: "Est",
      arrow: "→",
    });
  });

  it("returns compass label for diagonal directions", () => {
    expect(describeDirection({ x: -1, y: -1 })).toEqual({
      label: "Nord-Ouest",
      arrow: "↖",
    });
    expect(describeDirection({ x: 1, y: -1 })).toEqual({
      label: "Nord-Est",
      arrow: "↗",
    });
    expect(describeDirection({ x: -1, y: 1 })).toEqual({
      label: "Sud-Ouest",
      arrow: "↙",
    });
    expect(describeDirection({ x: 1, y: 1 })).toEqual({
      label: "Sud-Est",
      arrow: "↘",
    });
  });

  it("falls back to coordinate string for unknown directions", () => {
    expect(describeDirection({ x: 2, y: 3 })).toEqual({
      label: "(2, 3)",
      arrow: "?",
    });
  });
});

describe("rollTypeLabel", () => {
  it("returns French label for known roll types", () => {
    expect(rollTypeLabel("dodge")).toBe("Esquive");
    expect(rollTypeLabel("pickup")).toBe("Ramassage");
    expect(rollTypeLabel("gfi")).toBe("Going For It");
  });

  it("returns raw value for unknown roll types", () => {
    expect(rollTypeLabel("unknown")).toBe("unknown");
  });
});
