/**
 * Bouton « Relancer » d'une journée : ce que le commissaire voit après le
 * clic. Un compte rendu vide (« aucune relance nécessaire ») est une
 * information, pas un silence — sans lui, on ne sait pas si le clic a servi.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const apiRequest = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import { RoundFollowupButton } from "./RoundFollowupButton";

function renderButton() {
  return render(<RoundFollowupButton roundId="r-1" roundNumber={3} />);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("RoundFollowupButton", () => {
  it("appelle la relance de LA journée affichée", async () => {
    apiRequest.mockResolvedValue({
      reminders: [],
      coachesNotified: 0,
      pairingsChecked: 2,
    });

    renderButton();
    fireEvent.click(screen.getByTestId("round-followup-r-1"));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/leagues/rounds/r-1/remind", {
        method: "POST",
      }),
    );
  });

  it("dit qu'il n'y avait rien à relancer plutôt que de rester muet", async () => {
    apiRequest.mockResolvedValue({
      reminders: [],
      coachesNotified: 0,
      pairingsChecked: 4,
    });

    renderButton();
    fireEvent.click(screen.getByTestId("round-followup-r-1"));

    const empty = await screen.findByTestId("round-followup-empty-r-1");
    expect(empty.textContent).toContain("Aucune relance nécessaire");
    expect(empty.textContent).toContain("4 rencontres à jour");
  });

  it("détaille les rencontres relancées et leur motif", async () => {
    apiRequest.mockResolvedValue({
      reminders: [
        {
          pairingId: "p1",
          reason: "not_scheduled",
          matchLabel: "Reikland vs Skavenblight",
          coaches: ["Coach A", "Coach B"],
        },
        {
          pairingId: "p2",
          reason: "sheet_overdue",
          matchLabel: "Naggaroth vs Bögenhafen",
          coaches: ["Coach C", "Coach D"],
        },
      ],
      coachesNotified: 4,
      pairingsChecked: 5,
    });

    renderButton();
    fireEvent.click(screen.getByTestId("round-followup-r-1"));

    const result = await screen.findByTestId("round-followup-result-r-1");
    expect(result.textContent).toContain("2 relances envoyées");
    expect(result.textContent).toContain("4 coachs prévenus");
    expect(result.textContent).toContain(
      "Reikland vs Skavenblight — Match non planifié",
    );
    expect(result.textContent).toContain(
      "Naggaroth vs Bögenhafen — Feuille de match attendue",
    );
  });

  it("accorde le compte rendu au singulier", async () => {
    apiRequest.mockResolvedValue({
      reminders: [
        {
          pairingId: "p1",
          reason: "not_scheduled",
          matchLabel: "A vs B",
          coaches: ["Coach A"],
        },
      ],
      coachesNotified: 1,
      pairingsChecked: 1,
    });

    renderButton();
    fireEvent.click(screen.getByTestId("round-followup-r-1"));

    const result = await screen.findByTestId("round-followup-result-r-1");
    expect(result.textContent).toContain("1 relance envoyée");
    expect(result.textContent).toContain("1 coach prévenu");
    expect(result.textContent).not.toContain("relances");
  });

  it("remonte l'erreur du serveur (403 d'un non-commissaire)", async () => {
    apiRequest.mockRejectedValue(
      new Error("Seul le commissaire de la ligue peut relancer une journée"),
    );

    renderButton();
    fireEvent.click(screen.getByTestId("round-followup-r-1"));

    const error = await screen.findByTestId("round-followup-error-r-1");
    expect(error.textContent).toContain("Seul le commissaire");
  });

  it("bloque le double-clic pendant l'envoi", async () => {
    let resolve: ((v: unknown) => void) | undefined;
    apiRequest.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    renderButton();
    const button = screen.getByTestId("round-followup-r-1") as HTMLButtonElement;
    fireEvent.click(button);

    await waitFor(() => expect(button.disabled).toBe(true));
    fireEvent.click(button);
    expect(apiRequest).toHaveBeenCalledTimes(1);

    resolve?.({ reminders: [], coachesNotified: 0, pairingsChecked: 0 });
    await waitFor(() => expect(button.disabled).toBe(false));
  });
});
