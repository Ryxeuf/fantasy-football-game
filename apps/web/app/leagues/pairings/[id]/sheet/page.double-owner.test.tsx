/**
 * Un coach possède les DEUX équipes de la rencontre : la feuille lui demande
 * pour quelle équipe il saisit (« Je saisis pour : … », persisté dans
 * `?side=`), et la soumission / son retrait partent PAR CÔTÉ.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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
  currentValue: 1_000_000,
  treasury: 0,
  players: [],
  journeymen: [],
};

function sheetResponse(
  viewerSides: ReadonlyArray<"home" | "away">,
  status = "draft",
) {
  return {
    sheet: { id: "ms1", status, events: [] },
    summary: {
      scoreHome: 0,
      scoreAway: 0,
      casualtiesHome: 0,
      casualtiesAway: 0,
      injuries: [],
      playerStats: [],
    },
    viewerRole: "home",
    viewerTeamId: "t1",
    viewerSides,
    competitionKind: "league",
    competitionRules: {},
    leagueId: "L1",
    leagueName: "Ligue",
    teams: {
      home: { ...TEAM, teamId: "t1", name: "Rouges" },
      away: { ...TEAM, teamId: "t2", name: "Bleus" },
    },
    reference: {
      weatherTables: [],
      inducements: { home: [], away: [] },
      starPlayers: { home: [], away: [] },
      budget: {
        home: { ctv: 1, treasury: 0, pettyCash: 0, maxBudget: 0 },
        away: { ctv: 1, treasury: 0, pettyCash: 0, maxBudget: 0 },
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

function serve(response: ReturnType<typeof sheetResponse>) {
  apiRequest.mockReset();
  apiRequest.mockImplementation((_path: string, init?: { method?: string }) =>
    Promise.resolve(!init?.method || init.method === "GET" ? response : { ok: true }),
  );
}

function lastBody(suffix: string): Record<string, unknown> | null {
  const call = [...apiRequest.mock.calls]
    .reverse()
    .find(([p, init]) => String(p).endsWith(suffix) && init?.method === "POST");
  return call ? JSON.parse((call as [string, { body: string }])[1].body) : null;
}

beforeEach(() => {
  window.history.replaceState(null, "", "/leagues/pairings/lp-1/sheet");
});

describe("feuille — double propriétaire", () => {
  it("propose « Je saisis pour » et soumet le côté choisi", async () => {
    serve(sheetResponse(["home", "away"]));
    render(<MatchSheetPage />);
    expect(await screen.findByTestId("sheet-side-selector")).toBeTruthy();
    // Par défaut : domicile.
    fireEvent.click(screen.getByTestId("submit-sheet"));
    await waitFor(() => expect(lastBody("/sheet/submit")).toEqual({ side: "home" }));

    // Bascule sur l'extérieur : l'URL porte le choix, la feuille se relit.
    fireEvent.click(screen.getByTestId("sheet-side-away"));
    expect(window.location.search).toBe("?side=away");
    await waitFor(() =>
      expect(
        apiRequest.mock.calls.some(([p]) =>
          String(p).endsWith("/sheet?side=away"),
        ),
      ).toBe(true),
    );
    const submitBtn = await screen.findByTestId("submit-sheet");
    expect(submitBtn.textContent).toContain("Bleus");
    fireEvent.click(submitBtn);
    await waitFor(() => expect(lastBody("/sheet/submit")).toEqual({ side: "away" }));
    fireEvent.click(await screen.findByTestId("unsubmit-sheet"));
    await waitFor(() =>
      expect(lastBody("/sheet/unsubmit")).toEqual({ side: "away" }),
    );
  });

  it("relit le côté depuis l'URL au chargement", async () => {
    window.history.replaceState(null, "", "/leagues/pairings/lp-1/sheet?side=away");
    serve(sheetResponse(["home", "away"]));
    render(<MatchSheetPage />);
    expect(
      (await screen.findByTestId("sheet-side-away")).getAttribute("aria-checked"),
    ).toBe("true");
    expect(apiRequest.mock.calls[0][0]).toBe("/leagues/pairings/lp-1/sheet?side=away");
  });

  it("coach simple : pas de sélecteur, soumission de son côté", async () => {
    serve(sheetResponse(["home"]));
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("submit-sheet"));
    expect(screen.queryByTestId("sheet-side-selector")).toBeNull();
    await waitFor(() => expect(lastBody("/sheet/submit")).toEqual({ side: "home" }));
  });
});
