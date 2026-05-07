/**
 * Sprint Pro League lot 1.C.1 — Tests page hub.
 *
 * Mocke `apiRequest` pour contrôler la donnée injectée et valider
 * les états (loading, erreur, pas de saison, hub complet).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../lib/api-client", () => ({
  apiRequest: vi.fn(),
  ApiClientError: class ApiClientError extends Error {},
}));

import { apiRequest } from "../lib/api-client";
import { LanguageProvider } from "../contexts/LanguageContext";
import ProLeagueHubPage from "./page";

function renderWithLang(): ReturnType<typeof render> {
  return render(
    <LanguageProvider>
      <ProLeagueHubPage />
    </LanguageProvider>,
  );
}

const mockedApi = vi.mocked(apiRequest);

function makeHubData(overrides: Record<string, unknown> = {}): unknown {
  return {
    league: {
      slug: "old-world-league",
      name: "Old World League",
      description: null,
      branding: { motto: "Where Legends Are Smashed" },
    },
    season: {
      id: "s_2026",
      year: 2026,
      status: "in_progress",
      engineVer: "0.13.0",
      startsAt: null,
      endsAt: null,
    },
    currentRound: {
      id: "r_3",
      roundNumber: 3,
      status: "pending",
      scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
    nextMatches: [
      {
        id: "m_1",
        roundNumber: 3,
        status: "scheduled",
        scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
        scoreHome: null,
        scoreAway: null,
        outcome: null,
        homeTeam: {
          slug: "pit-smashers",
          name: "Smashers",
          city: "Pittsburgh",
          primaryColor: "#000000",
          secondaryColor: "#FFB612",
        },
        awayTeam: {
          slug: "kc-soaring-hawks",
          name: "Soaring Hawks",
          city: "Kansas City",
          primaryColor: "#E31837",
          secondaryColor: "#FFB81C",
        },
      },
    ],
    standings: [
      {
        teamSlug: "buf-snow-ogres",
        teamName: "Snow Ogres",
        teamCity: "Buffalo",
        played: 3,
        wins: 3,
        draws: 0,
        losses: 0,
        points: 9,
        tdFor: 8,
        tdAgainst: 2,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProLeagueHubPage — sprint 1.C.1", () => {
  it("affiche 'Chargement…' pendant le fetch", () => {
    mockedApi.mockReturnValue(new Promise(() => undefined));
    renderWithLang();
    expect(screen.getByText(/Chargement/)).toBeTruthy();
  });

  it("affiche le titre + motto une fois la donnée chargée", async () => {
    mockedApi.mockResolvedValue(makeHubData());
    renderWithLang();
    await waitFor(() => {
      expect(screen.getByText("Old World League")).toBeTruthy();
    });
    expect(
      screen.getByText(/Where Legends Are Smashed/i),
    ).toBeTruthy();
    expect(screen.getByText(/Saison 2026/i)).toBeTruthy();
  });

  it("affiche le current round", async () => {
    mockedApi.mockResolvedValue(makeHubData());
    renderWithLang();
    await waitFor(() => {
      expect(screen.getByTestId("current-round")).toBeTruthy();
    });
    // "Round 3" apparaît à la fois dans le current-round et dans une
    // match card → on attend ≥1 match.
    expect(screen.getAllByText(/Round 3/i).length).toBeGreaterThanOrEqual(1);
  });

  it("affiche les match cards avec noms équipes", async () => {
    mockedApi.mockResolvedValue(makeHubData());
    renderWithLang();
    await waitFor(() => {
      expect(screen.getByTestId("match-card")).toBeTruthy();
    });
    expect(screen.getByText("Smashers")).toBeTruthy();
    expect(screen.getByText("Soaring Hawks")).toBeTruthy();
  });

  it("affiche le classement avec points", async () => {
    mockedApi.mockResolvedValue(makeHubData());
    renderWithLang();
    await waitFor(() => {
      expect(screen.getByTestId("standings-table")).toBeTruthy();
    });
    expect(screen.getByText("Snow Ogres")).toBeTruthy();
    expect(screen.getByText("9")).toBeTruthy();
  });

  it("affiche un message si aucune saison active", async () => {
    mockedApi.mockResolvedValue(
      makeHubData({ season: null, currentRound: null, nextMatches: [], standings: [] }),
    );
    renderWithLang();
    await waitFor(() => {
      expect(screen.getByText(/Aucune saison active/i)).toBeTruthy();
    });
  });

  it("affiche un message d'erreur si l'API throw", async () => {
    mockedApi.mockRejectedValue(new Error("boom"));
    renderWithLang();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.getByRole("alert").textContent).toContain("boom");
  });

  it("affiche un placeholder dans la table de classement si vide", async () => {
    mockedApi.mockResolvedValue(makeHubData({ standings: [] }));
    renderWithLang();
    await waitFor(() => {
      expect(
        screen.getByText(/classement apparaîtra/i),
      ).toBeTruthy();
    });
  });
});
