/**
 * Avant-match de ligue — coups de pouce par côté et budget en direct.
 * Un coach n'envoie que SES coups de pouce (renvoyer la liste adverse
 * l'écraserait), le commissaire les deux ; l'onglet Avant-match relit la
 * feuille en fond pour que l'outsider voie les achats du favori.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "lp-1" }),
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
  roster: "human",
  logoUrl: null,
  ruleset: "season_3",
  format: "bb11",
  coachName: "Coach",
  teamValue: 1_000_000,
  treasury: 0,
  players: [],
  journeymen: [],
};

function sheetResponse(
  viewerRole: "home" | "away" | "commissioner",
  inducementsAway: unknown[] = [],
) {
  return {
    sheet: { id: "ms1", status: "draft", events: [], inducementsAway },
    summary: {
      scoreHome: 0,
      scoreAway: 0,
      casualtiesHome: 0,
      casualtiesAway: 0,
      injuries: [],
      playerStats: [],
    },
    viewerRole,
    viewerTeamId: viewerRole === "home" ? "t1" : viewerRole === "away" ? "t2" : null,
    competitionKind: "league",
    competitionRules: {},
    leagueId: "L1",
    leagueName: "Ligue",
    teams: {
      home: { ...TEAM, teamId: "t1", name: "Outsiders", currentValue: 1_000_000 },
      away: { ...TEAM, teamId: "t2", name: "Favoris", currentValue: 1_150_000 },
    },
    reference: {
      weatherTables: [],
      inducements: {
        home: [{ slug: "wizard", name: "Magicien", cost: 150_000, maxQuantity: 1 }],
        away: [{ slug: "bribe", name: "Pot-de-vin", cost: 100_000, maxQuantity: 3 }],
      },
      starPlayers: { home: [], away: [] },
      budget: {
        home: {
          ctv: 1_000_000,
          treasury: 50_000,
          pettyCash: 150_000,
          maxBudget: 200_000,
          ctvGap: 150_000,
          opponentSpent: 0,
          treasuryAllowance: 50_000,
        },
        away: { ctv: 1_150_000, treasury: 200_000, pettyCash: 0, maxBudget: 200_000 },
        favorite: "away",
      },
      purchases: {},
      colors: {
        home: { primary: "#000000", secondary: "#ffffff" },
        away: { primary: "#111111", secondary: "#eeeeee" },
      },
    },
    computedSpp: {},
    hateRolls: [],
  };
}

let current: ReturnType<typeof sheetResponse>;
function serve(response: ReturnType<typeof sheetResponse>) {
  current = response;
  apiRequest.mockReset();
  apiRequest.mockImplementation((_path: string, init?: { method?: string }) =>
    Promise.resolve(!init?.method || init.method === "GET" ? current : { ok: true }),
  );
}

function preMatchBody(): Record<string, unknown> {
  const call = [...apiRequest.mock.calls]
    .reverse()
    .find(([p, init]) => String(p).endsWith("/sheet/pre-match") && init?.method);
  expect(call).toBeTruthy();
  return JSON.parse((call as [string, { body: string }])[1].body);
}

describe("avant-match — coups de pouce par côté", () => {
  it("un coach n'envoie que ses coups de pouce", async () => {
    serve(sheetResponse("home"));
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("tab-before"));
    fireEvent.click(screen.getByTestId("save-pre-match"));
    await waitFor(() => expect(preMatchBody()).toBeTruthy());
    expect(preMatchBody()).toHaveProperty("inducementsHome");
    expect(preMatchBody()).not.toHaveProperty("inducementsAway");
  });

  it("le commissaire envoie les deux côtés", async () => {
    serve(sheetResponse("commissioner"));
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("tab-before"));
    fireEvent.click(screen.getByTestId("save-pre-match"));
    await waitFor(() => expect(preMatchBody()).toBeTruthy());
    expect(preMatchBody()).toHaveProperty("inducementsHome");
    expect(preMatchBody()).toHaveProperty("inducementsAway");
  });
});

describe("avant-match — relecture de fond", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("toutes les ~15 s, l'outsider voit les achats du favori sans perdre la page", async () => {
    serve(sheetResponse("home"));
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("tab-before"));
    expect(
      screen.getByTestId("inducements-home-budget-detail").textContent,
    ).toMatch(/= 200 k/);

    // Le favori achète un Pot-de-vin pendant que la page est ouverte.
    current = {
      ...sheetResponse("home", [
        { slug: "bribe", name: "Pot-de-vin", cost: 100_000, qty: 1 },
      ]),
    };
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    await waitFor(() =>
      expect(
        within(screen.getByTestId("inducements-away")).getByText("Pot-de-vin"),
      ).toBeTruthy(),
    );
    expect(
      screen.getByTestId("inducements-home-budget-detail").textContent,
    ).toMatch(/dépense adverse 100 k.*= 300 k/);
    // Toujours sur l'onglet Avant-match (pas d'écran de chargement).
    expect(screen.getByTestId("pre-match-panel")).toBeTruthy();
  });
});
