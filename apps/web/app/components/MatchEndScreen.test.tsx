import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MatchEndScreen from "./MatchEndScreen";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(() => "test-auth-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

const mockResults = {
  matchId: "match-123",
  status: "ended",
  createdAt: "2026-04-01T10:00:00.000Z",
  endedAt: "2026-04-01T11:30:00.000Z",
  score: { teamA: 2, teamB: 1 },
  winner: "A" as const,
  teams: {
    A: {
      name: "Skaven Stars",
      coach: "Coach Alice",
      eloRating: 1025,
      stats: { touchdowns: 2, casualties: 1, completions: 3, interceptions: 0 },
    },
    B: {
      name: "Human Heroes",
      coach: "Coach Bob",
      eloRating: 975,
      stats: { touchdowns: 1, casualties: 0, completions: 1, interceptions: 1 },
    },
  },
  matchStats: {},
  matchResult: { winner: "A", spp: {} },
  players: [],
};

describe("MatchEndScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue("test-auth-token");
  });

  it("shows loading state initially", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<MatchEndScreen matchId="match-123" myTeamSide="A" />);
    expect(screen.getByText(/chargement/i)).toBeTruthy();
  });

  it("displays winner announcement when team A wins", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    });
    render(<MatchEndScreen matchId="match-123" myTeamSide="A" />);
    await waitFor(() => {
      expect(screen.getByText(/victoire/i)).toBeTruthy();
    });
  });

  it("displays defeat message when opponent wins", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    });
    render(<MatchEndScreen matchId="match-123" myTeamSide="B" />);
    await waitFor(() => {
      expect(screen.getByText(/défaite/i)).toBeTruthy();
    });
  });

  it("displays draw message when scores are equal", async () => {
    const drawResults = {
      ...mockResults,
      score: { teamA: 1, teamB: 1 },
      winner: "draw" as const,
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => drawResults,
    });
    render(<MatchEndScreen matchId="match-123" myTeamSide="A" />);
    await waitFor(() => {
      expect(screen.getByText(/match nul/i)).toBeTruthy();
    });
  });

  it("displays final score", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    });
    const { container } = render(<MatchEndScreen matchId="match-123" myTeamSide="A" />);
    await waitFor(() => {
      // Find the score elements by their large font class
      const scoreElements = container.querySelectorAll(".text-5xl");
      expect(scoreElements.length).toBe(2);
      expect(scoreElements[0].textContent).toBe("2");
      expect(scoreElements[1].textContent).toBe("1");
    });
  });

  it("displays team names", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    });
    render(<MatchEndScreen matchId="match-123" myTeamSide="A" />);
    await waitFor(() => {
      expect(screen.getByText("Skaven Stars")).toBeTruthy();
      expect(screen.getByText("Human Heroes")).toBeTruthy();
    });
  });

  it("displays ELO ratings", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    });
    render(<MatchEndScreen matchId="match-123" myTeamSide="A" />);
    await waitFor(() => {
      expect(screen.getByText(/1025/)).toBeTruthy();
      expect(screen.getByText(/975/)).toBeTruthy();
    });
  });

  it("displays team stats", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    });
    render(<MatchEndScreen matchId="match-123" myTeamSide="A" />);
    await waitFor(() => {
      // Check that touchdowns stat labels are present
      expect(screen.getByText("Touchdowns")).toBeTruthy();
      expect(screen.getByText("Sorties")).toBeTruthy();
      expect(screen.getByText("Passes")).toBeTruthy();
      expect(screen.getByText("Interceptions")).toBeTruthy();
    });
  });

  it("has a return to lobby button", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    });
    render(<MatchEndScreen matchId="match-123" myTeamSide="A" />);
    await waitFor(() => {
      expect(screen.getByText(/retour/i)).toBeTruthy();
    });
  });

  it("calls onClose when return button is clicked", async () => {
    const onClose = vi.fn();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    });
    render(<MatchEndScreen matchId="match-123" myTeamSide="A" onClose={onClose} />);
    await waitFor(() => {
      const btn = screen.getByText(/retour/i);
      fireEvent.click(btn);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("handles fetch error gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Not found" }),
    });
    render(<MatchEndScreen matchId="match-123" myTeamSide="A" />);
    await waitFor(() => {
      expect(screen.getByText(/erreur/i)).toBeTruthy();
    });
  });

  it("renders without myTeamSide (spectator mode)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResults,
    });
    render(<MatchEndScreen matchId="match-123" myTeamSide={null} />);
    await waitFor(() => {
      expect(screen.getByText("Skaven Stars")).toBeTruthy();
    });
  });
});
