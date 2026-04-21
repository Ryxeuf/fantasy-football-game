import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HalftimeTransition from "./HalftimeTransition";
import type { ExtendedGameState } from "@bb/game-engine";

function makeState(overrides: Partial<ExtendedGameState> = {}): ExtendedGameState {
  return {
    width: 26,
    height: 15,
    players: [],
    ball: undefined,
    currentPlayer: "A",
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
    dugouts: {} as any,
    playerActions: {} as any,
    teamBlitzCount: {} as any,
    teamFoulCount: {} as any,
    half: 2,
    score: { teamA: 1, teamB: 0 },
    teamNames: { teamA: "Skaven", teamB: "Humans" },
    gameLog: [],
    matchStats: {} as any,
    gamePhase: "halftime",
    kickingTeam: "B",
    preMatch: {
      phase: "setup",
      currentCoach: "A",
      legalSetupPositions: [],
      placedPlayers: [],
      kickingTeam: "B",
      receivingTeam: "A",
    },
    ...overrides,
  } as unknown as ExtendedGameState;
}

describe("HalftimeTransition", () => {
  it("renders the halftime title and score", () => {
    render(
      <HalftimeTransition state={makeState()} onAcknowledge={() => {}} />,
    );
    expect(screen.getByText("Mi-temps")).toBeTruthy();
    // Team names appear at least twice (score + kick/receive lines) → getAllByText
    expect(screen.getAllByText(/Skaven/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Humans/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("shows the receiving team plays first and kicking team info", () => {
    // kickingTeam=B → receiving=teamA (Skaven)
    render(
      <HalftimeTransition state={makeState()} onAcknowledge={() => {}} />,
    );
    expect(screen.getByText(/frappe au pied/)).toBeTruthy();
    expect(screen.getByText(/reçoit et joue en premier/)).toBeTruthy();
  });

  it("displays the last KO recovery log if present", () => {
    const state = makeState({
      gameLog: [
        { id: "l1", timestamp: 1, type: "info", message: "Mi-temps atteinte" },
        {
          id: "l2",
          timestamp: 2,
          type: "info",
          message: "2 joueur(s) de l'équipe A récupèrent du KO",
        },
      ] as any,
    });
    render(<HalftimeTransition state={state} onAcknowledge={() => {}} />);
    expect(screen.getByTestId("halftime-ko-summary").textContent).toContain(
      "2 joueur(s) de l'équipe A récupèrent du KO",
    );
  });

  it("hides the KO summary when no recovery log exists", () => {
    render(
      <HalftimeTransition state={makeState()} onAcknowledge={() => {}} />,
    );
    expect(screen.queryByTestId("halftime-ko-summary")).toBeNull();
  });

  it("calls onAcknowledge when the CTA is clicked", () => {
    const onAcknowledge = vi.fn();
    render(
      <HalftimeTransition
        state={makeState()}
        onAcknowledge={onAcknowledge}
      />,
    );
    fireEvent.click(screen.getByTestId("halftime-acknowledge"));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it("renders as an accessible modal dialog", () => {
    render(
      <HalftimeTransition state={makeState()} onAcknowledge={() => {}} />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("halftime-title");
  });
});
