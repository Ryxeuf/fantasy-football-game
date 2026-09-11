/**
 * Feuille de match — Maîtres de la Non-vie : le bandeau « Relever le Mort »
 * sert le choix du coach à l'API dédiée, et le relevé apparaît dans les
 * pickers d'évènements.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";

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

describe("feuille de match — Relever le Mort", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("le bandeau n'apparaît que pour l'équipe qui porte la règle, et sert le choix à l'API", async () => {
    apiRequest.mockResolvedValue(sheetResponse());
    render(<MatchSheetPage />);

    const panel = await screen.findByTestId("raise-dead-home");
    expect(panel.textContent).toContain("Champs Funestes");
    expect(screen.queryByTestId("raise-dead-away")).toBeNull();

    fireEvent.change(screen.getByTestId("raise-dead-victim-home"), {
      target: { value: "a1" },
    });
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/leagues/pairings/pair-1/sheet/raise-dead",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const call = apiRequest.mock.calls.find(
      (c) => c[0] === "/leagues/pairings/pair-1/sheet/raise-dead",
    );
    expect(JSON.parse((call?.[1] as { body: string }).body)).toEqual({
      side: "home",
      victimId: "a1",
      // Poste courant : le Trois-quart de base tant que rien n'est choisi.
      position: SKELETON,
    });
  });

  it("le relevé rejoint les pickers d'évènements et la timeline le nomme", async () => {
    const raised = {
      id: "raised-home-1",
      number: 2,
      name: "Grommit",
      position: ZOMBIE,
      positionName: "Mort relevé (Trois-quart Zombie)",
      stats: { ma: 4, st: 3, ag: 4, pa: 6, av: 9 },
      skills: "fork,instable,regeneration",
      cost: 40_000,
      victimId: "a1",
    };
    const base = sheetResponse();
    apiRequest.mockResolvedValue(
      sheetResponse({
        sheet: {
          ...base.sheet,
          events: [
            ...base.sheet.events,
            {
              id: "ev-2",
              kind: "touchdown",
              team: "home",
              actorPlayerId: "raised-home-1",
            },
          ],
        },
        teams: {
          home: {
            ...base.teams.home,
            raiseDead: {
              ...base.teams.home.raiseDead,
              choice: { victimId: "a1", position: ZOMBIE },
            },
            raisedDead: raised,
          },
          away: HUMANS,
        },
      }),
    );
    render(<MatchSheetPage />);

    await screen.findByTestId("raise-dead-raised-home");
    fireEvent.click(screen.getByTestId("tab-during"));
    const actor = await screen.findByTestId("event-actor");
    const options = within(actor)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toContain(
      "🧟 N°2 Grommit — Mort relevé (Trois-quart Zombie)",
    );
    expect(screen.getByTestId("events-list").textContent).toContain(
      "🧟 N°2 Grommit",
    );
  });
});
