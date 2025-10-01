import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import GameScoreboard from "../../packages/ui/src/components/GameScoreboard";
import type { GameState } from "@bb/game-engine";

// Fabrique d'un état minimal pour le scoreboard
function makeState(partial: Partial<GameState>): GameState {
  return {
    width: 26,
    height: 15,
    players: [],
    ball: undefined,
    currentPlayer: "A",
    turn: 0,
    selectedPlayerId: null,
    isTurnover: false,
    dugouts: {
      teamA: { team: "A", zones: { reserves: { players: [] } } } as any,
      teamB: { team: "B", zones: { reserves: { players: [] } } } as any,
    },
    playerActions: new Map(),
    teamBlitzCount: new Map(),
    half: 1,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: "User-Skavens", teamB: "Admin-Lizardmen" },
    gameLog: [],
    ...partial,
  } as GameState;
}

describe("Affichage de l'équipe active (scoreboard)", () => {
  it("affiche le nom de l'équipe A quand currentPlayer === 'A'", () => {
    const state = makeState({ currentPlayer: "A" });
    render(<GameScoreboard state={state} onEndTurn={() => {}} />);
    expect(screen.getByText("User-Skavens")).toBeTruthy();
  });

  it("affiche le nom de l'équipe B quand currentPlayer === 'B'", () => {
    const state = makeState({ currentPlayer: "B" });
    render(<GameScoreboard state={state} onEndTurn={() => {}} />);
    expect(screen.getByText("Admin-Lizardmen")).toBeTruthy();
  });
});

// Composant de test minimal pour les libellés pré-match
function PreMatchLabels({ state }: { state: any }) {
  return (
    <div>
      <div data-testid="receveuse">
        {state.preMatch?.receivingTeam === "A"
          ? state.teamNames.teamA
          : state.teamNames.teamB}
      </div>
      <div data-testid="currentCoach">
        {state.preMatch?.currentCoach === "A"
          ? state.teamNames.teamA
          : state.teamNames.teamB}
      </div>
    </div>
  );
}

describe("Libellés pré-match (Receveuse / Au tour de)", () => {
  const base = makeState({ half: 0 });

  it("mappe correctement Receveuse quand 'A' reçoit", () => {
    const state = {
      ...base,
      preMatch: { receivingTeam: "A", currentCoach: "A" },
    } as any;
    render(<PreMatchLabels state={state} />);
    expect(screen.getByTestId("receveuse").textContent).toBe("User-Skavens");
  });

  it("mappe correctement Receveuse quand 'B' reçoit", () => {
    const state = {
      ...base,
      preMatch: { receivingTeam: "B", currentCoach: "B" },
    } as any;
    render(<PreMatchLabels state={state} />);
    expect(screen.getByTestId("receveuse").textContent).toBe("Admin-Lizardmen");
  });

  it("mappe correctement 'Au tour de' selon currentCoach", () => {
    const state = {
      ...base,
      preMatch: { receivingTeam: "B", currentCoach: "A" },
    } as any;
    render(<PreMatchLabels state={state} />);
    expect(screen.getByTestId("currentCoach").textContent).toBe("User-Skavens");
  });
});
