import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock sound-manager module
const mockPlay = vi.fn();
const mockIsMuted = vi.fn(() => false);
vi.mock("./sound-manager", () => ({
  getSoundManager: () => ({
    play: mockPlay,
    isMuted: mockIsMuted,
    setMuted: vi.fn(),
    toggleMuted: vi.fn(),
  }),
}));

import { useSoundEffects, mapLogEntryToSound } from "./useSoundEffects";
import type { GameLogEntry } from "@bb/game-engine";
import type { ExtendedGameState } from "@bb/game-engine";

function makeLogEntry(
  overrides: Partial<GameLogEntry> & Pick<GameLogEntry, "type" | "message">,
): GameLogEntry {
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeMinimalState(
  overrides: Partial<ExtendedGameState> = {},
): ExtendedGameState {
  return {
    players: [],
    width: 26,
    height: 15,
    turn: 1,
    half: 1,
    activeTeam: "A" as const,
    isTurnover: false,
    score: { teamA: 0, teamB: 0 },
    gameLog: [],
    playerActions: {},
    teamBlitzCount: {},
    teamFoulCount: {},
    matchStats: {},
    teamNames: { teamA: "Team A", teamB: "Team B" },
    ...overrides,
  } as ExtendedGameState;
}

describe("mapLogEntryToSound", () => {
  it("maps score entries to touchdown", () => {
    const entry = makeLogEntry({ type: "score", message: "Touchdown pour Team A !" });
    expect(mapLogEntryToSound(entry)).toBe("touchdown");
  });

  it("maps dice entries to dice-roll", () => {
    const entry = makeLogEntry({ type: "dice", message: "Block dice: 2D" });
    expect(mapLogEntryToSound(entry)).toBe("dice-roll");
  });

  it("maps dodge dice to dice-roll", () => {
    const entry = makeLogEntry({ type: "dice", message: "Dodge : relance de l'esquive" });
    expect(mapLogEntryToSound(entry)).toBe("dice-roll");
  });

  it("maps KO action to injury-ko", () => {
    const entry = makeLogEntry({ type: "action", message: "Joueur est KO !" });
    expect(mapLogEntryToSound(entry)).toBe("injury-ko");
  });

  it("maps stunned action to injury-stun", () => {
    const entry = makeLogEntry({ type: "action", message: "Joueur est sonné" });
    expect(mapLogEntryToSound(entry)).toBe("injury-stun");
  });

  it("maps death to injury-casualty", () => {
    const entry = makeLogEntry({ type: "action", message: "Joueur est MORT !" });
    expect(mapLogEntryToSound(entry)).toBe("injury-casualty");
  });

  it("maps casualty to injury-casualty", () => {
    const entry = makeLogEntry({ type: "action", message: "Blessure grave" });
    expect(mapLogEntryToSound(entry)).toBe("injury-casualty");
  });

  it("maps push to block-push", () => {
    const entry = makeLogEntry({ type: "action", message: "Défenseur repoussé" });
    expect(mapLogEntryToSound(entry)).toBe("block-push");
  });

  it("maps kickoff info to kickoff", () => {
    const entry = makeLogEntry({ type: "info", message: "Kickoff event !" });
    expect(mapLogEntryToSound(entry)).toBe("kickoff");
  });

  it("maps pass action to pass", () => {
    const entry = makeLogEntry({ type: "action", message: "Passe réussie" });
    expect(mapLogEntryToSound(entry)).toBe("pass");
  });

  it("maps catch action to catch-success", () => {
    const entry = makeLogEntry({ type: "action", message: "Réception réussie" });
    expect(mapLogEntryToSound(entry)).toBe("catch-success");
  });

  it("maps dodge success to dodge-success", () => {
    const entry = makeLogEntry({ type: "action", message: "Esquive réussie" });
    expect(mapLogEntryToSound(entry)).toBe("dodge-success");
  });

  it("returns null for unrecognized entries", () => {
    const entry = makeLogEntry({ type: "info", message: "Match commencé" });
    expect(mapLogEntryToSound(entry)).toBeNull();
  });
});

describe("useSoundEffects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not play sound on initial mount (silent init)", () => {
    const state = makeMinimalState({
      gameLog: [
        makeLogEntry({ type: "score", message: "Touchdown pour Team A !" }),
      ],
    });

    renderHook(() => useSoundEffects({ state }));

    expect(mockPlay).not.toHaveBeenCalled();
  });

  it("plays sound when new log entries appear", () => {
    const initialState = makeMinimalState({ gameLog: [] });

    const { rerender } = renderHook(
      ({ state }) => useSoundEffects({ state }),
      { initialProps: { state: initialState } },
    );

    const updatedState = makeMinimalState({
      gameLog: [
        makeLogEntry({ type: "score", message: "Touchdown pour Team A !" }),
      ],
    });

    rerender({ state: updatedState });

    expect(mockPlay).toHaveBeenCalledWith("touchdown");
  });

  it("plays the highest priority sound when multiple new entries arrive", () => {
    const initialState = makeMinimalState({ gameLog: [] });

    const { rerender } = renderHook(
      ({ state }) => useSoundEffects({ state }),
      { initialProps: { state: initialState } },
    );

    const updatedState = makeMinimalState({
      gameLog: [
        makeLogEntry({ type: "dice", message: "Block dice" }),
        makeLogEntry({ type: "score", message: "Touchdown pour Team A !" }),
      ],
    });

    rerender({ state: updatedState });

    // Touchdown has higher priority than dice-roll
    expect(mockPlay).toHaveBeenCalledWith("touchdown");
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it("plays turnover sound on isTurnover transition", () => {
    const initialState = makeMinimalState({ isTurnover: false, gameLog: [] });

    const { rerender } = renderHook(
      ({ state }) => useSoundEffects({ state }),
      { initialProps: { state: initialState } },
    );

    const turnoverState = makeMinimalState({ isTurnover: true, gameLog: [] });
    rerender({ state: turnoverState });

    expect(mockPlay).toHaveBeenCalledWith("turnover");
  });

  it("does not play sounds when enabled is false", () => {
    const initialState = makeMinimalState({ gameLog: [] });

    const { rerender } = renderHook(
      ({ state, enabled }) => useSoundEffects({ state, enabled }),
      { initialProps: { state: initialState, enabled: false } },
    );

    const updatedState = makeMinimalState({
      gameLog: [
        makeLogEntry({ type: "score", message: "Touchdown !" }),
      ],
    });

    rerender({ state: updatedState, enabled: false });

    expect(mockPlay).not.toHaveBeenCalled();
  });

  it("does not play sound when state is null", () => {
    renderHook(() => useSoundEffects({ state: null }));
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it("does not replay old entries on subsequent renders", () => {
    const log1 = makeLogEntry({ type: "dice", message: "Block dice" });
    const initialState = makeMinimalState({ gameLog: [] });

    const { rerender } = renderHook(
      ({ state }) => useSoundEffects({ state }),
      { initialProps: { state: initialState } },
    );

    // First update
    const state1 = makeMinimalState({ gameLog: [log1] });
    rerender({ state: state1 });
    expect(mockPlay).toHaveBeenCalledTimes(1);

    mockPlay.mockClear();

    // Re-render with same log — should NOT play again
    rerender({ state: state1 });
    expect(mockPlay).not.toHaveBeenCalled();
  });
});
