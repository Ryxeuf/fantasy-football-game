import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PlayPage from "./page";
import { LanguageProvider } from "../contexts/LanguageContext";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const localStorageMock = {
  getItem: vi.fn(() => "fake-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock the matchmaking socket hook
vi.mock("./hooks/useMatchmakingSocket", () => ({
  useMatchmakingSocket: vi.fn(),
}));

function renderWithProvider() {
  return render(
    <LanguageProvider>
      <PlayPage />
    </LanguageProvider>,
  );
}

const mockAuthResponse = {
  ok: true,
  json: () => Promise.resolve({ user: { id: "u1" } }),
};

const mockMatchesData = {
  matches: [
    {
      id: "m1",
      status: "active",
      createdAt: "2025-04-01T10:00:00Z",
      lastMoveAt: "2025-04-01T12:00:00Z",
      isMyTurn: true,
      score: { teamA: 1, teamB: 0 },
      half: 1,
      turn: 5,
      myTeam: {
        coachName: "Coach Alpha",
        teamName: "Alpha Ogres",
        rosterName: "Ogre",
        eloRating: 1250,
      },
      opponent: {
        coachName: "Coach Beta",
        teamName: "Beta Elves",
        rosterName: "High Elf",
        eloRating: 1180,
      },
    },
  ],
};

const mockTeamsData = { teams: [] };
const mockQueueData = { inQueue: false };

describe("PlayPage — ELO display in lobby", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue("fake-token");
  });

  it("displays opponent ELO rating in match cards", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/auth/me")) return Promise.resolve(mockAuthResponse);
      if (url.includes("/my-matches"))
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockMatchesData),
        });
      if (url.includes("/team/mine"))
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTeamsData),
        });
      if (url.includes("/matchmaking/status"))
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockQueueData),
        });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Beta Elves")).toBeTruthy();
    });

    // Opponent ELO should be displayed
    expect(screen.getByText("1180")).toBeTruthy();
  });
});
