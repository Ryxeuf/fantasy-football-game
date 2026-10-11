/**
 * Coupe — régime des coups de pouce sur la feuille. En `build`, les coups de
 * pouce achetés à la création sont RAPPELÉS dans l'en-tête de chaque équipe
 * (deux modes de saisie) et l'avant-match n'en vend aucun ; en `none`, pas
 * d'éditeur ; en `match`, l'avant-match reste celui d'avant.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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

function player(id: string, number: number, name: string) {
  return {
    id,
    number,
    name,
    position: "lineman",
    positionName: "Trois-quart",
    dead: false,
    missNextMatch: false,
    spp: 0,
  };
}

function star(side: "home" | "away", slug: string, name: string) {
  return {
    id: `star-${side}-${slug}`,
    number: 81,
    name,
    position: "star_player",
    positionName: "Star Player",
    slug,
    cost: 380_000,
    registered: true,
  };
}

const HOME = {
  teamId: "t1",
  name: "Humains du Gouffre",
  roster: "human",
  logoUrl: null,
  ruleset: "season_3",
  format: "bb11",
  coachName: "Coach A",
  teamValue: 1000,
  currentValue: 1000,
  treasury: 0,
  players: [player("h1", 1, "Grok")],
  journeymen: [],
  starPlayersHired: [star("home", "morg_n_thorg", "Morg 'n' Thorg")],
};
const AWAY = {
  ...HOME,
  teamId: "t2",
  name: "Gobelins",
  roster: "goblin",
  players: [player("a1", 1, "Malek")],
  starPlayersHired: [star("away", "bomber_dribblesnot", "Bomber Dribblesnot")],
};

function sheetResponse(
  entryMode: "full" | "simplified",
  inducementMode?: "build" | "match" | "none",
) {
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
    competitionKind: "cup",
    competitionRules: {
      sppEnabled: false,
      resurrection: true,
      entryMode,
      ...(inducementMode ? { inducementMode } : {}),
    },
    leagueId: "cup-9",
    leagueName: "Coupe du Gouffre",
    teams:
      inducementMode === "build"
        ? {
            home: {
              ...HOME,
              registeredInducements: [
                { slug: "team_mascot", name: "Mascotte d'Équipe", quantity: 1, unitCost: 25_000 },
                { slug: "bloodweiser_kegs", name: "Fûts de Blitz Premium", quantity: 2, unitCost: 50_000 },
              ],
            },
            away: { ...AWAY, registeredInducements: [] },
          }
        : { home: HOME, away: AWAY },
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
  };
}

function serve(response: ReturnType<typeof sheetResponse>) {
  apiRequest.mockReset();
  apiRequest.mockImplementation((_path: string, init?: { method?: string }) =>
    Promise.resolve(
      !init?.method || init.method === "GET" ? response : { ok: true },
    ),
  );
}

function preMatchBody(): Record<string, unknown> {
  const call = [...apiRequest.mock.calls]
    .reverse()
    .find(([p, init]) => String(p).endsWith("/sheet/pre-match") && init?.method);
  expect(call).toBeTruthy();
  return JSON.parse((call as [string, { body: string }])[1].body);
}

describe.each(["full", "simplified"] as const)(
  "coupe en build, saisie %s",
  (entryMode) => {
    beforeEach(() => serve(sheetResponse(entryMode, "build")));

    it("rappelle les coups de pouce de chaque équipe dans l'en-tête", async () => {
      render(<MatchSheetPage />);
      expect(
        (await screen.findByTestId("registered-inducements-home")).textContent,
      ).toMatch(/Mascotte d'Équipe ×1 · Fûts de Blitz Premium ×2/);
      expect(
        screen.getByTestId("registered-inducements-away").textContent,
      ).toMatch(/Aucun coup de pouce/);
    });
  },
);

describe("coupe en build, saisie complète — avant-match", () => {
  beforeEach(() => serve(sheetResponse("full", "build")));

  it("ne propose aucun éditeur de coups de pouce et n'envoie aucune sélection", async () => {
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("tab-before"));
    expect(screen.queryByTestId("inducements-home")).toBeNull();
    expect(screen.queryByTestId("inducements-away")).toBeNull();

    fireEvent.click(screen.getByTestId("save-pre-match"));
    await waitFor(() => expect(preMatchBody()).toBeTruthy());
    expect(preMatchBody()).not.toHaveProperty("inducementsHome");
    expect(preMatchBody()).not.toHaveProperty("inducementsAway");
  });
});

describe("coupe sans coups de pouce (none)", () => {
  beforeEach(() => serve(sheetResponse("full", "none")));

  it("aucun éditeur, aucun rappel", async () => {
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("tab-before"));
    expect(screen.queryByTestId("inducements-home")).toBeNull();
    expect(screen.queryByTestId("registered-inducements-home")).toBeNull();
  });
});

describe("coupe en match (ou serveur antérieur)", () => {
  it.each([["match" as const], [undefined]])(
    "garde l'éditeur d'avant-match (%s)",
    async (mode) => {
      serve(sheetResponse("full", mode));
      render(<MatchSheetPage />);
      fireEvent.click(await screen.findByTestId("tab-before"));
      expect(screen.getByTestId("inducements-home")).toBeTruthy();
      expect(screen.queryByTestId("registered-inducements-home")).toBeNull();
    },
  );
});
