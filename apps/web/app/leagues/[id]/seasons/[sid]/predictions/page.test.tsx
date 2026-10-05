import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const nav = vi.hoisted(() => ({
  params: { id: "lg-1", sid: "season-1" } as { id: string; sid: string },
}));
vi.mock("next/navigation", () => ({
  useParams: () => nav.params,
}));

const apiRequest = vi.fn();
vi.mock("../../../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import SeasonPredictionsPage from "./page";
import {
  makeBoard,
  makeEntry,
  makePairing,
  makeRound,
  makeView,
} from "../../../../_components/predictions.fixtures";
import type { SeasonPredictionsView } from "../../../../_components/predictions";

function mockApi(view: SeasonPredictionsView | Error) {
  apiRequest.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method) return {};
    if (path.endsWith("/predictions/leaderboard")) {
      return makeBoard({
        coach: [makeEntry({ userId: "c1", displayName: "Alice" })],
        stands: [
          makeEntry({
            userId: "s1",
            displayName: "Supporter",
            group: "stands",
            isViewer: true,
          }),
        ],
      });
    }
    if (path.endsWith("/predictions")) {
      if (view instanceof Error) throw view;
      return view;
    }
    throw new Error(`unexpected ${path}`);
  });
}

const PLAYED = makePairing({
  id: "played",
  status: "played",
  closed: true,
  eligibility: "closed",
  result: { outcome: "draw", homeScore: 1, awayScore: 1 },
  predictions: [
    {
      userId: "c1",
      displayName: "Alice",
      group: "coach",
      isViewer: false,
      pick: "draw",
      homeScore: 1,
      awayScore: 1,
      grade: "exact",
      points: 5,
    },
  ],
  distribution: { home: 0, draw: 1, away: 0, total: 1 },
});

beforeEach(() => {
  vi.resetAllMocks();
  nav.params = { id: "lg-1", sid: "season-1" };
});

describe("SeasonPredictionsPage", () => {
  it("toutes les journées, les pronostics des autres une fois la rencontre close", async () => {
    mockApi(
      makeView({
        viewer: {
          userId: "s1",
          isCommissioner: false,
          isMember: false,
          group: "stands",
        },
        scope: "open",
        rounds: [
          makeRound({ id: "r1", roundNumber: 1, pairings: [PLAYED] }),
          makeRound({ id: "r2", roundNumber: 2, pairings: [makePairing()] }),
        ],
      }),
    );
    render(<SeasonPredictionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("prediction-round-r1")).toBeTruthy();
    });
    expect(screen.getByTestId("prediction-round-r2")).toBeTruthy();
    expect(screen.getByTestId("prediction-others-played").textContent).toContain(
      "Alice",
    );
    // La rencontre ouverte ne montre rien des autres.
    expect(screen.queryByTestId("prediction-others-pair-1")).toBeNull();
    expect(screen.getByTestId("season-predictions-summary").textContent).toMatch(
      /Tout le monde.*groupe Tribunes/,
    );
    // L'onglet du lecteur est ouvert d'emblée.
    expect(
      screen
        .getByTestId("prediction-board-tab-stands")
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByTestId("prediction-board-row-s1")).toBeTruthy();
    // Chaque journée mène à SA page.
    expect(
      screen.getByTestId("prediction-round-link-r2").getAttribute("href"),
    ).toBe("/leagues/lg-1/seasons/season-1/predictions/r2");
    expect(screen.getByTestId("prediction-round-link-r1").textContent).toBe(
      "Résultats des pronos →",
    );
  });

  it("le commissaire clôt une journée entière", async () => {
    mockApi(
      makeView({
        viewer: {
          userId: "u-com",
          isCommissioner: true,
          isMember: true,
          group: "stands",
        },
        rounds: [makeRound({ id: "r2", canClose: true })],
      }),
    );
    render(<SeasonPredictionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("prediction-round-close-r2")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("prediction-round-close-r2"));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/leagues/rounds/r2/predictions/close",
        { method: "POST" },
      );
    });
  });

  it("pas de clôture de journée quand tout y est déjà clos", async () => {
    mockApi(
      makeView({
        rounds: [makeRound({ id: "r1", canClose: true, pairings: [PLAYED] })],
      }),
    );
    render(<SeasonPredictionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("prediction-round-r1")).toBeTruthy();
    });
    expect(screen.queryByTestId("prediction-round-close-r1")).toBeNull();
  });

  it("pronostics désactivés : le dit, et renvoie le commissaire aux réglages", async () => {
    mockApi(
      makeView({
        scope: "off",
        rounds: [],
        viewer: {
          userId: "u-com",
          isCommissioner: true,
          isMember: true,
          group: null,
        },
      }),
    );
    render(<SeasonPredictionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("season-predictions-off")).toBeTruthy();
    });
    expect(screen.getByText("Les activer dans les réglages")).toBeTruthy();
    expect(screen.queryByTestId("prediction-board")).toBeNull();
  });

  it("une saison introuvable (ligue privée) est signalée", async () => {
    mockApi(new Error("Saison introuvable"));
    render(<SeasonPredictionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("season-predictions-error").textContent).toBe(
        "Saison introuvable",
      );
    });
  });

  it("changer de saison n'affiche jamais la précédente sous le nom de la nouvelle", async () => {
    mockApi(
      makeView({ rounds: [makeRound({ id: "r1", pairings: [PLAYED] })] }),
    );
    const { rerender } = render(<SeasonPredictionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("prediction-round-r1")).toBeTruthy();
    });

    // Saison 2 : la lecture reste en attente.
    apiRequest.mockImplementation(() => new Promise(() => {}));
    nav.params = { id: "lg-1", sid: "season-2" };
    rerender(<SeasonPredictionsPage />);

    await waitFor(() => {
      expect(screen.queryByTestId("prediction-round-r1")).toBeNull();
    });
    expect(screen.queryByTestId("prediction-others-played")).toBeNull();
    expect(screen.getByText("Chargement…")).toBeTruthy();
    expect(apiRequest).toHaveBeenCalledWith(
      "/leagues/seasons/season-2/predictions",
    );
  });
});
