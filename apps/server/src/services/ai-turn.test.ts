/**
 * N.4 — Tests du service orchestrateur des tours IA.
 */

import { describe, it, expect } from "vitest";
import { computeAIMove, isAITurnToAct } from "./ai-turn";
import type { GameState } from "@bb/game-engine";

function makeStubState(overrides: Partial<GameState> = {}): GameState {
  const base = {
    board: { width: 26, height: 15 },
    players: [],
    ballPosition: null,
    currentPlayer: "A",
    turn: 1,
    half: 1,
    score: { teamA: 0, teamB: 0 },
    playersActivatedThisTurn: [],
    teamAName: "Home",
    teamBName: "Away",
  } as unknown as GameState;
  return { ...base, ...overrides } as GameState;
}

describe("Service IA — computeAIMove (N.4)", () => {
  it("retourne isAITurn=false lorsque ce n'est pas le tour de l'IA", () => {
    const state = makeStubState({ currentPlayer: "A" });
    const result = computeAIMove({
      state,
      aiTeam: "B",
      difficulty: "medium",
    });
    expect(result.isAITurn).toBe(false);
    expect(result.move).toBeNull();
  });

  it("retourne isAITurn=true lorsque c'est le tour de l'IA", () => {
    const state = makeStubState({ currentPlayer: "B" });
    const result = computeAIMove({
      state,
      aiTeam: "B",
      difficulty: "medium",
      seed: "test-seed",
    });
    expect(result.isAITurn).toBe(true);
    // move peut etre null si aucun coup legal, mais isAITurn doit etre true.
  });

  it("isAITurnToAct retourne false quand preMatch n'est pas idle/setup", () => {
    const state = makeStubState({ currentPlayer: "B" });
    (state as any).preMatch = { phase: "fans" };
    expect(isAITurnToAct(state, "B")).toBe(false);
  });

  it("isAITurnToAct retourne true quand preMatch.phase est setup et c'est le tour IA", () => {
    const state = makeStubState({ currentPlayer: "B" });
    (state as any).preMatch = { phase: "setup" };
    expect(isAITurnToAct(state, "B")).toBe(true);
  });

  it("respecte la seed pour la reproductibilite du choix de coup", () => {
    const state = makeStubState({ currentPlayer: "B" });
    const run = () => computeAIMove({
      state,
      aiTeam: "B",
      difficulty: "easy",
      seed: "deterministic-seed",
    });
    const a = run();
    const b = run();
    expect(a.isAITurn).toBe(b.isAITurn);
    expect(a.move).toEqual(b.move);
  });
});
