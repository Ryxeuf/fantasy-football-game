import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../../../lib/api-client", () => ({
  apiRequest: vi.fn(),
  ApiClientError: class ApiClientError extends Error {},
}));

vi.mock("../../../lib/use-wallet", () => ({
  useWallet: () => ({
    authed: false,
    loading: false,
    balance: 0,
    transactions: [],
    dailyAvailable: false,
    dailyNextEligibleAt: null,
    error: null,
    refresh: vi.fn(),
    claimDaily: vi.fn(),
    grantFirstTime: vi.fn(),
  }),
}));

import { apiRequest } from "../../../lib/api-client";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import ProLeagueMatchDetailPage from "./page";

const mockedApi = vi.mocked(apiRequest);

function renderPage(props: { params: { id: string } }): ReturnType<typeof render> {
  return render(
    <LanguageProvider>
      <ProLeagueMatchDetailPage {...props} />
    </LanguageProvider>,
  );
}

function makeMatch(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: "m_1",
    seasonId: "s1",
    seasonYear: 2026,
    roundNumber: 4,
    status: "completed",
    scheduledAt: new Date("2026-09-15T21:00:00Z").toISOString(),
    simulatedAt: new Date("2026-09-14T21:00:00Z").toISOString(),
    completedAt: new Date("2026-09-15T21:08:00Z").toISOString(),
    engineVer: "0.13.0",
    homeTeam: {
      slug: "buf-snow-ogres",
      name: "Snow Ogres",
      city: "Buffalo",
      race: "Ogre",
      nflFlavor: null,
      primaryColor: "#00338D",
      secondaryColor: "#C60C30",
      baseTv: 1100,
    },
    awayTeam: {
      slug: "gb-cheese-halflings",
      name: "Cheese Halflings",
      city: "Green Bay",
      race: "Halfling",
      nflFlavor: null,
      primaryColor: "#203731",
      secondaryColor: "#FFB612",
      baseTv: 700,
    },
    scoreHome: 3,
    scoreAway: 1,
    outcome: "home",
    touchdownCount: 4,
    casualtyCount: 2,
    turnoverCount: 5,
    nuffleCount: 3,
    replay: {
      durationMs: 480_000,
      highlights: [
        { type: "TD", atMs: 30_000, meta: { team: "home" } },
        { type: "CASUALTY", atMs: 60_000, meta: { causedBy: "block" } },
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProLeagueMatchDetailPage — sprint 1.C.3", () => {
  it("affiche 'Chargement…' pendant le fetch", () => {
    mockedApi.mockReturnValue(new Promise(() => undefined));
    renderPage({ params: { id: "m_1" } });
    expect(screen.getByText(/Chargement/)).toBeTruthy();
  });

  it("affiche le banner avec les noms d'équipes + saison + round", async () => {
    mockedApi.mockResolvedValue(makeMatch());
    renderPage({ params: { id: "m_1" } });
    await waitFor(() => {
      expect(screen.getByTestId("match-banner")).toBeTruthy();
    });
    expect(screen.getByTestId("home-team-name").textContent).toBe(
      "Snow Ogres",
    );
    expect(screen.getByTestId("away-team-name").textContent).toBe(
      "Cheese Halflings",
    );
    expect(screen.getByText(/Saison 2026/)).toBeTruthy();
    expect(screen.getByText(/R4/)).toBeTruthy();
  });

  it("post-match : affiche le score + counters + highlights", async () => {
    mockedApi.mockResolvedValue(makeMatch());
    renderPage({ params: { id: "m_1" } });
    await waitFor(() => {
      expect(screen.getByTestId("scoreboard")).toBeTruthy();
    });
    expect(screen.getByTestId("scoreboard").textContent).toContain("3");
    expect(screen.getByTestId("scoreboard").textContent).toContain("1");
    expect(screen.getByTestId("post-match-stats")).toBeTruthy();
    expect(screen.getByTestId("post-match-highlights")).toBeTruthy();
    expect(screen.getByText(/TOUCHDOWN HOME/i)).toBeTruthy();
  });

  it("post-match : pas de section highlights si aucun", async () => {
    mockedApi.mockResolvedValue(
      makeMatch({ replay: { durationMs: 100, highlights: [] } }),
    );
    renderPage({ params: { id: "m_1" } });
    await waitFor(() => {
      expect(screen.getByTestId("post-match-stats")).toBeTruthy();
    });
    expect(screen.queryByTestId("post-match-highlights")).toBeNull();
  });

  it("pre-match scheduled : affiche le card avec compte à rebours", async () => {
    mockedApi.mockResolvedValue(
      makeMatch({
        status: "scheduled",
        scoreHome: null,
        scoreAway: null,
        outcome: null,
        replay: null,
        touchdownCount: null,
        casualtyCount: null,
        turnoverCount: null,
        nuffleCount: null,
        scheduledAt: new Date(Date.now() + 90 * 60_000).toISOString(),
      }),
    );
    renderPage({ params: { id: "m_1" } });
    await waitFor(() => {
      expect(screen.getByTestId("pre-match-card")).toBeTruthy();
    });
    expect(screen.getByText(/Suivre en direct/i)).toBeTruthy();
    expect(screen.getByTestId("scoreboard").textContent).toContain("vs");
  });

  it("ready : affiche le card pré-simulation", async () => {
    mockedApi.mockResolvedValue(
      makeMatch({
        status: "ready",
        scoreHome: null,
        scoreAway: null,
        outcome: null,
      }),
    );
    renderPage({ params: { id: "m_1" } });
    await waitFor(() => {
      expect(screen.getByTestId("pre-match-card")).toBeTruthy();
    });
    expect(screen.getByText(/Pré-simulation faite/i)).toBeTruthy();
  });

  it("in_progress : affiche le card live", async () => {
    mockedApi.mockResolvedValue(makeMatch({ status: "in_progress" }));
    renderPage({ params: { id: "m_1" } });
    await waitFor(() => {
      expect(screen.getByTestId("live-card")).toBeTruthy();
    });
    expect(screen.getByText(/Match en cours/i)).toBeTruthy();
  });

  it("affiche message d'erreur si API throw", async () => {
    mockedApi.mockRejectedValue(new Error("not-found"));
    renderPage({ params: { id: "x" } });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.getByRole("alert").textContent).toContain("not-found");
  });
});
