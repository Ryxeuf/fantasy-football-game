import { describe, it, expect } from "vitest";
import { deriveIsMyTurn } from "./deriveSetupTurn";
import type { ExtendedGameState } from "@bb/game-engine";

/** Shared base fields for test state objects */
function baseState() {
  return {
    width: 26,
    height: 15,
    players: [] as any[],
    ball: undefined,
    gameLog: [] as any[],
    teamNames: { teamA: "Alpha", teamB: "Beta" },
    isTurnover: false,
    selectedPlayerId: null,
    playerActions: {} as Record<string, string>,
    teamBlitzCount: {} as Record<string, number>,
    teamFoulCount: {} as Record<string, number>,
    matchStats: {} as Record<string, any>,
    casualtyResults: {} as Record<string, any>,
    lastingInjuryDetails: {} as Record<string, any>,
    usedStarPlayerRules: {} as Record<string, any>,
    apothecaryAvailable: { teamA: false, teamB: false },
    teamRerolls: { teamA: 3, teamB: 3 },
    rerollUsedThisTurn: false,
    dugouts: {
      teamA: { zones: { reserves: { players: [] as string[] }, knockedOut: { players: [] as string[] }, casualties: { players: [] as string[] }, dead: { players: [] as string[] }, expelled: { players: [] as string[] } } },
      teamB: { zones: { reserves: { players: [] as string[] }, knockedOut: { players: [] as string[] }, casualties: { players: [] as string[] }, dead: { players: [] as string[] }, expelled: { players: [] as string[] } } },
    },
  };
}

function makeSetupState(
  currentCoach: "A" | "B",
  phase: string = "setup",
): ExtendedGameState {
  return {
    ...baseState(),
    score: { teamA: 0, teamB: 0 },
    currentPlayer: "A",
    gamePhase: "pre-match",
    half: 0,
    turn: 0,
    preMatch: {
      phase,
      currentCoach,
      legalSetupPositions: [],
      placedPlayers: [],
      kickingTeam: "B",
      receivingTeam: "A",
    },
  } as unknown as ExtendedGameState;
}

function makePlayingState(currentPlayer: "A" | "B"): ExtendedGameState {
  return {
    ...baseState(),
    score: { teamA: 0, teamB: 0 },
    currentPlayer,
    gamePhase: "playing",
    half: 1,
    turn: 1,
    preMatch: {
      phase: "idle",
      currentCoach: "A",
      legalSetupPositions: [],
      placedPlayers: [],
      kickingTeam: "B",
      receivingTeam: "A",
    },
  } as unknown as ExtendedGameState;
}

describe("deriveIsMyTurn", () => {
  describe("en phase setup", () => {
    it("retourne true si currentCoach === myTeamSide", () => {
      const state = makeSetupState("A");
      expect(deriveIsMyTurn(state, "A")).toBe(true);
    });

    it("retourne false si currentCoach !== myTeamSide", () => {
      const state = makeSetupState("A");
      expect(deriveIsMyTurn(state, "B")).toBe(false);
    });

    it("bascule correctement quand currentCoach change (simule WebSocket update)", () => {
      // Simulates receiving team A placing, then switching to team B
      const stateTeamAPlacing = makeSetupState("A");
      expect(deriveIsMyTurn(stateTeamAPlacing, "B")).toBe(false);

      // After team A validates, currentCoach switches to B
      const stateTeamBPlacing = makeSetupState("B");
      expect(deriveIsMyTurn(stateTeamBPlacing, "B")).toBe(true);
    });
  });

  describe("en phase kickoff-sequence", () => {
    it("retourne true pour l'équipe frappeuse (qui place le ballon)", () => {
      const state = makeSetupState("B", "kickoff-sequence");
      // Kicking team B should place the ball
      expect(deriveIsMyTurn(state, "B")).toBe(true);
    });
  });

  describe("en phase playing", () => {
    it("retourne true si currentPlayer === myTeamSide", () => {
      const state = makePlayingState("A");
      expect(deriveIsMyTurn(state, "A")).toBe(true);
    });

    it("retourne false si currentPlayer !== myTeamSide", () => {
      const state = makePlayingState("A");
      expect(deriveIsMyTurn(state, "B")).toBe(false);
    });
  });

  describe("avec myTeamSide null", () => {
    it("retourne false si myTeamSide est null", () => {
      const state = makeSetupState("A");
      expect(deriveIsMyTurn(state, null)).toBe(false);
    });
  });
});
