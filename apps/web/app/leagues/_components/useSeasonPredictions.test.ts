import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const apiRequest = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import { useSeasonPredictions } from "./useSeasonPredictions";
import { makeBoard, makeView } from "./predictions.fixtures";

beforeEach(() => {
  vi.resetAllMocks();
});

function mockApi(board: unknown) {
  apiRequest.mockImplementation(async (path: string) => {
    if (path.endsWith("/leaderboard")) {
      if (board instanceof Error) throw board;
      return board;
    }
    return makeView();
  });
}

describe("useSeasonPredictions", () => {
  it("charge la vue et le classement de la saison", async () => {
    mockApi(makeBoard());
    const { result } = renderHook(() => useSeasonPredictions("season-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.view?.seasonId).toBe("season-1");
    expect(result.current.board).not.toBeNull();
    expect(apiRequest).toHaveBeenCalledWith(
      "/leagues/seasons/season-1/predictions",
    );
  });

  it("un classement en échec n'empêche pas la vue", async () => {
    mockApi(new Error("boom"));
    const { result } = renderHook(() => useSeasonPredictions("season-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.view).not.toBeNull();
    expect(result.current.board).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("une vue en échec remonte son message", async () => {
    apiRequest.mockRejectedValue(new Error("Saison introuvable"));
    const { result } = renderHook(() => useSeasonPredictions("season-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Saison introuvable");
  });

  it("sans saison : n'appelle rien", async () => {
    const { result } = renderHook(() => useSeasonPredictions(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("reload relit la vue", async () => {
    mockApi(makeBoard());
    const { result } = renderHook(() => useSeasonPredictions("season-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = apiRequest.mock.calls.length;
    await act(async () => {
      await result.current.reload();
    });
    expect(apiRequest.mock.calls.length).toBe(before + 2);
  });
});
