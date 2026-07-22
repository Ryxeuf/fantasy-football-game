/**
 * Tests pour `CaptainPanel` (règle spéciale d'équipe "Capitaine").
 *
 * Couvre :
 *   - roster sans la règle → panneau masqué ;
 *   - capitaine actif → badge + pas de sélecteur si équipe engagée ;
 *   - capitaine perdu (mort/licencié) → alerte + désignation du successeur ;
 *   - désignation → POST /team/:id/captain + refresh + onDesignated ;
 *   - erreur API → message affiché ;
 *   - erreur réseau au chargement → panneau masqué.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../../lib/api-client", () => {
  class ApiClientError extends Error {
    constructor(
      message: string,
      public readonly status?: number,
      public readonly code?: string,
    ) {
      super(message);
      this.name = "ApiClientError";
    }
  }
  return { apiRequest: vi.fn(), ApiClientError };
});

import { apiRequest, ApiClientError } from "../../../lib/api-client";
import CaptainPanel from "./CaptainPanel";

const mockedApi = vi.mocked(apiRequest);
const TEAM_ID = "team-1";

function makeStatus(overrides: Record<string, unknown> = {}) {
  return {
    hasCaptainRule: true,
    captain: null,
    lostCaptain: null,
    canDesignate: true,
    frozen: false,
    eligiblePlayers: [
      { id: "p1", name: "Grim", number: 1, position: "human_blitzer" },
      { id: "p2", name: "Boro", number: 2, position: "human_lineman" },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CaptainPanel", () => {
  it("masqué si le roster n'a pas la règle", async () => {
    mockedApi.mockResolvedValueOnce(makeStatus({ hasCaptainRule: false }));
    const { container } = render(<CaptainPanel teamId={TEAM_ID} />);
    await waitFor(() => expect(mockedApi).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="captain-panel"]')).toBeNull();
  });

  it("masqué en cas d'erreur réseau au chargement", async () => {
    mockedApi.mockRejectedValueOnce(new Error("boom"));
    const { container } = render(<CaptainPanel teamId={TEAM_ID} />);
    await waitFor(() => expect(mockedApi).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="captain-panel"]')).toBeNull();
  });

  it("affiche le capitaine actif sans sélecteur quand équipe engagée", async () => {
    mockedApi.mockResolvedValueOnce(
      makeStatus({
        captain: { id: "cap", name: "Grim", number: 4, position: "human_blitzer" },
        canDesignate: false,
        frozen: true,
        eligiblePlayers: [],
      }),
    );
    render(<CaptainPanel teamId={TEAM_ID} />);
    await waitFor(() => {
      expect(screen.getByTestId("captain-current").textContent).toContain(
        "#4 Grim",
      );
    });
    expect(screen.queryByTestId("captain-select")).toBeNull();
  });

  it("capitaine perdu → alerte + sélecteur de successeur", async () => {
    mockedApi.mockResolvedValueOnce(
      makeStatus({
        lostCaptain: {
          id: "cap",
          name: "Grim",
          number: 4,
          position: "human_blitzer",
          dead: true,
          fired: false,
        },
        frozen: true,
      }),
    );
    render(<CaptainPanel teamId={TEAM_ID} />);
    await waitFor(() => {
      expect(screen.getByTestId("captain-lost-banner").textContent).toContain(
        "mort",
      );
    });
    expect(screen.getByTestId("captain-select")).toBeTruthy();
  });

  it("désigne un capitaine : POST + refresh + onDesignated", async () => {
    const onDesignated = vi.fn();
    mockedApi
      // 1. chargement initial
      .mockResolvedValueOnce(makeStatus())
      // 2. POST désignation
      .mockResolvedValueOnce({
        captain: { id: "p1", name: "Grim", number: 1, position: "human_blitzer", skills: "block,pro" },
        proGranted: true,
      })
      // 3. refresh du statut
      .mockResolvedValueOnce(
        makeStatus({
          captain: { id: "p1", name: "Grim", number: 1, position: "human_blitzer" },
          eligiblePlayers: [
            { id: "p2", name: "Boro", number: 2, position: "human_lineman" },
          ],
        }),
      );

    render(<CaptainPanel teamId={TEAM_ID} onDesignated={onDesignated} />);
    await waitFor(() => expect(screen.getByTestId("captain-select")).toBeTruthy());

    fireEvent.change(screen.getByTestId("captain-select"), {
      target: { value: "p1" },
    });
    fireEvent.click(screen.getByTestId("captain-designate-btn"));

    await waitFor(() => expect(onDesignated).toHaveBeenCalled());
    expect(mockedApi).toHaveBeenCalledWith(`/team/${TEAM_ID}/captain`, {
      method: "POST",
      body: JSON.stringify({ playerId: "p1" }),
    });
    await waitFor(() => {
      expect(screen.getByTestId("captain-current").textContent).toContain(
        "#1 Grim",
      );
    });
  });

  it("affiche le message d'erreur API en cas d'échec de désignation", async () => {
    mockedApi
      .mockResolvedValueOnce(makeStatus())
      .mockRejectedValueOnce(
        new ApiClientError("Un Gros Bras ne peut pas être désigné capitaine", 400),
      );

    render(<CaptainPanel teamId={TEAM_ID} />);
    await waitFor(() => expect(screen.getByTestId("captain-select")).toBeTruthy());

    fireEvent.change(screen.getByTestId("captain-select"), {
      target: { value: "p1" },
    });
    fireEvent.click(screen.getByTestId("captain-designate-btn"));

    await waitFor(() => {
      expect(
        screen.getByText("Un Gros Bras ne peut pas être désigné capitaine"),
      ).toBeTruthy();
    });
  });
});
