import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "cup-1" }),
}));

const apiRequest = vi.fn();
vi.mock("../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import CupPredictionsPage from "./page";
import {
  makeCupBoard,
  makeCupView,
  makeEntry,
  makePairing,
  makeRound,
} from "../../../leagues/_components/predictions.fixtures";
import type { CupPredictionsView } from "../../../leagues/_components/predictions";

function cupRound(overrides: Parameters<typeof makeRound>[0]) {
  const { startDate: _startDate, ...round } = makeRound(overrides);
  return round;
}

function mockApi(view: CupPredictionsView | Error) {
  apiRequest.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method) return {};
    if (path === "/cup/cup-1/predictions/leaderboard") {
      return makeCupBoard({
        coach: [makeEntry({ userId: "c1", displayName: "Alice", isViewer: true })],
      });
    }
    if (path === "/cup/cup-1/predictions") {
      if (view instanceof Error) throw view;
      return view;
    }
    throw new Error(`unexpected ${path}`);
  });
}

const CLOSED = makePairing({
  id: "played",
  status: "played",
  closed: true,
  eligibility: "closed",
  result: { outcome: "home", homeScore: 2, awayScore: 1 },
  predictions: [
    {
      userId: "c2",
      displayName: "Bob",
      group: "coach",
      isViewer: false,
      pick: "home",
      homeScore: 2,
      awayScore: 1,
      grade: "exact",
      points: 5,
    },
  ],
  distribution: { home: 1, draw: 0, away: 0, total: 1 },
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CupPredictionsPage", () => {
  it("classement, rondes ancrées, pronostics des autres une fois la rencontre close", async () => {
    mockApi(
      makeCupView({
        rounds: [
          cupRound({ id: "r1", roundNumber: 1, pairings: [CLOSED] }),
          cupRound({ id: "r2", roundNumber: 2, pairings: [makePairing({ id: "open" })] }),
        ],
      }),
    );
    render(<CupPredictionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("prediction-round-r1")).toBeTruthy();
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Coupe du Chaos",
    );
    // Vocabulaire de la coupe.
    expect(screen.getByText("Ronde 2")).toBeTruthy();
    expect(screen.getByTestId("cup-predictions-summary").textContent).toContain(
      "Membres de la coupe",
    );
    // Ancre de chaque ronde : cible du bouton 🔮 et de la notification.
    expect(screen.getByTestId("prediction-round-r2").id).toBe("pronos-ronde-2");
    expect(screen.getByTestId("prediction-others-played").textContent).toContain("Bob");
    expect(screen.queryByTestId("prediction-others-open")).toBeNull();
    expect(screen.getByTestId("prediction-board-row-c1")).toBeTruthy();
  });

  it("le pronostic part sur la route de la coupe", async () => {
    mockApi(makeCupView({ rounds: [cupRound({ pairings: [makePairing({ id: "p9" })] })] }));
    render(<CupPredictionsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("prediction-pick-p9-home")).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId("prediction-pick-p9-home"));
    fireEvent.click(screen.getByTestId("prediction-save-p9"));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/cup/pairings/p9/prediction",
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });

  it("le commissaire clôt une ronde sur la route de la coupe", async () => {
    mockApi(
      makeCupView({
        viewer: { userId: "u1", isCommissioner: true, isMember: true, group: "coach" },
        rounds: [cupRound({ id: "r1", canClose: true })],
      }),
    );
    render(<CupPredictionsPage />);
    const button = await screen.findByTestId("prediction-round-close-r1");
    expect(button.textContent).toBe("Clore les pronostics de la ronde");
    fireEvent.click(button);
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/cup/rounds/r1/predictions/close",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("désactivés : le commissaire est renvoyé vers les réglages de la coupe", async () => {
    mockApi(
      makeCupView({
        scope: "off",
        viewer: { userId: "u1", isCommissioner: true, isMember: true, group: "coach" },
        rounds: [],
      }),
    );
    render(<CupPredictionsPage />);
    const link = await screen.findByTestId("cup-predictions-enable");
    expect(link.getAttribute("href")).toBe("/cups/cup-1/edit");
    expect(screen.queryByTestId("cup-predictions-summary")).toBeNull();
  });

  it("une vue en échec remonte son message", async () => {
    mockApi(new Error("Coupe introuvable"));
    render(<CupPredictionsPage />);
    expect((await screen.findByTestId("cup-predictions-error")).textContent).toBe(
      "Coupe introuvable",
    );
  });
});
