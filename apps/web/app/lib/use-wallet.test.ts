import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("./api-client", () => {
  class FakeApiError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  }
  return { apiRequest: vi.fn(), ApiClientError: FakeApiError };
});

import { ApiClientError, apiRequest } from "./api-client";
import { useWallet } from "./use-wallet";

const mockedApi = vi.mocked(apiRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useWallet — sprint 1.D.7", () => {
  it("charge balance + transactions + dailyStatus au mount", async () => {
    mockedApi
      .mockResolvedValueOnce({ balance: 1500, transactions: [] })
      .mockResolvedValueOnce({ available: true, nextEligibleAt: null });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.balance).toBe(1500);
    expect(result.current.dailyAvailable).toBe(true);
    expect(result.current.authed).toBe(true);
  });

  it("authed=false sur 401", async () => {
    const FakeError = ApiClientError as unknown as new (
      msg: string,
      status: number,
    ) => Error;
    mockedApi.mockRejectedValue(new FakeError("auth", 401));

    const { result } = renderHook(() => useWallet());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.authed).toBe(false);
  });

  it("claimDaily met à jour le balance + dailyAvailable", async () => {
    mockedApi
      .mockResolvedValueOnce({ balance: 1000, transactions: [] })
      .mockResolvedValueOnce({ available: true, nextEligibleAt: null });

    const { result } = renderHook(() => useWallet());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockedApi
      .mockResolvedValueOnce({
        granted: true,
        amount: 50,
        balance: 1050,
        nextEligibleAt: "2026-09-16T00:00:00.000Z",
      })
      // Then refresh()
      .mockResolvedValueOnce({ balance: 1050, transactions: [] })
      .mockResolvedValueOnce({
        available: false,
        nextEligibleAt: "2026-09-16T00:00:00.000Z",
      });

    let outcome: { granted: boolean; amount: number } | undefined;
    await act(async () => {
      outcome = await result.current.claimDaily();
    });

    expect(outcome?.granted).toBe(true);
    expect(outcome?.amount).toBe(50);
    expect(result.current.balance).toBe(1050);
    expect(result.current.dailyAvailable).toBe(false);
  });

  it("grantFirstTime renvoie outcome", async () => {
    mockedApi
      .mockResolvedValueOnce({ balance: 0, transactions: [] })
      .mockResolvedValueOnce({ available: true, nextEligibleAt: null });

    const { result } = renderHook(() => useWallet());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockedApi
      .mockResolvedValueOnce({
        granted: true,
        amount: 1000,
        balance: 1000,
        nextEligibleAt: null,
      })
      .mockResolvedValueOnce({ balance: 1000, transactions: [] })
      .mockResolvedValueOnce({ available: true, nextEligibleAt: null });

    let outcome: { granted: boolean; amount: number } | undefined;
    await act(async () => {
      outcome = await result.current.grantFirstTime();
    });

    expect(outcome?.granted).toBe(true);
    expect(outcome?.amount).toBe(1000);
  });
});
