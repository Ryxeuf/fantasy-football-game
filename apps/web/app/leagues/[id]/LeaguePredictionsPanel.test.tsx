import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const apiRequest = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import { LeaguePredictionsPanel } from "./LeaguePredictionsPanel";
import {
  makeBoard,
  makePairing,
  makeRound,
  makeView,
} from "../_components/predictions.fixtures";
import type {
  SeasonPredictionLeaderboardView,
  SeasonPredictionsView,
} from "../_components/predictions";

function mockApi(
  view: SeasonPredictionsView | Error,
  board: SeasonPredictionLeaderboardView | Error = makeBoard(),
) {
  apiRequest.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method) return {};
    if (path.endsWith("/predictions/leaderboard")) {
      if (board instanceof Error) throw board;
      return board;
    }
    if (path.endsWith("/predictions")) {
      if (view instanceof Error) throw view;
      return view;
    }
    throw new Error(`unexpected ${path}`);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

function renderPanel() {
  return render(<LeaguePredictionsPanel leagueId="lg-1" seasonId="season-1" />);
}

describe("LeaguePredictionsPanel", () => {
  it("montre la journée ouverte, le classement et le lien vers la page", async () => {
    mockApi(
      makeView({
        rounds: [
          makeRound({
            id: "r1",
            roundNumber: 1,
            pairings: [
              makePairing({
                id: "done",
                closed: true,
                eligibility: "closed",
                result: { outcome: "home", homeScore: 1, awayScore: 0 },
              }),
            ],
          }),
          makeRound({ id: "r2", roundNumber: 2, pairings: [makePairing()] }),
        ],
      }),
    );
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("league-predictions-panel")).toBeTruthy();
    });
    expect(screen.getByTestId("league-predictions-round").textContent).toBe(
      "Journée 2",
    );
    expect(screen.getByTestId("prediction-picker-pair-1")).toBeTruthy();
    expect(screen.getByTestId("prediction-board")).toBeTruthy();
    expect(
      screen.getByTestId("league-predictions-link").getAttribute("href"),
    ).toBe("/leagues/lg-1/seasons/season-1/predictions");
    expect(apiRequest).toHaveBeenCalledWith(
      "/leagues/seasons/season-1/predictions",
    );
  });

  it("recharge la vue après un pronostic", async () => {
    mockApi(makeView());
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("prediction-pick-pair-1-home")).toBeTruthy();
    });
    const readsBefore = apiRequest.mock.calls.filter(
      ([p, init]) => p.endsWith("/predictions") && !init,
    ).length;
    fireEvent.click(screen.getByTestId("prediction-pick-pair-1-home"));
    fireEvent.click(screen.getByTestId("prediction-save-pair-1"));
    await waitFor(() => {
      expect(
        apiRequest.mock.calls.filter(
          ([p, init]) => p.endsWith("/predictions") && !init,
        ).length,
      ).toBe(readsBefore + 1);
    });
  });

  it("invite le commissaire d'une ligue antérieure à activer les pronostics", async () => {
    mockApi(
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
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("league-predictions-cta")).toBeTruthy();
    });
    expect(
      screen.getByTestId("league-predictions-enable").getAttribute("href"),
    ).toBe("/leagues/lg-1/edit");
  });

  it("n'affiche rien quand les pronostics sont désactivés (hors invitation)", async () => {
    // Commissaire qui a DÉLIBÉRÉMENT désactivé : pas de relance.
    mockApi(
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
    const { container } = renderPanel();
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("un coach d'une ligue antérieure ne voit rien", async () => {
    mockApi(makeView({ scope: "off", scopeConfigured: false, rounds: [] }));
    const { container } = renderPanel();
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("sans rencontre à pronostiquer, le dit", async () => {
    mockApi(makeView({ rounds: [] }));
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("league-predictions-empty")).toBeTruthy();
    });
  });

  it("un classement indisponible n'empêche pas de pronostiquer", async () => {
    mockApi(makeView(), new Error("boom"));
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("prediction-picker-pair-1")).toBeTruthy();
    });
    expect(screen.queryByTestId("prediction-board")).toBeNull();
  });

  it("une vue indisponible est signalée, pas avalée", async () => {
    mockApi(new Error("Saison introuvable"));
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("league-predictions-error").textContent).toMatch(
        /Saison introuvable/,
      );
    });
  });
});
