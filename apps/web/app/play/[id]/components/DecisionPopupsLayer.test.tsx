import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { DecisionPopupsLayer } from "./DecisionPopupsLayer";
import type { ExtendedGameState, Move, Player } from "@bb/game-engine";

function makePlayer(id: string, name: string, team: "A" | "B" = "A"): Player {
  return {
    id,
    name,
    team,
    pos: { x: 0, y: 0 },
    stats: { ma: 6, st: 3, ag: 3, av: 8 },
    state: "standing",
    skills: [],
    hasMovedThisTurn: false,
    actionsRemainingThisTurn: 0,
  } as unknown as Player;
}

function baseState(overrides: Partial<ExtendedGameState> = {}): ExtendedGameState {
  return {
    half: 1,
    turn: 1,
    teamTurn: "A",
    teamRerolls: { teamA: 2, teamB: 1 },
    teamNames: { teamA: "Reds", teamB: "Blues" },
    players: [],
    ball: { carrierId: null, pos: { x: 0, y: 0 } },
    score: { teamA: 0, teamB: 0 },
    selectedPlayerId: null,
    legalMoves: [],
    pendingBlock: undefined,
    pendingPushChoice: undefined,
    pendingFollowUpChoice: undefined,
    pendingReroll: undefined,
    pendingApothecary: undefined,
    ...overrides,
  } as unknown as ExtendedGameState;
}

describe("DecisionPopupsLayer", () => {
  it("ne rend rien quand aucun choix pendant", () => {
    const onSubmitMove = vi.fn<(move: Move, opts?: { showDiceOnResult?: boolean }) => void>();
    const { container } = render(
      <DecisionPopupsLayer
        state={baseState()}
        isMyTurn
        myTeamSide="A"
        onSubmitMove={onSubmitMove}
      />,
    );
    expect(container.textContent).toBe("");
    expect(onSubmitMove).not.toHaveBeenCalled();
  });

  it("rend BlockChoicePopup et delegue le choix au callback avec showDiceOnResult", () => {
    const onSubmitMove = vi.fn<(move: Move, opts?: { showDiceOnResult?: boolean }) => void>();
    const state = baseState({
      players: [
        makePlayer("att", "Attaquant Z"),
        makePlayer("def", "Defenseur Y", "B"),
      ],
      pendingBlock: {
        attackerId: "att",
        targetId: "def",
        chooser: "attacker",
        options: ["pushed"],
      } as unknown as ExtendedGameState["pendingBlock"],
    });
    render(
      <DecisionPopupsLayer
        state={state}
        isMyTurn
        myTeamSide="A"
        onSubmitMove={onSubmitMove}
      />,
    );
    expect(screen.getByText(/Attaquant Z/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onSubmitMove).toHaveBeenCalledTimes(1);
    const [move, opts] = onSubmitMove.mock.calls[0];
    expect(move.type).toBe("BLOCK_CHOOSE");
    expect(opts).toEqual({ showDiceOnResult: true });
  });

  it("ne rend pas RerollChoicePopup quand isMyTurn=false", () => {
    const onSubmitMove = vi.fn();
    const state = baseState({
      players: [makePlayer("p1", "Joueur X")],
      pendingReroll: {
        playerId: "p1",
        rollType: "gfi",
      } as unknown as ExtendedGameState["pendingReroll"],
    });
    const { container } = render(
      <DecisionPopupsLayer
        state={state}
        isMyTurn={false}
        myTeamSide="A"
        onSubmitMove={onSubmitMove}
      />,
    );
    expect(container.textContent).toBe("");
  });

  it("rend RerollChoicePopup et delegue le choix avec showDiceOnResult", () => {
    const onSubmitMove = vi.fn<(move: Move, opts?: { showDiceOnResult?: boolean }) => void>();
    const state = baseState({
      players: [makePlayer("p1", "Joueur Reroll")],
      pendingReroll: {
        playerId: "p1",
        rollType: "gfi",
      } as unknown as ExtendedGameState["pendingReroll"],
    });
    render(
      <DecisionPopupsLayer
        state={state}
        isMyTurn
        myTeamSide="A"
        onSubmitMove={onSubmitMove}
      />,
    );
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(onSubmitMove).toHaveBeenCalledTimes(1);
    const [move, opts] = onSubmitMove.mock.calls[0];
    expect(move.type).toBe("REROLL_CHOOSE");
    expect(opts).toEqual({ showDiceOnResult: true });
  });

  it("rend ApothecaryChoicePopup et delegue sans option dice", () => {
    const onSubmitMove = vi.fn<(move: Move, opts?: { showDiceOnResult?: boolean }) => void>();
    const state = baseState({
      players: [makePlayer("p1", "Joueur Apo")],
      pendingApothecary: {
        playerId: "p1",
        injuryType: "casualty",
        originalCasualtyOutcome: "badly_hurt",
      } as unknown as ExtendedGameState["pendingApothecary"],
    });
    render(
      <DecisionPopupsLayer
        state={state}
        isMyTurn
        myTeamSide="A"
        onSubmitMove={onSubmitMove}
      />,
    );
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(onSubmitMove).toHaveBeenCalledTimes(1);
    const [move, opts] = onSubmitMove.mock.calls[0];
    expect(move.type).toBe("APOTHECARY_CHOOSE");
    expect(opts).toBeUndefined();
  });
});
