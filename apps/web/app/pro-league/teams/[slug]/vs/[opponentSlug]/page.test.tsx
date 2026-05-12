/**
 * Tests pour la page head-to-head.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import HeadToHeadPage from "./page";

const originalFetch = global.fetch;

const teamA = {
  id: "tA",
  slug: "team-a",
  city: "City A",
  name: "Athletics",
  race: "Orc",
  primaryColor: "#000",
  secondaryColor: null,
};

const teamB = {
  id: "tB",
  slug: "team-b",
  city: "City B",
  name: "Beasts",
  race: "Wood Elf",
  primaryColor: "#0f0",
  secondaryColor: null,
};

const summaryFixture = {
  teamA,
  teamB,
  record: {
    totalMatches: 4,
    winsA: 2,
    winsB: 1,
    draws: 1,
    totalTdA: 8,
    totalTdB: 5,
  },
  lastMatch: null,
  streakA: { kind: "win" as const, length: 2 },
  recentMatches: [
    {
      matchId: "m1",
      seasonYear: 2026,
      scheduledAt: null,
      homeTeamId: "tA",
      awayTeamId: "tB",
      scoreHome: 3,
      scoreAway: 1,
      outcome: "home" as const,
    },
    {
      matchId: "m2",
      seasonYear: 2026,
      scheduledAt: null,
      homeTeamId: "tB",
      awayTeamId: "tA",
      scoreHome: 0,
      scoreAway: 2,
      outcome: "away" as const,
    },
    {
      matchId: "m3",
      seasonYear: 2025,
      scheduledAt: null,
      homeTeamId: "tA",
      awayTeamId: "tB",
      scoreHome: 1,
      scoreAway: 1,
      outcome: "draw" as const,
    },
    {
      matchId: "m4",
      seasonYear: 2025,
      scheduledAt: null,
      homeTeamId: "tA",
      awayTeamId: "tB",
      scoreHome: 0,
      scoreAway: 2,
      outcome: "away" as const,
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

describe("HeadToHeadPage", () => {
  it("affiche le header avec record W-D-L", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ summary: summaryFixture }),
    } as unknown as Response) as unknown as typeof fetch;

    render(
      <HeadToHeadPage
        params={{ slug: "team-a", opponentSlug: "team-b" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("h2h-header")).toBeTruthy();
    });
    expect(screen.getByTestId("h2h-header").textContent).toMatch(
      /2 - 1 - 1/,
    );
    expect(screen.getByTestId("h2h-team-team-a")).toBeTruthy();
    expect(screen.getByTestId("h2h-team-team-b")).toBeTruthy();
  });

  it("affiche TDs cumules et streak", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ summary: summaryFixture }),
    } as unknown as Response) as unknown as typeof fetch;

    render(
      <HeadToHeadPage
        params={{ slug: "team-a", opponentSlug: "team-b" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("h2h-tds")).toBeTruthy();
    });
    expect(screen.getByTestId("h2h-tds").textContent).toMatch(/8 - 5/);
    expect(screen.getByTestId("h2h-streak").textContent).toMatch(/2 wins/);
  });

  it("affiche la liste des matchs avec badges W/D/L", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ summary: summaryFixture }),
    } as unknown as Response) as unknown as typeof fetch;

    render(
      <HeadToHeadPage
        params={{ slug: "team-a", opponentSlug: "team-b" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("h2h-matches")).toBeTruthy();
    });
    // m1 : teamA home, outcome home → W badge
    const m1 = screen.getByTestId("h2h-match-m1");
    expect(m1.textContent).toMatch(/W/);
    // m4 : teamA home, outcome away → L badge
    const m4 = screen.getByTestId("h2h-match-m4");
    expect(m4.textContent).toMatch(/L/);
    // m3 : draw → D badge
    const m3 = screen.getByTestId("h2h-match-m3");
    expect(m3.textContent).toMatch(/D/);
  });

  it("affiche message empty si recentMatches vide", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: {
          ...summaryFixture,
          record: {
            totalMatches: 0,
            winsA: 0,
            winsB: 0,
            draws: 0,
            totalTdA: 0,
            totalTdB: 0,
          },
          streakA: { kind: "none" as const, length: 0 },
          recentMatches: [],
        },
      }),
    } as unknown as Response) as unknown as typeof fetch;

    render(
      <HeadToHeadPage
        params={{ slug: "team-a", opponentSlug: "team-b" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Aucun match joue/)).toBeTruthy();
    });
  });

  it("error state quand fetch echoue", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Team not found" }),
    } as unknown as Response) as unknown as typeof fetch;

    render(
      <HeadToHeadPage
        params={{ slug: "ghost-a", opponentSlug: "team-b" }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("h2h-error")).toBeTruthy();
    });
  });
});
