/**
 * N.4 — Tests du pont client IA (fetch move -> applyMove -> persist).
 * On mock `@bb/game-engine` pour controler `applyMove` et `getLegalMoves`,
 * et `fetch` pour simuler les endpoints serveur.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@bb/game-engine", () => {
  const applyMove = vi.fn((state: any, _move: any) => ({
    ...state,
    currentPlayer: state.__nextCurrentPlayer ?? state.currentPlayer,
    __applied: (state.__applied ?? 0) + 1,
  }));
  const getLegalMoves = vi.fn((_state: any) => [{ type: "END_TURN" }]);
  const makeRNG = vi.fn(() => () => 0.5);
  return { applyMove, getLegalMoves, makeRNG };
});

import { applyMove, getLegalMoves } from "@bb/game-engine";
import { useAIPracticeLoop } from "./useAIPracticeLoop";

const matchId = "lm-test-1";
const authToken = "jwt-token";

function stubFetchSequence(responses: Array<{ ok?: boolean; body: any; status?: number }>) {
  const fetchMock = vi.fn();
  for (const r of responses) {
    fetchMock.mockResolvedValueOnce({
      ok: r.ok !== false,
      status: r.status ?? 200,
      json: () => Promise.resolve(r.body),
    });
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("useAIPracticeLoop (N.4 bridge)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => (key === "auth_token" ? authToken : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("playOneAIMove : ne fait rien si isAITurn=false", async () => {
    stubFetchSequence([
      { body: { isAITurn: false, move: null, aiTeam: "B", difficulty: "medium" } },
    ]);

    const { result } = renderHook(() =>
      useAIPracticeLoop({ matchId, aiTeam: "B" }),
    );

    const state = { currentPlayer: "A" } as any;
    let playResult: any;
    await act(async () => {
      playResult = await result.current.playOneAIMove(state);
    });

    expect(playResult.moves).toEqual([]);
    expect(playResult.isAITurn).toBe(false);
    expect(applyMove).not.toHaveBeenCalled();
  });

  it("playOneAIMove : applique et persiste le coup IA", async () => {
    const fetchMock = stubFetchSequence([
      {
        body: {
          isAITurn: true,
          move: { type: "END_TURN" },
          aiTeam: "B",
          difficulty: "medium",
        },
      },
      { body: { localMatch: { id: matchId } } },
    ]);

    const onStateChange = vi.fn();
    const { result } = renderHook(() =>
      useAIPracticeLoop({ matchId, aiTeam: "B", onStateChange }),
    );

    const state = { currentPlayer: "B", __nextCurrentPlayer: "A" } as any;
    let playResult: any;
    await act(async () => {
      playResult = await result.current.playOneAIMove(state);
    });

    expect(applyMove).toHaveBeenCalledOnce();
    expect(playResult.moves).toHaveLength(1);
    expect(playResult.isAITurn).toBe(false);
    expect(onStateChange).toHaveBeenCalledOnce();

    // Verifier que la persistance a bien ete appelee (PUT /state).
    const putCall = fetchMock.mock.calls.find(
      (c: any) => c[1]?.method === "PUT",
    );
    expect(putCall).toBeDefined();
    expect(putCall![0]).toContain(`/local-match/${matchId}/state`);
  });

  it("playAITurn : boucle jusqu'a ce que le controle sorte de l'IA", async () => {
    stubFetchSequence([
      {
        body: {
          isAITurn: true,
          move: { type: "MOVE" },
          aiTeam: "B",
          difficulty: "medium",
        },
      },
      {
        body: {
          isAITurn: true,
          move: { type: "END_TURN" },
          aiTeam: "B",
          difficulty: "medium",
        },
      },
      { body: { localMatch: { id: matchId } } },
    ]);

    const { result } = renderHook(() =>
      useAIPracticeLoop({ matchId, aiTeam: "B" }),
    );

    // Premiere iteration: applyMove renvoie un state toujours en B
    // Deuxieme iteration: on configure le state renvoye pour basculer en A
    (applyMove as any)
      .mockImplementationOnce((s: any) => ({ ...s, currentPlayer: "B", __step: 1 }))
      .mockImplementationOnce((s: any) => ({ ...s, currentPlayer: "A", __step: 2 }));

    const state = { currentPlayer: "B" } as any;
    let playResult: any;
    await act(async () => {
      playResult = await result.current.playAITurn(state);
    });

    expect(playResult.moves).toHaveLength(2);
    expect(playResult.state.currentPlayer).toBe("A");
    expect(playResult.isAITurn).toBe(false);
  });

  it("playAITurn : respecte maxMovesPerTurn pour eviter les boucles infinies", async () => {
    stubFetchSequence(
      Array.from({ length: 4 }, () => ({
        body: {
          isAITurn: true,
          move: { type: "MOVE" },
          aiTeam: "B",
          difficulty: "hard",
        },
      })).concat([{ body: { localMatch: { id: matchId } } }]),
    );
    (applyMove as any).mockImplementation((s: any) => ({ ...s, currentPlayer: "B" }));

    const { result } = renderHook(() =>
      useAIPracticeLoop({ matchId, aiTeam: "B", maxMovesPerTurn: 3 }),
    );

    const state = { currentPlayer: "B" } as any;
    let playResult: any;
    await act(async () => {
      playResult = await result.current.playAITurn(state);
    });

    // maxMovesPerTurn=3 doit borner a 3 coups appliques
    expect(playResult.moves).toHaveLength(3);
    expect(applyMove).toHaveBeenCalledTimes(3);
  });

  it("applyUserMove : refuse un coup illegal pour l'etat courant", async () => {
    (getLegalMoves as any).mockReturnValueOnce([{ type: "END_TURN" }]);
    const { result } = renderHook(() =>
      useAIPracticeLoop({ matchId, aiTeam: "B" }),
    );

    const state = { currentPlayer: "A" } as any;
    const illegalMove = { type: "MOVE", playerId: "x", to: { x: 0, y: 0 } } as any;

    let caught: Error | null = null;
    await act(async () => {
      try {
        await result.current.applyUserMove(state, illegalMove);
      } catch (e) {
        caught = e as Error;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect(caught!.message).toMatch(/illegal/i);
    expect(applyMove).not.toHaveBeenCalled();
  });

  it("applyUserMove : applique et persiste un coup legal", async () => {
    (getLegalMoves as any).mockReturnValueOnce([{ type: "END_TURN" }]);
    stubFetchSequence([{ body: { localMatch: { id: matchId } } }]);

    const onStateChange = vi.fn();
    const { result } = renderHook(() =>
      useAIPracticeLoop({ matchId, aiTeam: "B", onStateChange }),
    );

    const state = { currentPlayer: "A" } as any;
    let nextState: any;
    await act(async () => {
      nextState = await result.current.applyUserMove(state, { type: "END_TURN" } as any);
    });

    expect(applyMove).toHaveBeenCalledOnce();
    expect(onStateChange).toHaveBeenCalledWith(nextState);
  });

  it("expose l'erreur serveur via error + clearError", async () => {
    stubFetchSequence([
      { ok: false, status: 500, body: { error: "boom" } },
    ]);

    const { result } = renderHook(() =>
      useAIPracticeLoop({ matchId, aiTeam: "B" }),
    );

    const state = { currentPlayer: "B" } as any;
    await act(async () => {
      await result.current.playOneAIMove(state).catch(() => {});
    });

    expect(result.current.error).toBe("boom");
    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });
});
