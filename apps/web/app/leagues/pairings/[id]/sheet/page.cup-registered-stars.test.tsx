/**
 * Coupe — un Star Player acheté à la création de l'équipe est figé dans le
 * roster d'inscription et JOUE chaque rencontre : la feuille doit le
 * proposer comme acteur et comme victime, en saisie complète comme en
 * saisie simplifiée.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

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

function sheetResponse(entryMode: "full" | "simplified") {
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
    competitionRules: { sppEnabled: false, resurrection: true, entryMode },
    leagueId: "cup-9",
    leagueName: "Coupe du Gouffre",
    teams: { home: HOME, away: AWAY },
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

function optionLabels(testId: string): string[] {
  const select = screen.getByTestId(testId) as HTMLSelectElement;
  return Array.from(select.options).map((o) => o.textContent ?? "");
}

describe.each(["full", "simplified"] as const)(
  "feuille de coupe en saisie %s — Star Players d'inscription",
  (entryMode) => {
    beforeEach(() => {
      apiRequest.mockReset();
      const response = sheetResponse(entryMode);
      apiRequest.mockImplementation(
        (_path: string, init?: { method?: string }) =>
          Promise.resolve(
            !init?.method || init.method === "GET" ? response : { ok: true },
          ),
      );
    });

    it("propose le Star Player du roster d'inscription comme acteur", async () => {
      render(<MatchSheetPage />);
      fireEvent.click(await screen.findByTestId("tab-during"));

      expect(optionLabels("event-actor")).toContain(
        "⭐ Morg 'n' Thorg — Star Player (inscrit)",
      );
    });

    it("propose le Star Player adverse comme victime d'une sortie", async () => {
      render(<MatchSheetPage />);
      fireEvent.click(await screen.findByTestId("tab-during"));
      fireEvent.change(screen.getByTestId("event-kind"), {
        target: { value: "casualty" },
      });

      expect(optionLabels("event-target")).toContain(
        "⭐ Bomber Dribblesnot — Star Player (inscrit)",
      );
    });
  },
);
