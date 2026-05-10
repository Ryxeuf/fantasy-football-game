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
        progression: { level: 2, spp: 10, nextLevelSpp: 16, tv: 70000 },
        statBonuses: { ma: 0, st: 0, ag: 0, pa: 0, av: 0 },
        career: { tdCount: 1, casCount: 0, compCount: 0, mvpCount: 0 },
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

  it("Lot E — affiche level / SPP progress / TV / career counters", async () => {
    mockedApi.mockResolvedValue(makeTeam());
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    await waitFor(() => {
      expect(screen.getByTestId("roster-table")).toBeTruthy();
    });
    expect(screen.getByTestId("roster-level").textContent).toBe("2");
    expect(screen.getByTestId("roster-tv").textContent).toBe("70k");
    // Progress badge contient "10/16"
    expect(screen.getByText("10/16")).toBeTruthy();
    // Career counters tdCount/casCount/compCount/mvpCount
    expect(screen.getByText("1/0/0/0")).toBeTruthy();
  });

  it("Lot E — affiche les stat bonuses quand non-zero", async () => {
    mockedApi.mockResolvedValue(
      makeTeam({
        roster: [
          {
            id: "p1",
            name: "Star",
            position: "Catcher",
            ma: 8,
            st: 2,
            ag: 4,
            pa: null,
            av: 8,
            skills: ["dodge"],
            status: "active",
            form: 70,
            niggling: 0,
            progression: { level: 5, spp: 80, nextLevelSpp: 176, tv: 130000 },
            statBonuses: { ma: 1, st: 0, ag: 1, pa: 0, av: 0 },
            career: { tdCount: 12, casCount: 1, compCount: 3, mvpCount: 2 },
          },
        ],
      }),
    );
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    await waitFor(() => {
      expect(screen.getByTestId("roster-table")).toBeTruthy();
    });
    expect(screen.getByTestId("roster-bonuses").textContent).toBe("+1MA +1AG");
  });

  it("Lot E — legend (nextLevelSpp=null) affiche ⭐ + total SPP", async () => {
    mockedApi.mockResolvedValue(
      makeTeam({
        roster: [
          {
            id: "p1",
            name: "Legend",
            position: "Blitzer",
            ma: 7,
            st: 4,
            ag: 4,
            pa: 4,
            av: 10,
            skills: ["block", "dodge", "tackle"],
            status: "active",
            form: 80,
            niggling: 0,
            progression: { level: 7, spp: 200, nextLevelSpp: null, tv: 180000 },
            statBonuses: { ma: 0, st: 1, ag: 0, pa: 0, av: 0 },
            career: { tdCount: 30, casCount: 10, compCount: 0, mvpCount: 5 },
          },
        ],
      }),
    );
    render(<ProLeagueTeamPage params={{ slug: "buf-snow-ogres" }} />);
    await waitFor(() => {
      expect(screen.getByTestId("roster-table")).toBeTruthy();
    });
    expect(screen.getByText(/⭐ 200 SPP/)).toBeTruthy();
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
