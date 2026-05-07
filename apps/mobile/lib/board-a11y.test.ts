/**
 * S27.4 (a11y) — Tests pour `summarizeBoardForA11y`.
 */
import { describe, it, expect } from "vitest";
import type { GameState, Player } from "@bb/game-engine";
import { summarizeBoardForA11y } from "./board-a11y";

function makePlayer(overrides: Partial<Player>): Player {
  return {
    id: "p",
    team: "A",
    pos: { x: 0, y: 0 },
    name: "Player",
    number: 1,
    position: "Lineman",
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
    pm: 6,
    state: "on-field",
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = {
    width: 26,
    height: 15,
    players: [],
    currentPlayer: "A" as const,
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
    apothecaryAvailable: { teamA: true, teamB: true },
    dugouts: {
      teamA: { reserves: [], ko: [], casualties: [] },
      teamB: { reserves: [], ko: [], casualties: [] },
    },
    gamePhase: "playing" as const,
    half: 1,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: "Skavens", teamB: "Halflings" },
  } as unknown as GameState;
  return { ...base, ...overrides };
}

describe("summarizeBoardForA11y", () => {
  it("retourne le score, la mi-temps et le tour", () => {
    const state = makeState({
      score: { teamA: 2, teamB: 1 },
      half: 2,
      turn: 5,
    });
    const summary = summarizeBoardForA11y(state);
    expect(summary.scoreA).toBe(2);
    expect(summary.scoreB).toBe(1);
    expect(summary.half).toBe(2);
    expect(summary.turn).toBe(5);
  });

  it("retourne l'equipe active et les noms", () => {
    const state = makeState({
      currentPlayer: "B",
      teamNames: { teamA: "Skavens", teamB: "Halflings" },
    });
    const summary = summarizeBoardForA11y(state);
    expect(summary.currentTeam).toBe("B");
    expect(summary.teamA).toBe("Skavens");
    expect(summary.teamB).toBe("Halflings");
  });

  it("compte les joueurs sur le terrain par equipe", () => {
    const state = makeState({
      players: [
        makePlayer({ id: "a1", team: "A" }),
        makePlayer({ id: "a2", team: "A" }),
        makePlayer({ id: "a3", team: "A", state: "reserves" }),
        makePlayer({ id: "b1", team: "B" }),
        makePlayer({ id: "b2", team: "B", state: "casualties" }),
      ],
    });
    const summary = summarizeBoardForA11y(state);
    expect(summary.playersA).toBe(2);
    expect(summary.playersB).toBe(1);
  });

  it("traite l'absence d'etat comme un joueur sur le terrain", () => {
    const playerNoState = makePlayer({ id: "a1", team: "A" });
    delete (playerNoState as { state?: unknown }).state;
    const state = makeState({ players: [playerNoState] });
    const summary = summarizeBoardForA11y(state);
    expect(summary.playersA).toBe(1);
  });

  it("fournit des fallbacks si score/half/teamNames absents", () => {
    const state = makeState({});
    delete (state as { score?: unknown }).score;
    delete (state as { half?: unknown }).half;
    delete (state as { teamNames?: unknown }).teamNames;
    const summary = summarizeBoardForA11y(state);
    expect(summary.scoreA).toBe(0);
    expect(summary.scoreB).toBe(0);
    expect(summary.half).toBe(1);
    expect(summary.teamA).toBe("Equipe A");
    expect(summary.teamB).toBe("Equipe B");
  });
});
