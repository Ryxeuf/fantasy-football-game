import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import PlayPage from "./page";
import { LanguageProvider } from "../contexts/LanguageContext";
import { FeatureFlagProvider } from "../contexts/FeatureFlagContext";

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

vi.mock("../lib/featureFlags", () => ({
  fetchMyFlags: vi.fn(),
}));

import { fetchMyFlags } from "../lib/featureFlags";
const mockedFetchMyFlags = fetchMyFlags as unknown as ReturnType<typeof vi.fn>;

function renderWithProvider() {
  return render(
    <LanguageProvider>
      <FeatureFlagProvider>
        <PlayPage />
      </FeatureFlagProvider>
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
    mockedFetchMyFlags.mockResolvedValue([]);
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

describe("PlayPage — ai_training feature flag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue("fake-token");
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/auth/me")) return Promise.resolve(mockAuthResponse);
      if (url.includes("/my-matches"))
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ matches: [] }),
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
  });

  it("hides the 'Entrainement contre l'IA' card when the flag is inactive", async () => {
    mockedFetchMyFlags.mockResolvedValue([]);
    renderWithProvider();
    // Wait for the create-match card (always rendered) to appear, then
    // assert the practice card is absent.
    await waitFor(() =>
      expect(screen.getByTestId("create-match-button")).toBeTruthy(),
    );
    expect(screen.queryByTestId("practice-ai-card")).toBeNull();
  });

  it("shows the 'Entrainement contre l'IA' card when the flag is active", async () => {
    mockedFetchMyFlags.mockResolvedValue(["ai_training"]);
    renderWithProvider();
    await waitFor(() =>
      expect(screen.getByTestId("practice-ai-card")).toBeTruthy(),
    );
  });
});
