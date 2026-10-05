import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const apiRequest = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import { PredictionPicker } from "./PredictionPicker";
import { makePairing } from "./predictions.fixtures";

beforeEach(() => {
  vi.resetAllMocks();
  apiRequest.mockResolvedValue({ prediction: {} });
});

function renderPicker(overrides = {}) {
  const onChanged = vi.fn();
  render(
    <PredictionPicker pairing={makePairing(overrides)} onChanged={onChanged} />,
  );
  return { onChanged };
}

describe("PredictionPicker", () => {
  it("nomme les issues par les équipes", () => {
    renderPicker();
    expect(screen.getByTestId("prediction-pick-pair-1-home").textContent).toBe(
      "Victoire Orques",
    );
    expect(screen.getByTestId("prediction-pick-pair-1-draw").textContent).toBe(
      "Match nul",
    );
    expect(screen.getByTestId("prediction-pick-pair-1-away").textContent).toBe(
      "Victoire Elfes",
    );
  });

  it("sans issue : ni score ni validation, seulement les trois choix", () => {
    renderPicker();
    expect(screen.queryByTestId("prediction-save-pair-1")).toBeNull();
    expect(screen.queryByTestId("prediction-score-home-pair-1")).toBeNull();
    fireEvent.click(screen.getByTestId("prediction-pick-pair-1-home"));
    expect(screen.getByTestId("prediction-save-pair-1")).toBeTruthy();
    expect(screen.getByTestId("prediction-score-home-pair-1")).toBeTruthy();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("envoie l'issue seule, puis prévient le parent", async () => {
    const { onChanged } = renderPicker();
    fireEvent.click(screen.getByTestId("prediction-pick-pair-1-draw"));
    fireEvent.click(screen.getByTestId("prediction-save-pair-1"));
    await waitFor(() => {
      expect(onChanged).toHaveBeenCalled();
    });
    expect(apiRequest).toHaveBeenCalledWith("/leagues/pairings/pair-1/prediction", {
      method: "PUT",
      body: JSON.stringify({ pick: "draw", homeScore: null, awayScore: null }),
    });
    expect(screen.getByTestId("prediction-saved-pair-1")).toBeTruthy();
  });

  it("un score complet coche l'issue qu'il implique", async () => {
    renderPicker();
    fireEvent.click(screen.getByTestId("prediction-pick-pair-1-home"));
    fireEvent.change(screen.getByTestId("prediction-score-home-pair-1"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByTestId("prediction-score-away-pair-1"), {
      target: { value: "2" },
    });
    expect(
      screen
        .getByTestId("prediction-pick-pair-1-away")
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByTestId("prediction-save-pair-1"));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalled();
    });
    expect(JSON.parse(apiRequest.mock.calls[0][1].body)).toEqual({
      pick: "away",
      homeScore: 0,
      awayScore: 2,
    });
  });

  it("signale un score contradictoire au lieu de l'envoyer", () => {
    renderPicker();
    fireEvent.click(screen.getByTestId("prediction-pick-pair-1-home"));
    fireEvent.change(screen.getByTestId("prediction-score-home-pair-1"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByTestId("prediction-score-away-pair-1"), {
      target: { value: "1" },
    });
    // Le coach revient sur l'issue après avoir tapé le score.
    fireEvent.click(screen.getByTestId("prediction-pick-pair-1-draw"));
    fireEvent.click(screen.getByTestId("prediction-save-pair-1"));
    expect(screen.getByTestId("prediction-error-pair-1").textContent).toMatch(
      /ne correspond pas/,
    );
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("affiche le refus du serveur (rencontre close entre-temps)", async () => {
    apiRequest.mockRejectedValueOnce(new Error("Pronostics clos"));
    const { onChanged } = renderPicker();
    fireEvent.click(screen.getByTestId("prediction-pick-pair-1-home"));
    fireEvent.click(screen.getByTestId("prediction-save-pair-1"));
    await waitFor(() => {
      expect(screen.getByTestId("prediction-error-pair-1").textContent).toBe(
        "Pronostics clos",
      );
    });
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("reprend le pronostic posé et permet de le retirer", async () => {
    const { onChanged } = renderPicker({
      myPrediction: {
        pick: "home",
        homeScore: 3,
        awayScore: 1,
        grade: "pending",
        points: 0,
      },
    });
    expect(
      (screen.getByTestId("prediction-score-home-pair-1") as HTMLInputElement)
        .value,
    ).toBe("3");
    expect(screen.getByTestId("prediction-save-pair-1").textContent).toBe(
      "Modifier",
    );
    fireEvent.click(screen.getByTestId("prediction-delete-pair-1"));
    await waitFor(() => {
      expect(onChanged).toHaveBeenCalled();
    });
    expect(apiRequest).toHaveBeenCalledWith(
      "/leagues/pairings/pair-1/prediction",
      { method: "DELETE" },
    );
  });

  it("Annuler ferme la saisie sans rien envoyer", () => {
    const onCancel = vi.fn();
    render(
      <PredictionPicker
        pairing={makePairing({
          myPrediction: {
            pick: "home",
            homeScore: null,
            awayScore: null,
            grade: "pending",
            points: 0,
          },
        })}
        onChanged={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId("prediction-cancel-pair-1"));
    expect(onCancel).toHaveBeenCalled();
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
