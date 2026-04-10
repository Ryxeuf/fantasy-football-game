import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LeaderboardPage from "./page";
import { LanguageProvider } from "../contexts/LanguageContext";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

function renderWithProvider() {
  return render(
    <LanguageProvider>
      <LeaderboardPage />
    </LanguageProvider>,
  );
}

const mockLeaderboardData = {
  success: true,
  data: [
    { rank: 1, userId: "u1", coachName: "Coach Alpha", eloRating: 1250 },
    { rank: 2, userId: "u2", coachName: "Coach Beta", eloRating: 1180 },
    { rank: 3, userId: "u3", coachName: "Coach Gamma", eloRating: 1050 },
  ],
  meta: { total: 3, limit: 20, offset: 0 },
};

describe("LeaderboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it("shows loading state initially", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWithProvider();
    expect(screen.getByText(/chargement/i)).toBeTruthy();
  });

  it("displays leaderboard data after successful fetch", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeaderboardData),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Coach Alpha")).toBeTruthy();
    });

    expect(screen.getByText("Coach Beta")).toBeTruthy();
    expect(screen.getByText("Coach Gamma")).toBeTruthy();
    // ELO values may appear in both table and stats cards
    expect(screen.getAllByText("1250").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("1180")).toBeTruthy();
    expect(screen.getByText("1050")).toBeTruthy();
  });

  it("displays rank numbers", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeaderboardData),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Coach Alpha")).toBeTruthy();
    });

    // Rank numbers should be displayed
    const cells = screen.getAllByRole("cell");
    const rankCells = cells.filter(
      (cell) => cell.textContent === "1" || cell.textContent === "2" || cell.textContent === "3",
    );
    expect(rankCells.length).toBeGreaterThanOrEqual(3);
  });

  it("shows error state on fetch failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText(/erreur/i)).toBeTruthy();
    });
  });

  it("shows empty state when no players", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: [],
          meta: { total: 0, limit: 20, offset: 0 },
        }),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText(/aucun joueur/i)).toBeTruthy();
    });
  });

  it("displays statistics cards", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeaderboardData),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Coach Alpha")).toBeTruthy();
    });

    // Stats cards should show total and top rating
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1); // total players
    expect(screen.getAllByText("1250").length).toBeGreaterThanOrEqual(1); // top rating
  });

  it("handles pagination - next page", async () => {
    const page1Data = {
      success: true,
      data: Array.from({ length: 20 }, (_, i) => ({
        rank: i + 1,
        userId: `u${i + 1}`,
        coachName: `Coach ${i + 1}`,
        eloRating: 1500 - i * 10,
      })),
      meta: { total: 25, limit: 20, offset: 0 },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(page1Data),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Coach 1")).toBeTruthy();
    });

    const page2Data = {
      success: true,
      data: Array.from({ length: 5 }, (_, i) => ({
        rank: 21 + i,
        userId: `u${21 + i}`,
        coachName: `Coach ${21 + i}`,
        eloRating: 1300 - i * 10,
      })),
      meta: { total: 25, limit: 20, offset: 20 },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(page2Data),
    });

    const nextButton = screen.getByText(/suivant/i);
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText("Coach 21")).toBeTruthy();
    });
  });

  it("disables previous button on first page", async () => {
    const paginatedData = {
      success: true,
      data: Array.from({ length: 20 }, (_, i) => ({
        rank: i + 1,
        userId: `u${i + 1}`,
        coachName: `Coach ${i + 1}`,
        eloRating: 1500 - i * 10,
      })),
      meta: { total: 25, limit: 20, offset: 0 },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(paginatedData),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Coach 1")).toBeTruthy();
    });

    const prevButton = screen.getByText(/précédent/i);
    expect(prevButton).toBeInstanceOf(HTMLButtonElement);
    expect((prevButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls the correct API endpoint", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeaderboardData),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/leaderboard?limit=20&offset=0"),
      );
    });
  });
});
