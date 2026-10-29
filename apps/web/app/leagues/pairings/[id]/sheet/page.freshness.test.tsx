/**
 * Feuille de match — « version du match » périmée : une autre feuille d'une
 * des deux équipes a été validée après l'ouverture de celle-ci (retour
 * testeur : une J3 ouverte avant la validation de la J2). La feuille le dit
 * et se met à jour d'un clic tant que personne n'a soumis.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "pair-j3" }),
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

const STALE = {
  home: {
    pairingId: "pair-j2",
    kind: "validated",
    at: "2026-09-20T12:00:00.000Z",
    roundLabel: "journée 2",
    homeTeamName: "Orques de Gouffre",
    awayTeamName: "Nains",
  },
  away: null,
};

describe("feuille de match — version du match périmée", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("annonce la rencontre validée depuis et met la feuille à jour d'un clic", async () => {
    apiRequest.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve({ id: "ms1" });
      return Promise.resolve(
        sheetResponse({
          viewerRole: "home",
          snapshotFreshness: { ...STALE, refreshable: true },
        }),
      );
    });
    render(<MatchSheetPage />);

    const notice = await screen.findByTestId("sheet-snapshot-stale");
    expect(notice.textContent).toContain("journée 2");
    expect(notice.textContent).toContain("Orques de Gouffre");
    fireEvent.click(screen.getByTestId("sheet-refresh"));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/leagues/pairings/pair-j3/sheet/refresh",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("feuille déjà soumise : l'alerte reste, sans bouton, avec la marche à suivre", async () => {
    apiRequest.mockResolvedValue(
      sheetResponse({
        viewerRole: "home",
        sheet: { id: "ms1", status: "submitted_home", events: [] },
        snapshotFreshness: { ...STALE, refreshable: false },
      }),
    );
    render(<MatchSheetPage />);

    const notice = await screen.findByTestId("sheet-snapshot-stale");
    expect(notice.textContent).toMatch(/retirez les soumissions/);
    expect(screen.queryByTestId("sheet-refresh")).toBeNull();
  });

  it("gel à jour : un bouton discret, sans alerte", async () => {
    apiRequest.mockResolvedValue(
      sheetResponse({
        viewerRole: "home",
        snapshotFreshness: { home: null, away: null, refreshable: true },
      }),
    );
    render(<MatchSheetPage />);

    expect(await screen.findByTestId("sheet-refresh-idle")).toBeTruthy();
    expect(screen.queryByTestId("sheet-snapshot-stale")).toBeNull();
  });

  it("serveur antérieur (ou coupe) : ni alerte ni bouton", async () => {
    apiRequest.mockResolvedValue(sheetResponse({ viewerRole: "home" }));
    render(<MatchSheetPage />);

    await screen.findByTestId("match-sheet");
    expect(screen.queryByTestId("sheet-refresh")).toBeNull();
  });
});
