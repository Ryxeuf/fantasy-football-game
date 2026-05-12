/**
 * Tests de la page joueur pro-league.
 *
 * Focus Q.A.1 : section "Career" rendue quand le snapshot est fourni
 * par l'API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import PlayerPage from "./page";

const originalFetch = global.fetch;

const detailFixture = {
  id: "p1",
  name: "Grott Steelfist",
  position: "Lineman",
  status: "active",
  form: 65,
  niggling: 0,
  skills: ["block"],
  stats: { ma: 5, st: 3, ag: 3, pa: 4, av: 10 },
  statBonuses: { ma: 0, st: 0, ag: 0, pa: 0, av: 0 },
  progression: {
    level: 3,
    spp: 32,
    nextLevelSpp: 51,
    readyToLevelUp: false,
    tv: 70000,
  },
  career: { tdCount: 5, casCount: 3, compCount: 2, mvpCount: 1 },
  skillAccess: { primary: ["G", "S"], secondary: ["A"] },
  team: {
    slug: "pit-smashers",
    name: "Smashers",
    city: "Pittsburgh",
    race: "Orc",
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
  topNemesisTeamId: "nemesis-team",
  topVictoryTeamId: "easy-team",
  streakKind: "win" as const,
  streakLength: 3,
  recomputedAt: "2026-05-17T10:00:00Z",
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

function chain(detail: any, history: any, career: any | null) {
  const fetchMock = vi.fn();
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => detail,
  } as unknown as Response);
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => history,
  } as unknown as Response);
  if (career !== null) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ snapshot: career }),
    } as unknown as Response);
  } else {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "not found" }),
    } as unknown as Response);
  }
  return fetchMock;
}

describe("PlayerPage career section", () => {
  it("affiche la section career quand le snapshot est present", async () => {
    global.fetch = chain(detailFixture, { matches: [] }, careerFixture) as unknown as typeof fetch;

    render(<PlayerPage params={{ slug: "pit-smashers", playerId: "p1" }} />);

    await waitFor(() => {
      expect(screen.getByTestId("player-career-snapshot")).toBeTruthy();
    });
    expect(screen.getByText("50")).toBeTruthy();
    expect(screen.getByTestId("career-streak").textContent).toMatch(/3 wins/);
  });

  it("affiche nemesis et souffre-douleur quand fournis", async () => {
    global.fetch = chain(detailFixture, { matches: [] }, careerFixture) as unknown as typeof fetch;

    render(<PlayerPage params={{ slug: "pit-smashers", playerId: "p1" }} />);

    await waitFor(() => {
      expect(screen.getByTestId("career-nemesis")).toBeTruthy();
    });
    expect(screen.getByTestId("career-nemesis").textContent).toMatch(/nemesis-team/);
    expect(screen.getByTestId("career-victory").textContent).toMatch(/easy-team/);
  });

  it("masque la section career quand l'API echoue", async () => {
    global.fetch = chain(detailFixture, { matches: [] }, null) as unknown as typeof fetch;

    render(<PlayerPage params={{ slug: "pit-smashers", playerId: "p1" }} />);

    // Attend que la page se charge (le detail s'affiche)
    await waitFor(() => {
      expect(screen.getByText(detailFixture.name)).toBeTruthy();
    });
    expect(screen.queryByTestId("player-career-snapshot")).toBeNull();
  });

  it("affiche le lien vers le best match", async () => {
    global.fetch = chain(detailFixture, { matches: [] }, careerFixture) as unknown as typeof fetch;

    render(<PlayerPage params={{ slug: "pit-smashers", playerId: "p1" }} />);

    await waitFor(() => {
      expect(screen.getByTestId("career-best-match")).toBeTruthy();
    });
    const link = screen.getByTestId("career-best-match").querySelector("a");
    expect(link?.getAttribute("href")).toBe("/pro-league/matches/m-best");
  });

  it("affiche streak=none quand pas de matchs", async () => {
    global.fetch = chain(
      detailFixture,
      { matches: [] },
      {
        ...careerFixture,
        matchesPlayed: 0,
        sppTotal: 0,
        streakKind: "none" as const,
        streakLength: 0,
        bestMatchId: null,
        worstMatchId: null,
        topNemesisTeamId: null,
        topVictoryTeamId: null,
      },
    ) as unknown as typeof fetch;

    render(<PlayerPage params={{ slug: "pit-smashers", playerId: "p1" }} />);

    await waitFor(() => {
      expect(screen.getByTestId("career-streak").textContent).toMatch(/—/);
    });
  });
});
