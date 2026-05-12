/**
 * Tests de la page career joueur dediee.
 *
 * Couvre : counters affiches, top matches links, rivalries sections,
 * casualties counters, loading + error states, chart present quand
 * historique non vide.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import PlayerCareerPage from "./page";

const originalFetch = global.fetch;

const playerFixture = {
  id: "p1",
  name: "Grott Steelfist",
  position: "Lineman",
  team: {
    slug: "pit-smashers",
    name: "Smashers",
    city: "Pittsburgh",
    primaryColor: "#000",
  },
};

const careerFixture = {
  playerId: "p1",
  matchesPlayed: 12,
  tdTotal: 5,
  casTotal: 3,
  compTotal: 2,
  mvpTotal: 1,
  sppTotal: 50,
  bestMatchId: "m-best",
  bestMatchSpp: 14,
  worstMatchId: "m-worst",
  worstMatchSpp: 0,
  topNemesisTeamId: "nemesis-1",
  topVictoryTeamId: "easy-1",
  topMatches: [
    { matchId: "m-best", sppTotal: 14 },
    { matchId: "m2", sppTotal: 9 },
    { matchId: "m3", sppTotal: 7 },
  ],
  topNemesisIds: ["nemesis-1", "nemesis-2"],
  topVictoryIds: ["easy-1", "easy-2", "easy-3"],
  casualtiesReceived: 2,
  casualtiesDealt: 5,
  streakKind: "win" as const,
  streakLength: 3,
  recomputedAt: "2026-05-18T10:00:00Z",
};

const historyFixture = {
  matches: [
    {
      matchId: "m-recent",
      roundNumber: 5,
      scheduledAt: "2026-05-15",
      status: "completed",
      isHome: true,
      opponent: playerFixture.team,
      scoreHome: 2,
      scoreAway: 1,
      outcome: "home",
      spp: { tdCount: 1, casCount: 0, compCount: 0, mvpCount: 0, totalSpp: 3 },
    },
    {
      matchId: "m-older",
      roundNumber: 4,
      scheduledAt: "2026-05-08",
      status: "completed",
      isHome: false,
      opponent: playerFixture.team,
      scoreHome: 1,
      scoreAway: 2,
      outcome: "away",
      spp: { tdCount: 0, casCount: 1, compCount: 0, mvpCount: 0, totalSpp: 2 },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => "dummy-token",
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

function chain(player: any, career: any, history: any) {
  const fetchMock = vi.fn();
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => player,
  } as unknown as Response);
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ snapshot: career }),
  } as unknown as Response);
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => history,
  } as unknown as Response);
  return fetchMock;
}

describe("PlayerCareerPage", () => {
  it("affiche les counters principaux", async () => {
    global.fetch = chain(playerFixture, careerFixture, historyFixture) as unknown as typeof fetch;

    render(
      <PlayerCareerPage
        params={{ slug: "pit-smashers", playerId: "p1" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("career-counters")).toBeTruthy();
    });
    // Counters block doit contenir 50 (SPP total) et 12 (matchsPlayed)
    const counters = screen.getByTestId("career-counters");
    expect(counters.textContent).toMatch(/50/);
    expect(counters.textContent).toMatch(/12/);
  });

  it("affiche le timeline chart quand history non vide", async () => {
    global.fetch = chain(playerFixture, careerFixture, historyFixture) as unknown as typeof fetch;

    render(
      <PlayerCareerPage
        params={{ slug: "pit-smashers", playerId: "p1" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("spp-timeline-chart")).toBeTruthy();
    });
  });

  it("masque le chart si historique vide", async () => {
    global.fetch = chain(playerFixture, careerFixture, { matches: [] }) as unknown as typeof fetch;

    render(
      <PlayerCareerPage
        params={{ slug: "pit-smashers", playerId: "p1" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("career-counters")).toBeTruthy();
    });
    expect(screen.queryByTestId("spp-timeline-chart")).toBeNull();
  });

  it("affiche les top matches avec lien", async () => {
    global.fetch = chain(playerFixture, careerFixture, historyFixture) as unknown as typeof fetch;

    render(
      <PlayerCareerPage
        params={{ slug: "pit-smashers", playerId: "p1" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("top-match-m-best")).toBeTruthy();
    });
    const link = screen
      .getByTestId("top-match-m-best")
      .querySelector("a");
    expect(link?.getAttribute("href")).toBe("/pro-league/matches/m-best");
  });

  it("affiche les rivalries nemesis et victory", async () => {
    global.fetch = chain(playerFixture, careerFixture, historyFixture) as unknown as typeof fetch;

    render(
      <PlayerCareerPage
        params={{ slug: "pit-smashers", playerId: "p1" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("rivalries-section")).toBeTruthy();
    });
    expect(screen.getByTestId("rivalry-nemesis-nemesis-1")).toBeTruthy();
    expect(screen.getByTestId("rivalry-victory-easy-1")).toBeTruthy();
  });

  it("affiche message empty pour rivalries vides", async () => {
    global.fetch = chain(
      playerFixture,
      {
        ...careerFixture,
        topNemesisIds: [],
        topVictoryIds: [],
      },
      historyFixture,
    ) as unknown as typeof fetch;

    render(
      <PlayerCareerPage
        params={{ slug: "pit-smashers", playerId: "p1" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Aucune defaite/)).toBeTruthy();
    });
    expect(screen.getByText(/Aucune victoire/)).toBeTruthy();
  });

  it("affiche les counters casualties", async () => {
    global.fetch = chain(playerFixture, careerFixture, historyFixture) as unknown as typeof fetch;

    render(
      <PlayerCareerPage
        params={{ slug: "pit-smashers", playerId: "p1" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("casualties-received")).toBeTruthy();
    });
    expect(screen.getByTestId("casualties-received").textContent).toBe("2");
    expect(screen.getByTestId("casualties-dealt").textContent).toBe("5");
  });

  it("error state quand fetch initial echoue", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Not found" }),
    } as unknown as Response) as unknown as typeof fetch;

    render(
      <PlayerCareerPage
        params={{ slug: "pit-smashers", playerId: "p1" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("career-page-error")).toBeTruthy();
    });
  });

  it("affiche message si top matches vide", async () => {
    global.fetch = chain(
      playerFixture,
      { ...careerFixture, topMatches: [] },
      historyFixture,
    ) as unknown as typeof fetch;

    render(
      <PlayerCareerPage
        params={{ slug: "pit-smashers", playerId: "p1" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Top 5 matches/)).toBeTruthy();
    });
    expect(screen.getByText(/Pas encore assez de matchs/)).toBeTruthy();
  });
});
