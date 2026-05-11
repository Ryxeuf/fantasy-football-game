/**
 * Tests pour `DailyBonusCard` (Sprint O — Lot O.C.1).
 *
 * Couvre :
 *   - Loading state au mount.
 *   - canClaim=true → bouton "Reclamer +50".
 *   - Click claim → granted=true → message succes + onClaimed callback.
 *   - canClaim=false → countdown affiche.
 *   - 500 / error → message d'erreur.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../../../lib/api-client", () => ({
  apiRequest: vi.fn(),
  ApiClientError: class ApiClientError extends Error {
    public readonly status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
      this.name = "ApiClientError";
    }
  },
}));

import { apiRequest } from "../../../../lib/api-client";
import DailyBonusCard from "./DailyBonusCard";

const mockedApi = vi.mocked(apiRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DailyBonusCard — Lot O.C.1", () => {
  it("affiche loading au mount", () => {
    mockedApi.mockReturnValue(new Promise(() => undefined));
    render(<DailyBonusCard />);
    expect(screen.getByTestId("daily-bonus-card").textContent).toContain(
      "Chargement",
    );
  });

  it("canClaim=true : affiche le bouton 'Reclamer +50'", async () => {
    mockedApi.mockResolvedValueOnce({
      canClaim: true,
      nextEligibleAt: null,
    });
    render(<DailyBonusCard />);
    await waitFor(() => {
      expect(screen.getByTestId("daily-bonus-claim")).toBeTruthy();
    });
    expect(screen.getByTestId("daily-bonus-claim").textContent).toContain(
      "Réclamer +50",
    );
  });

  it("click 'Reclamer' → granted=true → affiche message succes + appelle onClaimed", async () => {
    mockedApi.mockResolvedValueOnce({
      canClaim: true,
      nextEligibleAt: null,
    });
    const onClaimed = vi.fn();
    render(<DailyBonusCard onClaimed={onClaimed} />);
    await waitFor(() => {
      expect(screen.getByTestId("daily-bonus-claim")).toBeTruthy();
    });

    // 2eme call = POST claim
    mockedApi.mockResolvedValueOnce({
      granted: true,
      balance: 1050,
      amount: 50,
      nextEligibleAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    });
    fireEvent.click(screen.getByTestId("daily-bonus-claim"));

    await waitFor(() => {
      const card = screen.getByTestId("daily-bonus-card");
      expect(card.textContent).toContain("+50 Crowns");
    });
    expect(onClaimed).toHaveBeenCalledTimes(1);
  });

  it("canClaim=false : affiche un countdown", async () => {
    const nextAt = new Date(Date.now() + 5 * 3600_000).toISOString(); // 5h
    mockedApi.mockResolvedValueOnce({
      canClaim: false,
      nextEligibleAt: nextAt,
    });
    render(<DailyBonusCard />);
    await waitFor(() => {
      expect(screen.getByTestId("daily-bonus-countdown")).toBeTruthy();
    });
    // 5h doit afficher "5h00" ou similaire
    expect(screen.getByTestId("daily-bonus-countdown").textContent).toMatch(
      /^[45]h/,
    );
  });

  it("erreur API → message d'erreur", async () => {
    mockedApi.mockRejectedValueOnce(new Error("boom"));
    render(<DailyBonusCard />);
    await waitFor(() => {
      expect(screen.getByTestId("daily-bonus-card").textContent).toContain(
        "Bonus quotidien indisponible",
      );
    });
  });

  it("granted=false defensive : refresh status sans message succes", async () => {
    mockedApi.mockResolvedValueOnce({
      canClaim: true,
      nextEligibleAt: null,
    });
    const onClaimed = vi.fn();
    render(<DailyBonusCard onClaimed={onClaimed} />);
    await waitFor(() => {
      expect(screen.getByTestId("daily-bonus-claim")).toBeTruthy();
    });

    // Race condition : POST renvoie granted=false (already claimed in another tab)
    mockedApi.mockResolvedValueOnce({
      granted: false,
      balance: 1000,
      amount: 0,
      nextEligibleAt: new Date(Date.now() + 23 * 3600_000).toISOString(),
    });
    fireEvent.click(screen.getByTestId("daily-bonus-claim"));

    await waitFor(() => {
      // Affiche countdown, pas message succes
      expect(screen.queryByTestId("daily-bonus-countdown")).toBeTruthy();
    });
    expect(onClaimed).not.toHaveBeenCalled();
  });
});
