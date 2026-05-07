import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../../../lib/api-client", () => ({
  apiRequest: vi.fn(),
  ApiClientError: class ApiClientError extends Error {},
}));

import { apiRequest } from "../../../lib/api-client";
import ProLeagueTeamPage from "./page";

const mockedApi = vi.mocked(apiRequest);

function makeTeam(overrides: Record<string, unknown> = {}): unknown {
  return {
    slug: "buf-snow-ogres",
    city: "Buffalo",
    name: "Snow Ogres",
    race: "Ogre",
    nflFlavor: "Buffalo snow brutality",
    primaryColor: "#00338D",
    secondaryColor: "#C60C30",
    baseTv: 1100,
    motto: "Snow over Steel",
    seasonId: "s1",
    seasonYear: 2026,
    record: {
      played: 4,
      wins: 3,
      draws: 0,
      losses: 1,
      points: 9,
      tdFor: 12,
      tdAgainst: 5,
      form: ["W", "W", "L", "W"],
    },
    roster: [
      {
        id: "p1",
        name: "Grim",
        position: "Lineman",
        ma: 5,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: ["block"],
        status: "active",
        form: 60,
        niggling: 0,
      },
    ],
    upcomingMatches: [
      {
        id: "m_up",
        roundNumber: 5,
        status: "scheduled",
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
        homeTeamSlug: "buf-snow-ogres",
        awayTeamSlug: "gb-cheese-halflings",
        opponent: {
          slug: "gb-cheese-halflings",
          name: "Cheese Halflings",
          city: "Green Bay",
          primaryColor: "#203731",
        },
        isHome: true,
        scoreHome: null,
        scoreAway: null,
        outcome: null,
      },
    ],
    recentMatches: [
      {
        id: "m_done",
        roundNumber: 4,
        status: "completed",
        scheduledAt: new Date(Date.now() - 86_400_000).toISOString(),
        homeTeamSlug: "kc-soaring-hawks",
        awayTeamSlug: "buf-snow-ogres",
        opponent: {
          slug: "kc-soaring-hawks",
          name: "Soaring Hawks",
          city: "Kansas City",
          primaryColor: "#E31837",
        },
        isHome: false,
        scoreHome: 1,
        scoreAway: 3,
        outcome: "away",
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProLeagueTeamPage — sprint 1.C.2", () => {
  it("affiche 'Chargement…' pendant le fetch", () => {
    mockedApi.mockReturnValue(new Promise(() => undefined));
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    expect(screen.getByText(/Chargement/)).toBeTruthy();
  });

  it("affiche le banner avec city, race, motto, NFL flavor", async () => {
    mockedApi.mockResolvedValue(makeTeam());
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    await waitFor(() => {
      expect(screen.getByTestId("team-banner")).toBeTruthy();
    });
    expect(screen.getByText("Snow Ogres")).toBeTruthy();
    expect(screen.getByText("Buffalo")).toBeTruthy();
    expect(screen.getAllByText(/Ogre/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Snow over Steel/)).toBeTruthy();
    expect(screen.getByText(/Buffalo snow brutality/)).toBeTruthy();
  });

  it("affiche le record + points + form", async () => {
    mockedApi.mockResolvedValue(makeTeam());
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    await waitFor(() => {
      expect(screen.getByTestId("team-record")).toBeTruthy();
    });
    expect(screen.getByText(/3V 0N 1D/)).toBeTruthy();
    expect(screen.getByText(/12.5/)).toBeTruthy(); // td for-against
    const formBadges = screen.getByTestId("form-badges");
    expect(formBadges.children.length).toBe(4);
  });

  it("affiche le roster", async () => {
    mockedApi.mockResolvedValue(makeTeam());
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    await waitFor(() => {
      expect(screen.getByTestId("roster-table")).toBeTruthy();
    });
    expect(screen.getByText("Grim")).toBeTruthy();
    expect(screen.getByText("Lineman")).toBeTruthy();
    expect(screen.getByText("block")).toBeTruthy();
  });

  it("affiche placeholder roster si vide", async () => {
    mockedApi.mockResolvedValue(makeTeam({ roster: [] }));
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    await waitFor(() => {
      expect(screen.getByText(/Roster non encore peuplé/i)).toBeTruthy();
    });
  });

  it("affiche les prochains et derniers matchs", async () => {
    mockedApi.mockResolvedValue(makeTeam());
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    await waitFor(() => {
      const rows = screen.getAllByTestId("match-row");
      expect(rows.length).toBe(2);
    });
    expect(screen.getByText("Cheese Halflings")).toBeTruthy();
    expect(screen.getByText("Soaring Hawks")).toBeTruthy();
  });

  it("affiche message d'erreur si API throw", async () => {
    mockedApi.mockRejectedValue(new Error("not-found"));
    render(<ProLeagueTeamPage params={{ slug: "unknown" }} />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.getByRole("alert").textContent).toContain("not-found");
  });
});
