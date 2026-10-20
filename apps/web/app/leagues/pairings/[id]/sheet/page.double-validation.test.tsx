/**
 * Feuille de match — double validation (réglage de coupe) : le bouton du
 * commissaire attend la soumission des deux coachs (hors forfaitaire), un
 * bandeau l'annonce, et un commissaire qui joue la rencontre peut soumettre
 * SON côté (le bouton lui était masqué).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

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

const DOUBLE = { competitionKind: "cup", leagueId: "cup-9", competitionRules: {
  sppEnabled: false,
  resurrection: true,
  entryMode: "full",
  inducementMode: "match",
  doubleValidation: true,
} };

describe("feuille de match — double validation", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("désactive le bouton du commissaire et dit quel coach manque", async () => {
    apiRequest.mockResolvedValue(
      sheetResponse({
        ...DOUBLE,
        sheet: {
          id: "ms1",
          status: "submitted_home",
          submittedByHomeAt: "2026-10-20T10:00:00.000Z",
          events: [],
        },
      }),
    );
    render(<MatchSheetPage />);

    const button = await screen.findByTestId("validate-sheet");
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("validate-sheet-pending").textContent).toContain(
      "Elfes Noirs",
    );
    expect(screen.getByTestId("sheet-double-validation-notice")).toBeTruthy();
  });

  it("active le bouton une fois les deux soumissions faites", async () => {
    apiRequest.mockResolvedValue(
      sheetResponse({
        ...DOUBLE,
        sheet: {
          id: "ms1",
          status: "both_submitted",
          submittedByHomeAt: "2026-10-20T10:00:00.000Z",
          submittedByAwayAt: "2026-10-20T11:00:00.000Z",
          events: [],
        },
      }),
    );
    render(<MatchSheetPage />);

    const button = await screen.findByTestId("validate-sheet");
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId("validate-sheet-pending")).toBeNull();
  });

  it("n'attend pas le coach forfaitaire", async () => {
    apiRequest.mockResolvedValue(
      sheetResponse({
        ...DOUBLE,
        sheet: {
          id: "ms1",
          status: "submitted_home",
          submittedByHomeAt: "2026-10-20T10:00:00.000Z",
          forfeitSide: "away",
          events: [],
        },
      }),
    );
    render(<MatchSheetPage />);

    const button = await screen.findByTestId("validate-sheet");
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("sans l'option, le commissaire valide sans attendre (historique)", async () => {
    apiRequest.mockResolvedValue(
      sheetResponse({ competitionKind: "cup", leagueId: "cup-9" }),
    );
    render(<MatchSheetPage />);

    const button = await screen.findByTestId("validate-sheet");
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId("sheet-double-validation-notice")).toBeNull();
  });

  it("un commissaire qui joue la rencontre peut soumettre son côté", async () => {
    apiRequest.mockResolvedValue(
      sheetResponse({ ...DOUBLE, viewerRole: "commissioner", viewerTeamId: "t1" }),
    );
    render(<MatchSheetPage />);

    expect(await screen.findByTestId("submit-sheet")).toBeTruthy();
    expect(screen.getByTestId("unsubmit-sheet")).toBeTruthy();
    expect(screen.getByTestId("validate-sheet")).toBeTruthy();
  });

  it("un commissaire qui ne joue pas n'a pas de bouton de soumission", async () => {
    apiRequest.mockResolvedValue(sheetResponse(DOUBLE));
    render(<MatchSheetPage />);

    await screen.findByTestId("validate-sheet");
    expect(screen.queryByTestId("submit-sheet")).toBeNull();
  });
});
