import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import LeagueDetailPage from "./page";
import { LanguageProvider } from "../../contexts/LanguageContext";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const localStorageMock = {
  getItem: vi.fn<(key: string) => string | null>(() => "test-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "lg-1" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

function renderWithProvider() {
  return render(
    <LanguageProvider>
      <LeagueDetailPage />
    </LanguageProvider>,
  );
}

const mockLeague = {
  id: "lg-1",
  name: "Open 5 Teams",
  description: "Ligue des 5 rosters",
  creatorId: "u1",
  creator: { id: "u1", coachName: "Coach Bob", email: "bob@example.com" },
  ruleset: "season_3",
  status: "open",
  isPublic: true,
  maxParticipants: 16,
  allowedRosters: ["skaven", "gnomes", "lizardmen", "dwarf", "imperial_nobility"],
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  forfeitPoints: -1,
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
  seasons: [
    {
      id: "season-1",
      seasonNumber: 1,
      name: "Saison 1",
      status: "in_progress",
      startDate: null,
      endDate: null,
    },
    {
      id: "season-2",
      seasonNumber: 2,
      name: "Saison 2",
      status: "draft",
      startDate: null,
      endDate: null,
    },
  ],
};

const mockSeason = {
  id: "season-1",
  seasonNumber: 1,
  name: "Saison 1",
  status: "in_progress",
  startDate: null,
  endDate: null,
  leagueId: "lg-1",
  league: {
    id: "lg-1",
    name: "Open 5 Teams",
    creatorId: "u1",
    allowedRosters: ["skaven", "gnomes", "lizardmen", "dwarf", "imperial_nobility"],
  },
  rounds: [
    {
      id: "round-1",
      roundNumber: 1,
      name: "Journée 1",
      status: "completed",
      startDate: "2026-02-01T10:00:00.000Z",
      endDate: null,
    },
    {
      id: "round-2",
      roundNumber: 2,
      name: null,
      status: "pending",
      startDate: null,
      endDate: null,
    },
  ],
  participants: [
    {
      id: "part-1",
      seasonElo: 1050,
      status: "active",
      teamId: "team-1",
      team: {
        id: "team-1",
        name: "Skaven Slashers",
        roster: "skaven",
        owner: { id: "u1", coachName: "Coach Bob" },
      },
    },
    {
      id: "part-2",
      seasonElo: 990,
      status: "active",
      teamId: "team-2",
      team: {
        id: "team-2",
        name: "Dwarf Brawlers",
        roster: "dwarf",
        owner: { id: "u2", coachName: "Coach Alice" },
      },
    },
  ],
};

const mockStandings = {
  seasonId: "season-1",
  standings: [
    {
      participantId: "part-1",
      teamId: "team-1",
      teamName: "Skaven Slashers",
      roster: "skaven",
      ownerId: "u1",
      coachName: "Coach Bob",
      played: 2,
      wins: 2,
      draws: 0,
      losses: 0,
      points: 6,
      touchdownsFor: 5,
      touchdownsAgainst: 2,
      touchdownDifference: 3,
      casualtiesFor: 3,
      casualtiesAgainst: 1,
      seasonElo: 1050,
      status: "active",
    },
    {
      participantId: "part-2",
      teamId: "team-2",
      teamName: "Dwarf Brawlers",
      roster: "dwarf",
      ownerId: "u2",
      coachName: "Coach Alice",
      played: 2,
      wins: 0,
      draws: 0,
      losses: 2,
      points: 0,
      touchdownsFor: 2,
      touchdownsAgainst: 5,
      touchdownDifference: -3,
      casualtiesFor: 1,
      casualtiesAgainst: 3,
      seasonElo: 990,
      status: "active",
    },
  ],
};

function mockApi(sequence: {
  league?: unknown;
  season?: unknown;
  standings?: unknown;
  leagueError?: { status?: number; body?: unknown };
}) {
  mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (/\/league\/lg-1(?:$|\?)/.test(url)) {
      if (sequence.leagueError) {
        return {
          ok: false,
          status: sequence.leagueError.status ?? 500,
          json: () => Promise.resolve(sequence.leagueError?.body ?? {}),
        };
      }
      return {
        ok: true,
        json: () => Promise.resolve({ league: sequence.league }),
      };
    }
    if (/\/league\/seasons\/[^/]+\/standings/.test(url)) {
      return {
        ok: true,
        json: () => Promise.resolve(sequence.standings ?? { standings: [] }),
      };
    }
    if (/\/league\/seasons\/[^/]+(?:$|\?)/.test(url)) {
      return {
        ok: true,
        json: () => Promise.resolve({ season: sequence.season }),
      };
    }
    return {
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "not found" }),
    };
  });
}

describe("LeagueDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue("test-token");
  });

  it("shows a loading state initially", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWithProvider();
    expect(screen.getByText(/chargement/i)).toBeTruthy();
  });

  it("shows the league header after load", async () => {
    mockApi({
      league: mockLeague,
      season: mockSeason,
      standings: mockStandings,
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Open 5 Teams")).toBeTruthy();
    });
    expect(screen.getByText(/Coach Bob/)).toBeTruthy();
    expect(screen.getAllByText(/Saison 3/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows an error state when the league fetch fails", async () => {
    mockApi({ leagueError: { status: 404, body: { error: "Ligue introuvable" } } });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText(/introuvable|error|erreur/i)).toBeTruthy();
    });
  });

  it("shows a seasons section with all league seasons", async () => {
    mockApi({ league: mockLeague, season: mockSeason, standings: mockStandings });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Open 5 Teams")).toBeTruthy();
    });
    expect(screen.getByText(/Saison 1/)).toBeTruthy();
    expect(screen.getByText(/Saison 2/)).toBeTruthy();
  });

  it("renders the calendar (rounds) for the selected season", async () => {
    mockApi({ league: mockLeague, season: mockSeason, standings: mockStandings });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("league-rounds")).toBeTruthy();
    });
    expect(screen.getByText(/Journée 1/)).toBeTruthy();
    // round 2 has no name => must still show roundNumber
    expect(screen.getAllByText(/J2|Journée 2|Round 2/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the standings table for the selected season", async () => {
    mockApi({ league: mockLeague, season: mockSeason, standings: mockStandings });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("league-standings")).toBeTruthy();
    });
    expect(screen.getAllByText("Skaven Slashers").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Dwarf Brawlers").length).toBeGreaterThanOrEqual(1);
    const rows = screen.getAllByTestId(/standings-row-/);
    expect(rows.length).toBe(2);
  });

  it("renders the participants list for the selected season", async () => {
    mockApi({ league: mockLeague, season: mockSeason, standings: mockStandings });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("league-participants")).toBeTruthy();
    });
    expect(screen.getByText(/Coach Alice/)).toBeTruthy();
  });

  it("shows an empty state when the league has no seasons yet", async () => {
    mockApi({
      league: { ...mockLeague, seasons: [] },
      season: null,
      standings: { standings: [] },
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("league-seasons-empty")).toBeTruthy();
    });
  });

  it("calls the API with Authorization header", async () => {
    mockApi({ league: mockLeague, season: mockSeason, standings: mockStandings });

    renderWithProvider();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const firstCall = mockFetch.mock.calls[0];
    const headers = (firstCall[1]?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
  });
});
