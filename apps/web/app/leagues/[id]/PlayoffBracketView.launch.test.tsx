/**
 * Panneau commissaire de lancement des playoffs (affiché tant qu'aucun
 * bracket n'existe). Couvre le gating commissaire, le réglage de la
 * taille du bracket, la clôture anticipée conditionnelle et la
 * restitution des refus serveur.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlayoffBracketView } from "./PlayoffBracketView";

const apiRequestMock = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiClientError: class extends Error {},
}));

function bracketResponse(over: Record<string, unknown> = {}) {
  return {
    seasonId: "S1",
    playoffSize: 4,
    seasonStatus: "in_progress",
    rounds: [],
    regularSeasonComplete: true,
    poolQualification: {
      totalQualified: 4,
      playoffSize: 4,
      consistent: true,
    },
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PlayoffBracketView — panneau de lancement", () => {
  it("n'affiche rien pour un non-commissaire sans bracket", async () => {
    apiRequestMock.mockResolvedValue(bracketResponse());
    render(<PlayoffBracketView seasonId="S1" />);
    await waitFor(() => expect(apiRequestMock).toHaveBeenCalled());
    expect(screen.queryByTestId("playoff-launch-panel")).toBeNull();
  });

  it("affiche l'état et le bouton pour le commissaire", async () => {
    apiRequestMock.mockResolvedValue(bracketResponse());
    render(<PlayoffBracketView seasonId="S1" isCommissioner />);

    expect(await screen.findByTestId("playoff-launch-panel")).toBeTruthy();
    expect(screen.getByTestId("playoff-regular-state").textContent).toMatch(
      /terminée/,
    );
    expect(screen.getByTestId("playoff-pool-state").textContent).toMatch(
      /cohérent/,
    );
    // Phase régulière terminée -> pas de case de clôture anticipée.
    expect(screen.queryByTestId("playoff-force-close")).toBeNull();
  });

  it("propose la clôture anticipée quand la phase de poule est en cours", async () => {
    apiRequestMock.mockResolvedValue(
      bracketResponse({ regularSeasonComplete: false }),
    );
    render(<PlayoffBracketView seasonId="S1" isCommissioner />);

    expect(await screen.findByTestId("playoff-force-close")).toBeTruthy();
    fireEvent.click(screen.getByTestId("playoff-force-close"));
    fireEvent.click(screen.getByTestId("playoff-start-button"));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/leagues/seasons/S1/playoff/start",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ force: true }),
        }),
      ),
    );
  });

  it("lance les playoffs sans clôture anticipée par défaut", async () => {
    apiRequestMock.mockResolvedValue(bracketResponse());
    render(<PlayoffBracketView seasonId="S1" isCommissioner />);

    fireEvent.click(await screen.findByTestId("playoff-start-button"));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/leagues/seasons/S1/playoff/start",
        expect.objectContaining({ body: JSON.stringify({ force: false }) }),
      ),
    );
    // Succès : le bracket est rechargé (le panneau cède la place).
    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledTimes(3),
    );
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      "/leagues/seasons/S1/playoff-bracket",
    );
  });

  it("modifie la taille du bracket via PATCH config", async () => {
    apiRequestMock.mockResolvedValue(bracketResponse({ playoffSize: 0 }));
    render(<PlayoffBracketView seasonId="S1" isCommissioner />);

    const select = await screen.findByTestId("playoff-size-select");
    fireEvent.change(select, { target: { value: "8" } });

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/leagues/seasons/S1/config",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ playoffSize: 8 }),
        }),
      ),
    );
  });

  it("restitue un refus serveur avec son explication", async () => {
    apiRequestMock.mockImplementation((path: string) => {
      if (path.endsWith("/playoff/start")) {
        return Promise.reject(
          new Error(
            "Playoffs non demarres : pool-qualification-mismatch",
          ),
        );
      }
      return Promise.resolve(bracketResponse({ playoffSize: 4 }));
    });
    render(<PlayoffBracketView seasonId="S1" isCommissioner />);

    fireEvent.click(await screen.findByTestId("playoff-start-button"));

    const error = await screen.findByTestId("playoff-launch-error");
    expect(error.textContent).toMatch(/total des qualifiés par poule/i);
  });

  it("masque le panneau dès qu'un bracket existe", async () => {
    apiRequestMock.mockResolvedValue(
      bracketResponse({
        rounds: [
          {
            id: "r1",
            roundNumber: 8,
            bracketSlot: "final",
            status: "pending",
            pairings: [],
          },
        ],
      }),
    );
    render(<PlayoffBracketView seasonId="S1" isCommissioner />);

    expect(await screen.findByTestId("playoff-bracket")).toBeTruthy();
    expect(screen.queryByTestId("playoff-launch-panel")).toBeNull();
  });
});
