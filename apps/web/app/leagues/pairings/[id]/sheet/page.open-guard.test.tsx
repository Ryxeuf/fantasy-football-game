/**
 * Feuille de match — ouverture refusée tant qu'une rencontre précédente de
 * l'une des deux équipes n'est pas close (retour testeur : une J3 ouverte
 * avant la validation de la J2 restait « comme si les équipes n'avaient pas
 * joué »). L'écran nomme la rencontre à valider d'abord et propose au
 * commissaire d'ouvrir quand même.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "pair-j3" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

const apiRequest = vi.fn();
vi.mock("../../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  ApiClientError: class ApiClientError extends Error {
    constructor(
      message: string,
      public readonly status?: number,
      public readonly code?: string,
      public readonly details?: Record<string, unknown>,
    ) {
      super(message);
    }
  },
}));

import MatchSheetPage from "./page";
import { ApiClientError } from "../../../../lib/api-client";

const BLOCKED = (canForce: boolean) =>
  new ApiClientError(
    "Feuille non ouverte : une rencontre précédente n'est pas encore close.",
    409,
    "previous_match_pending",
    {
      canForce,
      blocking: [
        {
          pairingId: "pair-j2",
          roundLabel: "journée 2",
          homeTeamName: "Paladins de la Dame",
          awayTeamName: "Elfes",
        },
      ],
    },
  );

describe("Feuille de match — garde d'ouverture", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  function arrange(canForce: boolean) {
    apiRequest.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}"));
        if (body.force === true) return Promise.resolve({ id: "ms1" });
        return Promise.reject(BLOCKED(canForce));
      }
      // Aucune feuille encore ouverte.
      return Promise.reject(new ApiClientError("Feuille inexistante", 404));
    });
  }

  it("un coach voit la rencontre à valider d'abord, sans pouvoir forcer", async () => {
    arrange(false);
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("open-sheet"));

    const panel = await screen.findByTestId("sheet-open-blocked");
    expect(panel.textContent).toContain("pas encore close");
    const link = screen.getByTestId("sheet-open-blocking-pair-j2");
    expect(link.textContent).toBe("journée 2 : Paladins de la Dame – Elfes");
    expect(link.getAttribute("href")).toBe("/leagues/pairings/pair-j2/sheet");
    expect(screen.queryByTestId("open-sheet-force")).toBeNull();
  });

  it("le commissaire peut ouvrir quand même : la requête porte `force`", async () => {
    arrange(true);
    render(<MatchSheetPage />);
    fireEvent.click(await screen.findByTestId("open-sheet"));
    fireEvent.click(await screen.findByTestId("open-sheet-force"));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/leagues/pairings/pair-j3/sheet",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ force: true }),
        }),
      ),
    );
  });
});
