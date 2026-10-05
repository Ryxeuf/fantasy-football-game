import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeaguePredictionsSummary } from "./LeaguePredictionsSummary";
import {
  makeBoard,
  makeEntry,
  makePairing,
  makeRound,
  makeView,
} from "../_components/predictions.fixtures";
import type {
  SeasonPredictionLeaderboardView,
  SeasonPredictionsView,
} from "../_components/predictions";

function renderSummary(
  view: SeasonPredictionsView | null,
  board: SeasonPredictionLeaderboardView | null = makeBoard(),
  error: string | null = null,
) {
  return render(
    <LeaguePredictionsSummary
      leagueId="lg-1"
      seasonId="season-1"
      view={view}
      board={board}
      error={error}
    />,
  );
}

const VIEWER_SECOND = makeBoard({
  coach: [
    makeEntry({ rank: 1 }),
    makeEntry({ rank: 2, userId: "u-viewer", isViewer: true, points: 14 }),
  ],
});

describe("LeaguePredictionsSummary", () => {
  it("une ligne : la journée à pronostiquer, le lien direct et la place du lecteur", () => {
    renderSummary(
      makeView({
        rounds: [
          makeRound({
            id: "r1",
            roundNumber: 1,
            pairings: [makePairing({ closed: true, eligibility: "closed" })],
          }),
          makeRound({
            id: "r2",
            roundNumber: 2,
            pairings: [makePairing({ id: "a" }), makePairing({ id: "b" })],
          }),
        ],
      }),
      VIEWER_SECOND,
    );
    expect(screen.getByTestId("league-predictions-todo").textContent).toMatch(
      /Journée 2 : 2 rencontres à pronostiquer/,
    );
    expect(
      screen.getByTestId("league-predictions-todo-link").getAttribute("href"),
    ).toBe("/leagues/lg-1/seasons/season-1/predictions/r2");
    expect(
      screen.getByTestId("league-predictions-standing").textContent,
    ).toMatch(/Tu es 2e \(14 pts\) chez les Coachs/);
    expect(
      screen.getByTestId("league-predictions-link").getAttribute("href"),
    ).toBe("/leagues/lg-1/seasons/season-1/predictions");
    // Plus aucune saisie sur la fiche de ligue.
    expect(screen.queryByTestId("prediction-picker-a")).toBeNull();
    expect(screen.queryByTestId("prediction-board")).toBeNull();
  });

  it("tout est pronostiqué : seulement la place au classement", () => {
    renderSummary(
      makeView({
        rounds: [
          makeRound({
            pairings: [
              makePairing({
                myPrediction: {
                  pick: "home",
                  homeScore: null,
                  awayScore: null,
                  grade: "pending",
                  points: 0,
                },
              }),
            ],
          }),
        ],
      }),
      VIEWER_SECOND,
    );
    expect(screen.queryByTestId("league-predictions-todo")).toBeNull();
    expect(screen.getByTestId("league-predictions-standing")).toBeTruthy();
  });

  it("rien à faire et pas classé : la ligne disparaît", () => {
    const { container } = renderSummary(makeView({ rounds: [] }), makeBoard());
    expect(container.innerHTML).toBe("");
  });

  it("un classement indisponible n'empêche pas d'annoncer la journée", () => {
    renderSummary(makeView(), null);
    expect(screen.getByTestId("league-predictions-todo")).toBeTruthy();
    expect(screen.queryByTestId("league-predictions-standing")).toBeNull();
  });

  it("invite le commissaire d'une ligue antérieure à activer les pronostics", () => {
    renderSummary(
      makeView({
        scope: "off",
        scopeConfigured: false,
        rounds: [],
        viewer: {
          userId: "u-com",
          isCommissioner: true,
          isMember: true,
          group: "stands",
        },
      }),
    );
    expect(
      screen.getByTestId("league-predictions-enable").getAttribute("href"),
    ).toBe("/leagues/lg-1/edit");
  });

  it("pronostics délibérément désactivés : rien, même pour le commissaire", () => {
    const { container } = renderSummary(
      makeView({
        scope: "off",
        scopeConfigured: true,
        rounds: [],
        viewer: {
          userId: "u-com",
          isCommissioner: true,
          isMember: true,
          group: "stands",
        },
      }),
    );
    expect(container.innerHTML).toBe("");
  });

  it("un coach d'une ligue antérieure ne voit rien", () => {
    const { container } = renderSummary(
      makeView({ scope: "off", scopeConfigured: false, rounds: [] }),
    );
    expect(container.innerHTML).toBe("");
  });

  it("une vue indisponible est signalée, pas avalée", () => {
    renderSummary(null, null, "Saison introuvable");
    expect(screen.getByTestId("league-predictions-error").textContent).toMatch(
      /Saison introuvable/,
    );
  });
});
