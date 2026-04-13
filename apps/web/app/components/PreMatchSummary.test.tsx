import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PreMatchSummary from "./PreMatchSummary";
import type { ExtendedGameState } from "@bb/game-engine";

function makeState(preMatchOverrides: Record<string, any> = {}): ExtendedGameState {
  return {
    width: 26,
    height: 15,
    players: [],
    ball: undefined as any,
    currentPlayer: "A",
    turn: 0,
    selectedPlayerId: null,
    isTurnover: false,
    dugouts: {} as any,
    playerActions: {} as any,
    teamBlitzCount: {} as any,
    teamFoulCount: {} as any,
    half: 0,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: "Skaven", teamB: "Humans" },
    gameLog: [],
    matchStats: {} as any,
    preMatch: {
      phase: "inducements",
      currentCoach: "A",
      legalSetupPositions: [],
      placedPlayers: [],
      kickingTeam: "A",
      receivingTeam: "B",
      ...preMatchOverrides,
    },
  } as unknown as ExtendedGameState;
}

describe("PreMatchSummary", () => {
  it("renders nothing when no pre-match data is available", () => {
    const state = makeState();
    const { container } = render(<PreMatchSummary state={state} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders fan factor info", () => {
    const state = makeState({
      fanFactor: {
        teamA: { d3: 2, dedicatedFans: 3, total: 5 },
        teamB: { d3: 1, dedicatedFans: 2, total: 3 },
      },
    });
    render(<PreMatchSummary state={state} />);
    expect(screen.getByText(/Fan Factor/)).toBeTruthy();
    expect(screen.getByText(/Skaven: 5/)).toBeTruthy();
    expect(screen.getByText(/Humans: 3/)).toBeTruthy();
  });

  it("renders weather info", () => {
    const state = makeState({
      fanFactor: { teamA: { d3: 1, dedicatedFans: 1, total: 2 }, teamB: { d3: 1, dedicatedFans: 1, total: 2 } },
      weather: { total: 7, condition: "Beau temps", description: "Conditions parfaites" },
    });
    render(<PreMatchSummary state={state} />);
    expect(screen.getByText(/Meteo/)).toBeTruthy();
    expect(screen.getByText(/Beau temps/)).toBeTruthy();
  });

  it("renders journeymen info", () => {
    const state = makeState({
      fanFactor: { teamA: { d3: 1, dedicatedFans: 1, total: 2 }, teamB: { d3: 1, dedicatedFans: 1, total: 2 } },
      journeymen: {
        teamA: { count: 2, players: ["JA1", "JA2"] },
        teamB: { count: 0, players: [] },
      },
    });
    render(<PreMatchSummary state={state} />);
    expect(screen.getByText(/Joueurs de passage/)).toBeTruthy();
    expect(screen.getByText(/Skaven: \+2/)).toBeTruthy();
  });
});
