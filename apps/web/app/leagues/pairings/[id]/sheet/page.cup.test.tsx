/**
 * Feuille de match d'une COUPE : la même page que celle des ligues, servie
 * par les mêmes routes, mais sans les phases d'après-match — une coupe se
 * joue en résurrection et n'écrit rien sur les équipes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "cp-1" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

const apiRequest = vi.fn();
vi.mock("../../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  ApiClientError: class ApiClientError extends Error {
    constructor(
      message: string,
      public readonly status: number,
    ) {
      super(message);
    }
  },
}));

import MatchSheetPage from "./page";

const TEAM = {
  teamId: "t1",
  name: "Orques de Gouffre",
  roster: "orc",
  logoUrl: null,
  ruleset: "season_3",
  format: "bb11",
  coachName: "Coach A",
  teamValue: 1000,
  currentValue: 1000,
  treasury: 0,
  players: [],
  journeymen: [],
  starPlayersHired: [],
};

function sheetResponse(over: Record<string, unknown> = {}) {
  return {
    sheet: { id: "ms1", status: "draft", events: [] },
    summary: {
      scoreHome: 0,
      scoreAway: 0,
      casualtiesHome: 0,
      casualtiesAway: 0,
      injuries: [],
      playerStats: [],
    },
    viewerRole: "commissioner",
    viewerTeamId: null,
    teams: { home: TEAM, away: { ...TEAM, teamId: "t2", name: "Elfes Noirs" } },
    reference: {
      weatherTables: [],
      inducements: { home: [], away: [] },
      starPlayers: { home: [], away: [] },
      budget: {
        home: { ctv: 0, treasury: 0, pettyCash: 0, maxBudget: 0 },
        away: { ctv: 0, treasury: 0, pettyCash: 0, maxBudget: 0 },
      },
      purchases: {},
      colors: {
        home: { primary: "#000000", secondary: "#ffffff" },
        away: { primary: "#111111", secondary: "#eeeeee" },
      },
    },
    computedSpp: {},
    hateRolls: [],
    ...over,
  };
}

describe("feuille de match — compétition d'origine", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("renvoie vers la COUPE et annonce le mode résurrection", async () => {
    apiRequest.mockResolvedValue(
      sheetResponse({
        competitionKind: "cup",
        leagueId: "cup-9",
        leagueName: "NAF World Cup",
      }),
    );
    render(<MatchSheetPage />);

    const back = await screen.findByTestId("back-to-league");
    expect(back.getAttribute("href")).toBe("/cups/cup-9");
    expect(back.textContent).toContain("Retour à la coupe");
    expect(screen.getByTestId("cup-sheet-notice")).toBeTruthy();
  });

  it("masque « Fin du match » et « Évolutions » en coupe", async () => {
    apiRequest.mockResolvedValue(
      sheetResponse({ competitionKind: "cup", leagueId: "cup-9" }),
    );
    render(<MatchSheetPage />);

    await screen.findByTestId("tab-during");
    expect(screen.queryByTestId("tab-after")).toBeNull();
    expect(screen.queryByTestId("tab-advancements")).toBeNull();
  });

  it("garde les quatre phases et le retour ligue hors coupe", async () => {
    apiRequest.mockResolvedValue(
      sheetResponse({
        competitionKind: "league",
        leagueId: "lg-1",
        leagueName: "Ma Ligue",
      }),
    );
    render(<MatchSheetPage />);

    const back = await screen.findByTestId("back-to-league");
    expect(back.getAttribute("href")).toBe("/leagues/lg-1");
    expect(screen.getByTestId("tab-after")).toBeTruthy();
    expect(screen.getByTestId("tab-advancements")).toBeTruthy();
    expect(screen.queryByTestId("cup-sheet-notice")).toBeNull();
  });

  it("retombe sur la ligue quand le serveur ne sert pas encore la compétition", async () => {
    apiRequest.mockResolvedValue(sheetResponse({ leagueId: "lg-1" }));
    render(<MatchSheetPage />);

    await waitFor(() =>
      expect(screen.getByTestId("back-to-league").getAttribute("href")).toBe(
        "/leagues/lg-1",
      ),
    );
    expect(screen.getByTestId("tab-after")).toBeTruthy();
  });
});
