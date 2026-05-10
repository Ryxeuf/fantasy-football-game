import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../lib/api-client", () => ({
  apiRequest: vi.fn(),
  ApiClientError: class ApiClientError extends Error {},
}));

import { apiRequest } from "../../lib/api-client";
import { LanguageProvider } from "../../contexts/LanguageContext";
import ProLeagueStandingsPage from "./page";

const mockedApi = vi.mocked(apiRequest);

function renderPage(): ReturnType<typeof render> {
  return render(
    <LanguageProvider>
      <ProLeagueStandingsPage />
    </LanguageProvider>,
  );
}

function makeData(rows: number = 2): unknown {
  const all = [
    {
      rank: 1,
      team: {
        slug: "buf-snow-ogres",
        name: "Snow Ogres",
        city: "Buffalo",
        race: "Ogre",
        primaryColor: "#00338D",
        secondaryColor: "#C60C30",
      },
      played: 5,
      wins: 4,
      draws: 0,
      losses: 1,
      points: 12,
      tdFor: 14,
      tdAgainst: 6,
      tdDiff: 8,
      casualtiesFor: 3,
      casualtiesAgainst: 1,
      casualtiesDiff: 2,
      teamValue: 1_150_000,
      form: ["W", "W", "L", "W", "W"],
    },
    {
      rank: 2,
      team: {
        slug: "gb-cheese-halflings",
        name: "Cheese Halflings",
        city: "Green Bay",
        race: "Halfling",
        primaryColor: "#203731",
        secondaryColor: "#FFB612",
      },
      played: 5,
      wins: 0,
      draws: 1,
      losses: 4,
      points: 1,
      tdFor: 4,
      tdAgainst: 12,
      tdDiff: -8,
      casualtiesFor: 0,
      casualtiesAgainst: 5,
      casualtiesDiff: -5,
      teamValue: 1_400_000,
      form: ["L", "D", "L", "L", "L"],
    },
  ];
  return {
    leagueSlug: "old-world-league",
    seasonId: "s1",
    seasonYear: 2026,
    seasonStatus: "in_progress",
    rows: all.slice(0, rows),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProLeagueStandingsPage — sprint 1.C.5", () => {
  it("affiche 'Chargement…' pendant le fetch", () => {
    mockedApi.mockReturnValue(new Promise(() => undefined));
    renderPage();
    expect(screen.getByText(/Chargement/)).toBeTruthy();
  });

  it("affiche le titre et la saison", async () => {
    mockedApi.mockResolvedValue(makeData());
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Saison 2026/i)).toBeTruthy();
    });
  });

  it("affiche les rangs + équipes + points + diff TD", async () => {
    mockedApi.mockResolvedValue(makeData());
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("standings-table")).toBeTruthy();
    });
    expect(screen.getByText("Snow Ogres")).toBeTruthy();
    expect(screen.getByText("Cheese Halflings")).toBeTruthy();
    // Diff +8 et -8
    expect(screen.getByText("+8")).toBeTruthy();
    expect(screen.getByText("-8")).toBeTruthy();
  });

  it("affiche la forme avec 5 badges", async () => {
    mockedApi.mockResolvedValue(makeData());
    renderPage();
    await waitFor(() => {
      const badges = screen.getAllByTestId("form-badges");
      expect(badges.length).toBe(2);
    });
    const ogresBadges = screen.getAllByTestId("form-badges")[0];
    // 5 chars W/L/D
    expect(ogresBadges.children.length).toBe(5);
  });

  it("affiche placeholder si rows vide", async () => {
    mockedApi.mockResolvedValue(makeData(0));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Pas encore de matchs/i)).toBeTruthy();
    });
  });

  it("affiche message d'erreur si API throw", async () => {
    mockedApi.mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.getByRole("alert").textContent).toContain("boom");
  });

  describe("Lot I — TV column + sort by TV", () => {
    it("affiche la colonne TV avec le formatage 'Xk' par équipe", async () => {
      mockedApi.mockResolvedValue(makeData());
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId("standings-tv-header")).toBeTruthy();
      });
      expect(
        screen.getByTestId("standings-tv-buf-snow-ogres").textContent,
      ).toBe("1150k");
      expect(
        screen.getByTestId("standings-tv-gb-cheese-halflings").textContent,
      ).toBe("1400k");
    });

    it("trie par TV desc quand on click le header TV", async () => {
      mockedApi.mockResolvedValue(makeData());
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId("standings-table")).toBeTruthy();
      });
      // Default rank order : Buffalo (1150k) avant Green Bay (1400k)
      // Après click TV : Green Bay (1400k) avant Buffalo (1150k)
      const tvHeader = screen.getByTestId("standings-tv-header");
      fireEvent.click(tvHeader);
      const halflingsToOgres = screen
        .getByText("Cheese Halflings")
        .compareDocumentPosition(screen.getByText("Snow Ogres"));
      expect(halflingsToOgres & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // Re-click → retour à l'ordre rank
      fireEvent.click(tvHeader);
      const ogresToHalflings = screen
        .getByText("Snow Ogres")
        .compareDocumentPosition(screen.getByText("Cheese Halflings"));
      expect(ogresToHalflings & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("affiche '—' si teamValue=0 (équipe sans roster actif)", async () => {
      mockedApi.mockResolvedValue({
        leagueSlug: "old-world-league",
        seasonId: "s1",
        seasonYear: 2026,
        seasonStatus: "in_progress",
        rows: [
          {
            rank: 1,
            team: {
              slug: "orphan",
              name: "Orphan",
              city: "X",
              race: "X",
              primaryColor: null,
              secondaryColor: null,
            },
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            points: 0,
            tdFor: 0,
            tdAgainst: 0,
            tdDiff: 0,
            casualtiesFor: 0,
            casualtiesAgainst: 0,
            casualtiesDiff: 0,
            teamValue: 0,
            form: [],
          },
        ],
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId("standings-tv-orphan")).toBeTruthy();
      });
      expect(screen.getByTestId("standings-tv-orphan").textContent).toBe("—");
    });
  });
});
