/**
 * Feuille de match — Haine (X) : le panneau de fin de match sert le Mot-clé
 * retenu à l'API dédiée, et disparaît une fois la feuille validée.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "pair-1" }),
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

const ZOMBIE = "undead_trois_quart_zombie";

const UNDEAD = {
  teamId: "t1",
  name: "Champs Funestes",
  roster: "undead",
  logoUrl: null,
  ruleset: "season_3",
  format: "bb11",
  coachName: "Ombrelame",
  teamValue: 1000,
  currentValue: 1000,
  treasury: 0,
  players: [
    {
      id: "h1",
      number: 1,
      name: "Zombie 1",
      position: ZOMBIE,
      positionName: "Trois-quart Zombie",
      dead: false,
      missNextMatch: false,
      spp: 0,
    },
  ],
  journeymen: [],
  starPlayersHired: [],
};
const HUMANS = {
  ...UNDEAD,
  teamId: "t2",
  name: "Reikland",
  roster: "human",
  coachName: "Teheboq",
  players: [
    {
      id: "a1",
      number: 1,
      name: "Grommit",
      position: "human_trois_quart",
      positionName: "Trois-quart",
      dead: false,
      missNextMatch: false,
      spp: 0,
    },
  ],
};

const CANDIDATE = {
  victimPlayerId: "a1",
  side: "away",
  causerPlayerId: "h1",
  keywords: ["Humain", "Mort-Vivant", "Zombie"],
  keyword: "Humain",
  chosen: false,
};

function sheetResponse(over: Record<string, unknown> = {}) {
  return {
    sheet: {
      id: "ms1",
      status: "draft",
      events: [
        {
          id: "ev-1",
          kind: "casualty",
          team: "home",
          actorPlayerId: "h1",
          targetPlayerId: "a1",
          injurySeverity: "mng",
        },
      ],
    },
    summary: {
      scoreHome: 0,
      scoreAway: 0,
      casualtiesHome: 1,
      casualtiesAway: 0,
      injuries: [{ playerId: "a1", severity: "mng", side: "away" }],
      playerStats: [],
    },
    competitionKind: "league",
    leagueId: "lg-1",
    leagueName: "Ligue des Morts",
    viewerRole: "commissioner",
    viewerTeamId: null,
    teams: { home: UNDEAD, away: HUMANS },
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
    hateCandidates: [CANDIDATE],
    ...over,
  };
}

async function openEndOfMatchTab() {
  fireEvent.click(await screen.findByTestId("tab-after"));
}

describe("feuille de match — choix du Mot-clé haï", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("sert le Mot-clé retenu à l'API dédiée", async () => {
    apiRequest.mockResolvedValue(sheetResponse());
    render(<MatchSheetPage />);
    await openEndOfMatchTab();

    const select = await screen.findByTestId("hate-choice-select-a1");
    fireEvent.change(select, { target: { value: "Mort-Vivant" } });

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/leagues/pairings/pair-1/sheet/hate-choices",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const call = apiRequest.mock.calls.find(
      (c) => c[0] === "/leagues/pairings/pair-1/sheet/hate-choices",
    );
    expect(JSON.parse((call?.[1] as { body: string }).body)).toEqual({
      choices: [{ victimPlayerId: "a1", keyword: "Mort-Vivant" }],
    });
  });

  // Le jet a tranché : plus rien à choisir, c'est le récapitulatif qui parle.
  it("ne propose plus rien quand le serveur ne sert aucun candidat", async () => {
    apiRequest.mockResolvedValue(sheetResponse({ hateCandidates: [] }));
    render(<MatchSheetPage />);
    await openEndOfMatchTab();
    await screen.findByTestId("tab-after");
    expect(screen.queryByTestId("hate-keyword-choices")).toBeNull();
  });

  // Rétro-compat : un serveur antérieur au champ ne casse pas la page.
  it("tolère un serveur qui ne sert pas encore les candidats", async () => {
    const payload = sheetResponse();
    delete (payload as Record<string, unknown>).hateCandidates;
    apiRequest.mockResolvedValue(payload);
    render(<MatchSheetPage />);
    await openEndOfMatchTab();
    await screen.findByTestId("tab-after");
    expect(screen.queryByTestId("hate-keyword-choices")).toBeNull();
  });
});
