import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../lib/api-client", () => ({
  apiRequest: vi.fn(),
  ApiClientError: class extends Error {},
}));
vi.mock("../../lib/use-wallet", () => ({
  useWallet: () => ({
    authed: false,
    loading: false,
    balance: 0,
    transactions: [],
    dailyAvailable: false,
    dailyNextEligibleAt: null,
    error: null,
    refresh: vi.fn(),
    claimDaily: vi.fn(),
    grantFirstTime: vi.fn(),
  }),
}));

import { apiRequest } from "../../lib/api-client";
import LeaderboardPage from "./page";

const mockedApi = vi.mocked(apiRequest);

function makeData(entries: Array<Partial<{
  rank: number; userId: string; coachName: string; betsCount: number;
  settledCount: number; wonCount: number; accuracy: number; profit: number;
  longestStreak: number; biggestWin: number;
}>> = []): unknown {
  return {
    period: "season",
    fromAt: null,
    entries: entries.map((e, i) => ({
      rank: e.rank ?? i + 1,
      userId: e.userId ?? `u${i}`,
      coachName: e.coachName ?? `Coach${i}`,
      betsCount: e.betsCount ?? 5,
      settledCount: e.settledCount ?? 5,
      wonCount: e.wonCount ?? 3,
      accuracy: e.accuracy ?? 60,
      profit: e.profit ?? 100,
      longestStreak: e.longestStreak ?? 2,
      biggestWin: e.biggestWin ?? 200,
    })),
    limit: 20,
    offset: 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LeaderboardPage — sprint 1.D.8", () => {
  it("affiche 'Chargement' pendant le fetch", () => {
    mockedApi.mockReturnValue(new Promise(() => undefined));
    render(<LeaderboardPage />);
    expect(screen.getByText(/Chargement/)).toBeTruthy();
  });

  it("affiche les 3 onglets de période", () => {
    mockedApi.mockReturnValue(new Promise(() => undefined));
    render(<LeaderboardPage />);
    expect(screen.getByTestId("period-weekly")).toBeTruthy();
    expect(screen.getByTestId("period-season")).toBeTruthy();
    expect(screen.getByTestId("period-all-time")).toBeTruthy();
  });

  it("rendu table avec entries (rang + profit coloré)", async () => {
    mockedApi.mockResolvedValue(
      makeData([
        { coachName: "Alice", profit: 450 },
        { coachName: "Bob", profit: -100 },
      ]),
    );
    render(<LeaderboardPage />);
    await waitFor(() => {
      expect(screen.getByTestId("leaderboard-table")).toBeTruthy();
    });
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
    expect(screen.getByText("+450")).toBeTruthy();
    expect(screen.getByText("-100")).toBeTruthy();
  });

  it("change de période en cliquant sur un onglet", async () => {
    mockedApi.mockResolvedValue(makeData());
    render(<LeaderboardPage />);
    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalledWith(
        expect.stringContaining("period=season"),
      );
    });
    fireEvent.click(screen.getByTestId("period-weekly"));
    await waitFor(() => {
      expect(mockedApi).toHaveBeenCalledWith(
        expect.stringContaining("period=weekly"),
      );
    });
  });

  it("affiche placeholder si entries vide", async () => {
    mockedApi.mockResolvedValue(makeData([]));
    render(<LeaderboardPage />);
    await waitFor(() => {
      expect(screen.getByTestId("empty-leaderboard")).toBeTruthy();
    });
  });

  it("affiche message d'erreur si API throw", async () => {
    mockedApi.mockRejectedValue(new Error("boom"));
    render(<LeaderboardPage />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.getByRole("alert").textContent).toContain("boom");
  });
});
