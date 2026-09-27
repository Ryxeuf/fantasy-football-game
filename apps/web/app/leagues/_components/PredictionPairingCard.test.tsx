import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const apiRequest = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import { PredictionPairingCard } from "./PredictionPairingCard";
import { makePairing } from "./predictions.fixtures";
import type { PairingPredictionsView } from "./predictions";

beforeEach(() => {
  vi.resetAllMocks();
  apiRequest.mockResolvedValue({});
});

function renderCard(
  overrides: Partial<PairingPredictionsView> = {},
  showOthers = false,
) {
  const onChanged = vi.fn();
  render(
    <ul>
      <PredictionPairingCard
        pairing={makePairing(overrides)}
        onChanged={onChanged}
        showOthers={showOthers}
      />
    </ul>,
  );
  return { onChanged };
}

const CLOSED_WITH_OTHERS: Partial<PairingPredictionsView> = {
  status: "played",
  closed: true,
  eligibility: "closed",
  result: { outcome: "home", homeScore: 2, awayScore: 1 },
  myPrediction: {
    pick: "home",
    homeScore: 2,
    awayScore: 1,
    grade: "exact",
    points: 5,
  },
  predictions: [
    {
      userId: "u-viewer",
      displayName: "Moi",
      group: "coach",
      isViewer: true,
      pick: "home",
      homeScore: 2,
      awayScore: 1,
      grade: "exact",
      points: 5,
    },
    {
      userId: "u-2",
      displayName: "Coach anonyme",
      group: "stands",
      isViewer: false,
      pick: "draw",
      homeScore: null,
      awayScore: null,
      grade: "wrong",
      points: 0,
    },
  ],
  distribution: { home: 1, draw: 1, away: 0, total: 2 },
};

describe("PredictionPairingCard", () => {
  it("rencontre ouverte : la saisie, aucune trace des autres", () => {
    renderCard({ closesAt: "2026-10-01T18:00:00.000Z" });
    expect(screen.getByTestId("prediction-picker-pair-1")).toBeTruthy();
    expect(screen.getByTestId("prediction-pairing-pair-1").textContent).toMatch(
      /Ouvert jusqu'au/,
    );
    expect(screen.queryByTestId("prediction-distribution-pair-1")).toBeNull();
    expect(screen.queryByTestId("prediction-others-pair-1")).toBeNull();
  });

  it("son propre match : pas de saisie, la raison est dite", () => {
    renderCard({ eligibility: "own-match" });
    expect(screen.queryByTestId("prediction-picker-pair-1")).toBeNull();
    expect(
      screen.getByTestId("prediction-eligibility-pair-1").textContent,
    ).toMatch(/propre match/);
  });

  it("rencontre jouée : score réel, note du lecteur, répartition", () => {
    renderCard(CLOSED_WITH_OTHERS);
    const card = screen.getByTestId("prediction-pairing-pair-1");
    expect(card.textContent).toContain("Score 2-1");
    expect(screen.getByTestId("prediction-mine-pair-1").textContent).toMatch(
      /Score exact · 5 pts/,
    );
    expect(
      screen.getByTestId("prediction-distribution-pair-1").textContent,
    ).toMatch(/Victoire Orques 50 %.*Match nul 50 %.*2 pronostics/);
    expect(screen.queryByTestId("prediction-picker-pair-1")).toBeNull();
    // Sur le panneau, pas de liste nominative.
    expect(screen.queryByTestId("prediction-others-pair-1")).toBeNull();
  });

  it("page complète : la liste nominative, groupe compris", () => {
    renderCard(CLOSED_WITH_OTHERS, true);
    const others = screen.getByTestId("prediction-others-pair-1");
    expect(others.textContent).toContain("Coach anonyme");
    expect(others.textContent).toContain("Tribunes");
    expect(others.textContent).toContain("Match nul");
  });

  it("un forfait se lit « non jouée », sans note", () => {
    renderCard({
      status: "forfeit_home",
      closed: true,
      eligibility: "closed",
      result: { outcome: "void", homeScore: null, awayScore: null },
      myPrediction: {
        pick: "away",
        homeScore: null,
        awayScore: null,
        grade: "void",
        points: 0,
      },
    });
    expect(screen.getByTestId("prediction-pairing-pair-1").textContent).toContain(
      "Non jouée",
    );
    expect(screen.getByTestId("prediction-mine-pair-1").textContent).toMatch(
      /Annulé/,
    );
  });

  it("clôture manuelle par qui en a le droit", async () => {
    const { onChanged } = renderCard({ canClose: true });
    fireEvent.click(screen.getByTestId("prediction-close-pair-1"));
    await waitFor(() => {
      expect(onChanged).toHaveBeenCalled();
    });
    expect(apiRequest).toHaveBeenCalledWith(
      "/leagues/pairings/pair-1/predictions/close",
      { method: "POST" },
    );
  });

  it("pas de bouton de clôture sur une rencontre déjà close", () => {
    renderCard({ canClose: true, closed: true, eligibility: "closed" });
    expect(screen.queryByTestId("prediction-close-pair-1")).toBeNull();
  });
});
