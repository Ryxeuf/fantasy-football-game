import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const nav = vi.hoisted(() => ({
  params: { id: "lg-1", sid: "season-1", roundId: "r2" } as {
    id: string;
    sid: string;
    roundId: string;
  },
}));
vi.mock("next/navigation", () => ({
  useParams: () => nav.params,
}));

const apiRequest = vi.fn();
vi.mock("../../../../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import RoundPredictionsPage from "./page";
import {
  makeBoard,
  makeEntry,
  makePairing,
  makeRound,
  makeView,
} from "../../../../../_components/predictions.fixtures";
import type { SeasonPredictionsView } from "../../../../../_components/predictions";

function mockApi(view: SeasonPredictionsView | Error) {
  apiRequest.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method) return {};
    if (path.endsWith("/predictions/leaderboard")) {
      return makeBoard({
        coach: [
          makeEntry({ rank: 1 }),
          makeEntry({ rank: 2, userId: "u-viewer", isViewer: true, points: 8 }),
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

const THREE_ROUNDS = [
  makeRound({
    id: "r1",
    roundNumber: 1,
    pairings: [makePairing({ id: "p1", closed: true, eligibility: "closed" })],
  }),
  makeRound({ id: "r2", roundNumber: 2, pairings: [makePairing({ id: "p2" })] }),
  makeRound({ id: "r3", roundNumber: 3, pairings: [makePairing({ id: "p3" })] }),
];

beforeEach(() => {
  vi.resetAllMocks();
  nav.params = { id: "lg-1", sid: "season-1", roundId: "r2" };
});

describe("RoundPredictionsPage", () => {
  it("ne montre que la journée demandée, avec la saisie et la navigation", async () => {
    mockApi(makeView({ rounds: THREE_ROUNDS }));
    render(<RoundPredictionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("prediction-pairing-p2")).toBeTruthy();
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "🔮 Pronostics — Journée 2",
    );
    expect(screen.queryByTestId("prediction-pairing-p1")).toBeNull();
    expect(screen.queryByTestId("prediction-pairing-p3")).toBeNull();
    expect(screen.getByTestId("prediction-picker-p2")).toBeTruthy();
    expect(
      screen.getByTestId("prediction-round-nav-previous").getAttribute("href"),
    ).toBe("/leagues/lg-1/seasons/season-1/predictions/r1");
    expect(
      screen.getByTestId("prediction-round-nav-next").getAttribute("href"),
    ).toBe("/leagues/lg-1/seasons/season-1/predictions/r3");
    expect(screen.getByTestId("round-predictions-standing").textContent).toBe(
      "2e (8 pts)",
    );
    expect(
      screen.getByTestId("round-predictions-season-link").getAttribute("href"),
    ).toBe("/leagues/lg-1/seasons/season-1/predictions");
  });

  it("première journée : pas de lien vers la précédente", async () => {
    nav.params = { id: "lg-1", sid: "season-1", roundId: "r1" };
    mockApi(makeView({ rounds: THREE_ROUNDS }));
    render(<RoundPredictionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("prediction-pairing-p1")).toBeTruthy();
    });
    expect(screen.queryByTestId("prediction-round-nav-previous")).toBeNull();
    expect(screen.getByTestId("prediction-round-nav-next")).toBeTruthy();
  });

  it("le commissaire clôt la journée depuis sa page", async () => {
    mockApi(
      makeView({
        rounds: [makeRound({ id: "r2", canClose: true })],
      }),
    );
    render(<RoundPredictionsPage />);
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

  it("journée inconnue de la saison", async () => {
    nav.params = { id: "lg-1", sid: "season-1", roundId: "zz" };
    mockApi(makeView({ rounds: THREE_ROUNDS }));
    render(<RoundPredictionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("round-predictions-not-found")).toBeTruthy();
    });
  });

  it("pronostics désactivés", async () => {
    mockApi(makeView({ scope: "off", rounds: [] }));
    render(<RoundPredictionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("round-predictions-off")).toBeTruthy();
    });
  });

  it("saison introuvable", async () => {
    mockApi(new Error("Saison introuvable"));
    render(<RoundPredictionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("round-predictions-error").textContent).toBe(
        "Saison introuvable",
      );
    });
  });
});
