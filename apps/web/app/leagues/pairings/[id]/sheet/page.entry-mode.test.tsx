/**
 * Mode de saisie d'une feuille de COUPE : la saisie simplifiée est la feuille
 * de la ligue dont on RETIRE des champs — mêmes onglets, même formulaire,
 * mêmes libellés, même parcours. Seuls le forfait et les cinq types que la
 * coupe compte restent demandés.
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

const HOME = {
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
  players: [player("h1", 1, "Grok"), player("h2", 2, "Zigg")],
  journeymen: [
    {
      ...player("journeyman-home-1", 12, "Journalier"),
      position: "orc_lineman",
      cost: 50000,
    },
  ],
  starPlayersHired: [],
};
const AWAY = {
  ...HOME,
  teamId: "t2",
  name: "Elfes Noirs",
  players: [player("a1", 1, "Malek")],
  journeymen: [],
};

function sheetResponse(
  entryMode: "full" | "simplified" | undefined,
  over: Record<string, unknown> = {},
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
      ...(entryMode ? { entryMode } : {}),
    },
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
    ...over,
  };
}

function serve(response: ReturnType<typeof sheetResponse>) {
  apiRequest.mockImplementation((path: string, init?: { method?: string }) =>
    Promise.resolve(
      !init?.method || init.method === "GET" ? response : { ok: true },
    ),
  );
}

function kindOptions(): string[] {
  const select = screen.getByTestId("event-kind") as HTMLSelectElement;
  return Array.from(select.options).map((o) => o.textContent ?? "");
}

function lastBody(path: string): Record<string, unknown> {
  const call = [...apiRequest.mock.calls]
    .reverse()
    .find(([p, init]) => p === path && init?.method);
  expect(call).toBeTruthy();
  return JSON.parse((call![1] as { body: string }).body);
}

describe("feuille de coupe en saisie SIMPLIFIÉE", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    serve(sheetResponse("simplified"));
  });

  it("garde les onglets « Avant-match » et « En cours » de la saisie complète", async () => {
    render(<MatchSheetPage />);
    expect(await screen.findByTestId("tab-before")).toBeTruthy();
    expect(screen.getByTestId("tab-during")).toBeTruthy();
    expect(screen.queryByTestId("tab-after")).toBeNull();
    expect(screen.queryByTestId("tab-advancements")).toBeNull();
  });

  it("ne propose que les cinq types de la coupe, aux libellés de la ligue", async () => {
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("tab-during"));

    expect(kindOptions()).toEqual([
      "Touchdown",
      "Élimination sur Blocage",
      "Passe réussie",
      "Interception",
      "Élimination sur Agression",
    ]);
    expect(screen.queryByTestId("event-half")).toBeNull();
    expect(screen.queryByTestId("event-turn")).toBeNull();
    expect(screen.queryByTestId("event-kind-hint")).toBeNull();
  });

  it("demande la cible d'une élimination, jamais sa gravité", async () => {
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("tab-during"));
    fireEvent.change(screen.getByTestId("event-kind"), {
      target: { value: "casualty" },
    });

    expect(screen.getByTestId("event-target")).toBeTruthy();
    expect(screen.queryByTestId("event-injury-severity")).toBeNull();
  });

  it("ne demande pas le réceptionneur d'une passe", async () => {
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("tab-during"));
    fireEvent.change(screen.getByTestId("event-kind"), {
      target: { value: "pass_complete" },
    });

    expect(screen.queryByTestId("event-receiver")).toBeNull();
  });

  it("envoie une Élimination sur Agression marquée « cible sortie », sans mi-temps ni gravité", async () => {
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("tab-during"));
    fireEvent.change(screen.getByTestId("event-kind"), {
      target: { value: "aggression" },
    });
    fireEvent.change(screen.getByTestId("event-actor"), {
      target: { value: "h1" },
    });
    fireEvent.change(screen.getByTestId("event-target"), {
      target: { value: "a1" },
    });
    fireEvent.click(screen.getByTestId("add-event"));

    await waitFor(() =>
      expect(
        apiRequest.mock.calls.some(
          ([p, init]) =>
            p === "/leagues/pairings/cp-1/sheet/events" &&
            init?.method === "POST",
        ),
      ).toBe(true),
    );
    const body = lastBody("/leagues/pairings/cp-1/sheet/events");
    expect(body).toMatchObject({
      kind: "aggression",
      team: "home",
      actorPlayerId: "h1",
      targetPlayerId: "a1",
      meta: { eliminated: true },
    });
    expect(body).not.toHaveProperty("half");
    expect(body).not.toHaveProperty("turn");
    expect(body).not.toHaveProperty("injurySeverity");
  });

  it("réduit l'avant-match au forfait et n'enregistre que lui", async () => {
    render(<MatchSheetPage />);
    await screen.findByTestId("pre-match-panel");

    expect(screen.queryByTestId("weather-table-select")).toBeNull();
    expect(screen.queryByTestId("toss-winner-select")).toBeNull();
    expect(screen.queryByTestId("popularity-home")).toBeNull();
    expect(screen.queryByTestId("inducements-home")).toBeNull();
    expect(screen.queryByTestId("prayers-home")).toBeNull();

    fireEvent.click(screen.getByTestId("forfeit-home"));
    fireEvent.click(screen.getByTestId("save-pre-match"));

    await waitFor(() =>
      expect(
        apiRequest.mock.calls.some(
          ([p, init]) =>
            p === "/leagues/pairings/cp-1/sheet/pre-match" &&
            init?.method === "PATCH",
        ),
      ).toBe(true),
    );
    expect(lastBody("/leagues/pairings/cp-1/sheet/pre-match")).toEqual({
      forfeitSide: "home",
    });
  });

  it("retire le panneau des journaliers mais les garde dans les sélecteurs", async () => {
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("tab-during"));

    expect(screen.queryByTestId("journeymen-home")).toBeNull();
    const actor = screen.getByTestId("event-actor") as HTMLSelectElement;
    expect(Array.from(actor.options).map((o) => o.value)).toContain(
      "journeyman-home-1",
    );
  });

  it("ne trace aucun séparateur de mi-temps qu'aucune saisie n'a renseigné", async () => {
    serve(
      sheetResponse("simplified", {
        sheet: {
          id: "ms1",
          status: "draft",
          events: [
            {
              id: "e1",
              kind: "touchdown",
              team: "home",
              actorPlayerId: "h1",
              targetPlayerId: null,
              causeDetail: null,
              injurySeverity: null,
              meta: null,
            },
          ],
        },
      }),
    );
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("tab-during"));

    const list = await screen.findByTestId("events-list");
    expect(list.textContent).not.toContain("1re mi-temps");
  });

  it("annonce la saisie simplifiée et renvoie à l'aide", async () => {
    render(<MatchSheetPage />);
    const notice = await screen.findByTestId("cup-sheet-entry-mode");
    expect(notice.getAttribute("data-mode")).toBe("simplified");
    expect(notice.textContent).toContain("Saisie simplifiée");
    const help = screen.getByTestId("cup-sheet-entry-mode-help");
    expect(help.getAttribute("href")).toBe("/aide#saisie-de-coupe");
  });
});

describe("feuille de coupe en saisie COMPLÈTE", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("garde le formulaire complet quand le mode est « full »", async () => {
    serve(sheetResponse("full"));
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("tab-during"));

    expect(kindOptions()).toHaveLength(13);
    expect(kindOptions()).toContain("Agression");
    expect(screen.getByTestId("event-half")).toBeTruthy();
    expect(screen.getByTestId("event-turn")).toBeTruthy();
    expect(screen.getByTestId("journeymen-home")).toBeTruthy();
  });

  it("retombe sur la saisie complète quand le serveur ne sert pas le mode", async () => {
    serve(sheetResponse(undefined));
    render(<MatchSheetPage />);
    await screen.findByTestId("pre-match-panel");

    expect(screen.getByTestId("toss-winner-select")).toBeTruthy();
    const notice = screen.getByTestId("cup-sheet-entry-mode");
    expect(notice.getAttribute("data-mode")).toBe("full");
  });

  it("n'ajoute aucune marque de sortie à une agression saisie en complet", async () => {
    serve(sheetResponse("full"));
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("tab-during"));
    fireEvent.change(screen.getByTestId("event-kind"), {
      target: { value: "aggression" },
    });
    fireEvent.change(screen.getByTestId("event-actor"), {
      target: { value: "h1" },
    });
    fireEvent.click(screen.getByTestId("add-event"));

    await waitFor(() =>
      expect(
        apiRequest.mock.calls.some(
          ([p, init]) =>
            p === "/leagues/pairings/cp-1/sheet/events" &&
            init?.method === "POST",
        ),
      ).toBe(true),
    );
    const body = lastBody("/leagues/pairings/cp-1/sheet/events");
    expect(body.meta).toBeUndefined();
    expect(body.half).toBe(1);
  });

  it("affiche [Sortie] pour une agression marquée sans gravité, saisie en simplifié", async () => {
    serve(
      sheetResponse("full", {
        sheet: {
          id: "ms1",
          status: "draft",
          events: [
            {
              id: "e1",
              kind: "aggression",
              team: "home",
              actorPlayerId: "h1",
              targetPlayerId: "a1",
              causeDetail: null,
              injurySeverity: null,
              meta: { eliminated: true },
            },
          ],
        },
      }),
    );
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("tab-during"));

    const list = await screen.findByTestId("events-list");
    expect(list.textContent).toContain("Agression");
    expect(list.textContent).toContain("[Sortie]");
  });
});
