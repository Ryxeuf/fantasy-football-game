import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleInducementSubmission } from "./inducement-handler";
import type { ExtendedGameState } from "./game-state";

// Minimal mock state in inducements phase
function createMockState(overrides: Partial<ExtendedGameState> = {}): ExtendedGameState {
  return {
    width: 26,
    height: 15,
    players: [],
    currentPlayer: "A",
    selectedPlayerId: null,
    half: 0,
    turn: 0,
    score: { teamA: 0, teamB: 0 },
    gamePhase: "pre-match",
    ball: null,
    gameLog: [],
    playerActions: {},
    teamBlitzCount: {},
    teamFoulCount: {},
    teamRerolls: { teamA: 3, teamB: 3 },
    maxTeamRerolls: { teamA: 3, teamB: 3 },
    teamNames: { teamA: "Skaven", teamB: "Lizardmen" },
    dugouts: { teamA: { reserves: [], ko: [], casualties: [], dead: [], expelled: [] }, teamB: { reserves: [], ko: [], casualties: [], dead: [], expelled: [] } },
    matchStats: {},
    apothecaryAvailable: { teamA: true, teamB: false },
    preMatch: {
      phase: "inducements",
      currentCoach: "A",
      legalSetupPositions: [],
      placedPlayers: [],
      kickingTeam: "A",
      receivingTeam: "B",
      fanFactor: {
        teamA: { d3: 2, dedicatedFans: 3, total: 5 },
        teamB: { d3: 1, dedicatedFans: 2, total: 3 },
      },
      weather: { total: 7, condition: "Nice", description: "Perfect weather" },
      journeymen: {
        teamA: { count: 0, players: [] },
        teamB: { count: 0, players: [] },
      },
    },
    ...overrides,
  } as ExtendedGameState;
}

describe("handleInducementSubmission", () => {
  it("processes valid empty selection (skip)", () => {
    const state = createMockState();
    const result = handleInducementSubmission(state, {
      teamId: "A",
      selection: { items: [] },
      pettyCashInput: {
        ctvTeamA: 1_000_000,
        ctvTeamB: 1_000_000,
        treasuryTeamA: 0,
        treasuryTeamB: 0,
      },
      otherTeamSelection: { items: [] },
      ctxA: { teamId: "A", regionalRules: [], hasApothecary: true, rosterSlug: "skaven" },
      ctxB: { teamId: "B", regionalRules: [], hasApothecary: false, rosterSlug: "lizardmen" },
    });

    expect(result.success).toBe(true);
    expect(result.state!.preMatch.phase).toBe("prayers");
    expect(result.state!.preMatch.inducements).toBeDefined();
  });

  it("processes valid selection with items", () => {
    const state = createMockState();
    const result = handleInducementSubmission(state, {
      teamId: "A",
      selection: {
        items: [{ slug: "extra_team_training", quantity: 1 }],
      },
      pettyCashInput: {
        ctvTeamA: 900_000,
        ctvTeamB: 1_100_000,
        treasuryTeamA: 50_000,
        treasuryTeamB: 0,
      },
      otherTeamSelection: { items: [] },
      ctxA: { teamId: "A", regionalRules: [], hasApothecary: true, rosterSlug: "skaven" },
      ctxB: { teamId: "B", regionalRules: [], hasApothecary: false, rosterSlug: "lizardmen" },
    });

    expect(result.success).toBe(true);
    expect(result.state!.preMatch.phase).toBe("prayers");
    expect(result.state!.preMatch.inducements!.teamA.items.length).toBe(1);
    expect(result.state!.preMatch.inducements!.teamA.items[0].slug).toBe("extra_team_training");
    // Extra team training adds rerolls
    expect(result.state!.teamRerolls.teamA).toBe(4); // 3 + 1
  });

  it("rejects when phase is not inducements", () => {
    const state = createMockState();
    state.preMatch.phase = "setup";
    const result = handleInducementSubmission(state, {
      teamId: "A",
      selection: { items: [] },
      pettyCashInput: {
        ctvTeamA: 1_000_000,
        ctvTeamB: 1_000_000,
        treasuryTeamA: 0,
        treasuryTeamB: 0,
      },
      otherTeamSelection: { items: [] },
      ctxA: { teamId: "A", regionalRules: [], hasApothecary: true, rosterSlug: "skaven" },
      ctxB: { teamId: "B", regionalRules: [], hasApothecary: false, rosterSlug: "lizardmen" },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects when budget is exceeded", () => {
    const state = createMockState();
    const result = handleInducementSubmission(state, {
      teamId: "A",
      selection: {
        items: [
          { slug: "extra_team_training", quantity: 4 }, // 400K
          { slug: "wizard", quantity: 1 }, // 150K
        ],
      },
      pettyCashInput: {
        ctvTeamA: 1_000_000,
        ctvTeamB: 1_000_000, // No petty cash difference
        treasuryTeamA: 100_000, // Only 100K treasury
        treasuryTeamB: 0,
      },
      otherTeamSelection: { items: [] },
      ctxA: { teamId: "A", regionalRules: [], hasApothecary: true, rosterSlug: "skaven" },
      ctxB: { teamId: "B", regionalRules: [], hasApothecary: false, rosterSlug: "lizardmen" },
    });

    expect(result.success).toBe(false);
    expect(result.errors!.length).toBeGreaterThan(0);
  });
});
