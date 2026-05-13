/**
 * Lot 3.D.3 — Tests `useFullReplay`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { apiRequest } from "./api-client";
import { useFullReplay } from "./use-full-replay";

vi.mock("./api-client", () => ({
  apiRequest: vi.fn(),
  ApiClientError: class ApiClientError extends Error {},
}));

const mockedApi = vi.mocked(apiRequest);

const fakeInitialState = {
  half: 1,
  turn: 1,
  gamePhase: "playing",
  selectedPlayerId: null,
  players: [],
  score: { teamA: 0, teamB: 0 },
} as unknown;

const fakeState1 = { ...(fakeInitialState as object), turn: 1 } as unknown;
const fakeState2 = { ...(fakeInitialState as object), turn: 2 } as unknown;

const fakeDump = {
  matchId: "m1",
  status: "completed",
  durationMs: 2000,
  initialState: fakeInitialState,
  moves: [{ type: "END_TURN" }, { type: "END_TURN" }],
  states: [fakeState1, fakeState2],
  teams: {
    home: {
      id: "h",
      slug: "sf-gold-rush",
      name: "Gold Rush",
      city: "SF",
      race: "Skaven",
      primaryColor: null,
      secondaryColor: null,
    },
    away: null,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useFullReplay — Lot 3.D.3", () => {
  it("charge le dump et initialise currentMoveIndex=-1 (initialState)", async () => {
    mockedApi.mockResolvedValue(fakeDump);
    const { result } = renderHook(() => useFullReplay("m1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.dump).toBeDefined();
    expect(result.current.currentMoveIndex).toBe(-1);
    expect(result.current.currentState).toBe(fakeInitialState);
    expect(result.current.totalMoves).toBe(2);
    expect(result.current.durationMs).toBe(2000);
  });

  it("seek(1000) → currentMoveIndex=0 (états après moves[0])", async () => {
    mockedApi.mockResolvedValue(fakeDump);
    const { result } = renderHook(() => useFullReplay("m1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.controls.seek(1000));
    expect(result.current.currentMoveIndex).toBe(0);
    expect(result.current.currentState).toBe(fakeState1);
    expect(result.current.currentMove).toEqual({ type: "END_TURN" });
  });

  it("stepForward / stepBackward naviguent par move", async () => {
    mockedApi.mockResolvedValue(fakeDump);
    const { result } = renderHook(() => useFullReplay("m1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.currentMoveIndex).toBe(-1);
    act(() => result.current.controls.stepForward());
    expect(result.current.currentMoveIndex).toBe(0);
    act(() => result.current.controls.stepForward());
    expect(result.current.currentMoveIndex).toBe(1);
    // borne haute : reste à n-1
    act(() => result.current.controls.stepForward());
    expect(result.current.currentMoveIndex).toBe(1);

    act(() => result.current.controls.stepBackward());
    expect(result.current.currentMoveIndex).toBe(0);
    act(() => result.current.controls.stepBackward());
    expect(result.current.currentMoveIndex).toBe(-1);
    // borne basse : reste à -1
    act(() => result.current.controls.stepBackward());
    expect(result.current.currentMoveIndex).toBe(-1);
  });

  it("skipToEnd → currentMoveIndex = totalMoves - 1", async () => {
    mockedApi.mockResolvedValue(fakeDump);
    const { result } = renderHook(() => useFullReplay("m1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.controls.skipToEnd());
    expect(result.current.currentMoveIndex).toBe(1);
    expect(result.current.currentState).toBe(fakeState2);
  });

  it("compact=true (défaut) retire les moves filler de la séquence visionnée", async () => {
    const filled = {
      ...fakeDump,
      moves: [
        { type: "MOVE" },
        { type: "BLOCK" },
        { type: "BLOCK_CHOOSE" },
        { type: "PUSH_CHOOSE" },
        { type: "FOLLOW_UP_CHOOSE" },
        { type: "END_TURN" },
      ],
      states: Array.from({ length: 6 }, (_, i) => ({
        ...(fakeInitialState as object),
        turn: i,
      })),
    };
    mockedApi.mockResolvedValue(filled);
    const { result } = renderHook(() => useFullReplay("m1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.compact).toBe(true);
    expect(result.current.totalMoves).toBe(3);
    expect(result.current.fillerCount).toBe(3);
    expect(result.current.durationMs).toBe(3000);
    act(() => result.current.controls.stepForward());
    expect(result.current.currentMove?.type).toBe("MOVE");
    act(() => result.current.controls.stepForward());
    expect(result.current.currentMove?.type).toBe("BLOCK");
    act(() => result.current.controls.stepForward());
    // BLOCK_CHOOSE, PUSH_CHOOSE, FOLLOW_UP_CHOOSE skipped
    expect(result.current.currentMove?.type).toBe("END_TURN");
  });

  it("compact=false → moves bruts (filler inclus)", async () => {
    const filled = {
      ...fakeDump,
      moves: [
        { type: "MOVE" },
        { type: "BLOCK_CHOOSE" },
        { type: "END_TURN" },
      ],
      states: Array.from({ length: 3 }, (_, i) => ({
        ...(fakeInitialState as object),
        turn: i,
      })),
    };
    mockedApi.mockResolvedValue(filled);
    const { result } = renderHook(() =>
      useFullReplay("m1", { compact: false }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.compact).toBe(false);
    expect(result.current.totalMoves).toBe(3);
    expect(result.current.fillerCount).toBe(0);
  });

  it("erreur 404 FULL_REPLAY_NOT_AVAILABLE remontée via errorCode", async () => {
    class ApiErr extends Error {
      code = "FULL_REPLAY_NOT_AVAILABLE";
    }
    mockedApi.mockRejectedValue(new ApiErr("no full replay"));
    const { result } = renderHook(() => useFullReplay("m1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.errorCode).toBe("FULL_REPLAY_NOT_AVAILABLE");
    expect(result.current.dump).toBeNull();
  });
});
