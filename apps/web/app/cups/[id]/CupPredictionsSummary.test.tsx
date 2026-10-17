import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CupPredictionsSummary } from "./CupPredictionsSummary";
import {
  makeCupBoard,
  makeCupView,
  makeEntry,
  makePairing,
  makeRound,
} from "../../leagues/_components/predictions.fixtures";
import type {
  CupPredictionLeaderboardView,
  CupPredictionsView,
} from "../../leagues/_components/predictions";

function cupRound(overrides: Parameters<typeof makeRound>[0]) {
  const { startDate: _startDate, ...round } = makeRound(overrides);
  return round;
}

function renderSummary(
  view: CupPredictionsView | null,
  board: CupPredictionLeaderboardView | null = makeCupBoard(),
  error: string | null = null,
) {
  return render(
    <CupPredictionsSummary cupId="cup-1" view={view} board={board} error={error} />,
  );
}

describe("CupPredictionsSummary", () => {
  it("la ronde à pronostiquer, son ancre et la place du lecteur", () => {
    renderSummary(
      makeCupView({
        rounds: [
          cupRound({
            id: "r1",
            pairings: [makePairing({ closed: true, eligibility: "closed" })],
          }),
          cupRound({ id: "r2", roundNumber: 2, pairings: [makePairing({ id: "a" })] }),
        ],
      }),
      makeCupBoard({
        coach: [makeEntry({ rank: 1, userId: "u-viewer", isViewer: true, points: 8 })],
      }),
    );
    expect(screen.getByTestId("cup-predictions-todo").textContent).toContain(
      "Ronde 2 : 1 rencontre à pronostiquer",
    );
    expect(
      screen.getByTestId("cup-predictions-todo-link").getAttribute("href"),
    ).toBe("/cups/cup-1/predictions#pronos-ronde-2");
    expect(screen.getByTestId("cup-predictions-standing").textContent).toContain(
      "Tu es 1er (8 pts) chez les Coachs",
    );
    expect(screen.getByTestId("cup-predictions-link").getAttribute("href")).toBe(
      "/cups/cup-1/predictions",
    );
  });

  it("rien à faire, pas classé : un simple lien vers la page", () => {
    renderSummary(
      makeCupView({
        viewer: { userId: null, isCommissioner: false, isMember: false, group: null },
        rounds: [cupRound({ pairings: [makePairing({ eligibility: "not-member" })] })],
      }),
      makeCupBoard({ coach: [] }),
    );
    expect(screen.queryByTestId("cup-predictions-todo")).toBeNull();
    expect(screen.getByTestId("cup-predictions-link").textContent).toBe(
      "Voir les pronostics →",
    );
  });

  it("coupe antérieure : seul le commissaire est invité à les activer", () => {
    const off = (isCommissioner: boolean) =>
      makeCupView({
        scope: "off",
        scopeConfigured: false,
        viewer: { userId: "u", isCommissioner, isMember: true, group: "coach" },
      });
    const { unmount } = renderSummary(off(true));
    expect(
      screen.getByTestId("cup-predictions-enable").getAttribute("href"),
    ).toBe("/cups/cup-1/edit");
    unmount();
    renderSummary(off(false));
    expect(screen.queryByTestId("cup-predictions-cta")).toBeNull();
  });

  it("désactivés volontairement : rien", () => {
    renderSummary(
      makeCupView({
        scope: "off",
        scopeConfigured: true,
        viewer: { userId: "u", isCommissioner: true, isMember: true, group: "coach" },
      }),
    );
    expect(screen.queryByTestId("cup-predictions-cta")).toBeNull();
    expect(screen.queryByTestId("cup-predictions-summary")).toBeNull();
  });

  it("une erreur se dit", () => {
    renderSummary(null, null, "boom");
    expect(screen.getByTestId("cup-predictions-error").textContent).toBe(
      "Pronostics : boom",
    );
  });
});
