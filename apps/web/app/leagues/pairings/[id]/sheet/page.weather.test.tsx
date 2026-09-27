/**
 * Feuille de match — la météo saisie à l'avant-match est rappelée dans
 * l'onglet « En cours », avec un rappel ciblé sur les passes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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
const SKELETON = "undead_trois_quart_squelette";

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
          injurySeverity: "dead",
        },
      ],
    },
    summary: {
      scoreHome: 0,
      scoreAway: 0,
      casualtiesHome: 1,
      casualtiesAway: 0,
      injuries: [{ playerId: "a1", severity: "dead", side: "away" }],
      playerStats: [],
    },
    competitionKind: "league",
    leagueId: "lg-1",
    leagueName: "Ligue des Morts",
    viewerRole: "commissioner",
    viewerTeamId: null,
    teams: {
      home: {
        ...UNDEAD,
        raiseDead: {
          victims: [
            {
              id: "a1",
              number: 1,
              name: "Grommit",
              positionName: "Trois-quart",
            },
          ],
          positions: [
            { slug: SKELETON, name: "Trois-quart Squelette" },
            { slug: ZOMBIE, name: "Trois-quart Zombie" },
          ],
          choice: null,
          canHire: true,
        },
        raisedDead: null,
      },
      away: HUMANS,
    },
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

const WEATHER_TABLES = [
  {
    id: "classique",
    name: "Classique",
    results: [
      { roll: 3, condition: "Très ensoleillé", description: "Soleil aveuglant." },
      { roll: 7, condition: "Conditions parfaites", description: "Idéal." },
    ],
  },
];

function withWeather(weather: string, events: unknown[] = []) {
  const base = sheetResponse();
  return sheetResponse({
    sheet: {
      ...base.sheet,
      weatherTable: "classique",
      weather,
      events,
    },
    reference: { ...base.reference, weatherTables: WEATHER_TABLES },
  });
}

describe("feuille de match — rappel météo pendant la saisie", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("affiche la météo d'avant-match et son effet sur les passes", async () => {
    apiRequest.mockResolvedValue(withWeather("Très ensoleillé"));
    render(<MatchSheetPage />);

    fireEvent.click(await screen.findByTestId("tab-during"));
    expect(screen.getByTestId("weather-reminder").textContent).toContain(
      "Météo : Très ensoleillé",
    );
    expect(screen.getByTestId("weather-reminder-effects").textContent).toContain(
      "-1 aux tests de Capacité de Passe",
    );

    // Touchdown par défaut : aucun rappel ciblé.
    expect(screen.queryByTestId("event-weather-hint")).toBeNull();
    fireEvent.change(screen.getByTestId("event-kind"), {
      target: { value: "pass_complete" },
    });
    expect(screen.getByTestId("event-weather-hint").textContent).toContain(
      "-1 à la passe",
    );
  });

  it("invite à relancer la météo après un coup d'envoi « Météo capricieuse »", async () => {
    apiRequest.mockResolvedValue(
      withWeather("Conditions parfaites", [
        {
          id: "ko-1",
          kind: "kickoff",
          team: null,
          actorPlayerId: null,
          targetPlayerId: null,
          injurySeverity: null,
          meta: { half: 1, turn: 4, kickoffEvent: "changing-weather" },
        },
      ]),
    );
    render(<MatchSheetPage />);

    fireEvent.click(await screen.findByTestId("tab-during"));
    expect(screen.getByTestId("weather-reminder-changed").textContent).toContain(
      "(MT 1, T4)",
    );
    fireEvent.click(screen.getByTestId("weather-reminder-edit"));
    expect(screen.getByTestId("weather-select")).toBeTruthy();
  });
});
