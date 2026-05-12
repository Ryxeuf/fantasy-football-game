/**
 * Sprint 1.G.3 — Tests `useMatchModeRedirect`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("./api-client", () => ({
  apiRequest: vi.fn(),
}));

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

import { apiRequest } from "./api-client";
import { useMatchModeRedirect } from "./use-match-mode-redirect";

const mockedRequest = vi.mocked(apiRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useMatchModeRedirect — sprint 1.G.3", () => {
  it("ne redirige pas si on est sur /live et que status='in_progress'", async () => {
    mockedRequest.mockResolvedValue({ id: "m1", status: "in_progress", scheduledAt: new Date().toISOString() });
    const { result } = renderHook(() => useMatchModeRedirect("m1", "live"));
    await waitFor(() => expect(result.current.status).toBe("in_progress"));
    expect(result.current.redirecting).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("ne redirige pas si on est sur /replay et que status='completed'", async () => {
    mockedRequest.mockResolvedValue({ id: "m1", status: "completed", scheduledAt: new Date().toISOString() });
    const { result } = renderHook(() => useMatchModeRedirect("m1", "replay"));
    await waitFor(() => expect(result.current.status).toBe("completed"));
    expect(result.current.redirecting).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirige /live -> /replay si status='completed'", async () => {
    mockedRequest.mockResolvedValue({ id: "m1", status: "completed", scheduledAt: new Date().toISOString() });
    const { result } = renderHook(() => useMatchModeRedirect("m1", "live"));
    await waitFor(() => expect(result.current.redirecting).toBe(true));
    expect(mockReplace).toHaveBeenCalledWith(
      "/pro-league/matches/m1/replay",
    );
  });

  it("redirige /replay -> /live si status='in_progress'", async () => {
    mockedRequest.mockResolvedValue({ id: "m1", status: "in_progress", scheduledAt: new Date().toISOString() });
    const { result } = renderHook(() => useMatchModeRedirect("m1", "replay"));
    await waitFor(() => expect(result.current.redirecting).toBe(true));
    expect(mockReplace).toHaveBeenCalledWith(
      "/pro-league/matches/m1/live",
    );
  });

  it("redirige vers la page parent si status='scheduled'", async () => {
    mockedRequest.mockResolvedValue({ id: "m1", status: "scheduled", scheduledAt: new Date(Date.now() + 60_000).toISOString() });
    const { result } = renderHook(() => useMatchModeRedirect("m1", "live"));
    await waitFor(() => expect(result.current.redirecting).toBe(true));
    expect(mockReplace).toHaveBeenCalledWith("/pro-league/matches/m1");
  });

  it("redirige vers la page parent si status='ready' + kickoff futur", async () => {
    mockedRequest.mockResolvedValue({ id: "m1", status: "ready", scheduledAt: new Date(Date.now() + 60 * 60_000).toISOString() });
    const { result } = renderHook(() => useMatchModeRedirect("m1", "live"));
    await waitFor(() => expect(result.current.redirecting).toBe(true));
    expect(mockReplace).toHaveBeenCalledWith("/pro-league/matches/m1");
  });

  it("ne redirige PAS si /live + status='ready' + kickoff passe", async () => {
    mockedRequest.mockResolvedValue({ id: "m1", status: "ready", scheduledAt: new Date(Date.now() - 60_000).toISOString() });
    const { result } = renderHook(() => useMatchModeRedirect("m1", "live"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.redirecting).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirige /replay -> /live si status='ready' + kickoff passe", async () => {
    mockedRequest.mockResolvedValue({ id: "m1", status: "ready", scheduledAt: new Date(Date.now() - 60_000).toISOString() });
    const { result } = renderHook(() => useMatchModeRedirect("m1", "replay"));
    await waitFor(() => expect(result.current.redirecting).toBe(true));
    expect(mockReplace).toHaveBeenCalledWith("/pro-league/matches/m1/live");
  });

  it("redirige vers la page parent si status='failed'", async () => {
    mockedRequest.mockResolvedValue({ id: "m1", status: "failed", scheduledAt: new Date().toISOString() });
    const { result } = renderHook(() => useMatchModeRedirect("m1", "replay"));
    await waitFor(() => expect(result.current.redirecting).toBe(true));
    expect(mockReplace).toHaveBeenCalledWith("/pro-league/matches/m1");
  });

  it("expose error sur fetch fail", async () => {
    mockedRequest.mockRejectedValue(new Error("404 not found"));
    const { result } = renderHook(() => useMatchModeRedirect("m1", "live"));
    await waitFor(() =>
      expect(result.current.error).toBe("404 not found"),
    );
    expect(result.current.redirecting).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
