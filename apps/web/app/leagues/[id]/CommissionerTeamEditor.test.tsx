/**
 * Éditeur commissaire — suppression de joueurs.
 *
 * Règle : le bouton 🗑 n'apparaît qu'en pré-saison (`canRemovePlayers`),
 * SAUF pour un joueur MORT, retirable à tout moment (retrait doux côté
 * serveur, sans licenciement — la fiche et l'historique sont conservés).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { CommissionerTeamEditor } from "./CommissionerTeamEditor";

const apiRequestMock = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiClientError: class extends Error {},
}));

const ROSTER = {
  team: {
    id: "T1",
    name: "Reikland Reavers",
    roster: "human",
    treasury: 50_000,
    ruleset: "season_3",
  },
  players: [
    {
      id: "alive1",
      name: "Griff",
      position: "human_blitzer",
      number: 7,
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: "block",
      spp: 12,
      dead: false,
    },
    {
      id: "dead1",
      name: "Feu Igor",
      position: "human_lineman",
      number: 12,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: "",
      spp: 2,
      dead: true,
    },
  ],
  accessByPosition: {},
};

function mockApi() {
  apiRequestMock.mockImplementation((path: string) => {
    if (typeof path === "string" && path.includes("/roster")) {
      return Promise.resolve(ROSTER);
    }
    if (typeof path === "string" && path.startsWith("/api/skills")) {
      return Promise.resolve({ skills: [] });
    }
    return Promise.resolve({});
  });
}

function renderEditor(canRemovePlayers: boolean) {
  return render(
    <CommissionerTeamEditor
      leagueId="L1"
      teamId="T1"
      teamName="Reikland Reavers"
      open
      canRemovePlayers={canRemovePlayers}
      onClose={() => {}}
    />,
  );
}

describe("CommissionerTeamEditor — suppression de joueurs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockApi();
  });

  it("saison démarrée : seul le joueur MORT garde un bouton de retrait", async () => {
    renderEditor(false);
    await waitFor(() =>
      expect(screen.getByTestId("player-edit-dead1")).toBeTruthy(),
    );

    expect(screen.queryByTestId("remove-player-alive1")).toBeNull();
    const deadButton = screen.getByTestId("remove-player-dead1");
    expect(deadButton.textContent).toContain("Retirer");
  });

  it("pré-saison : tous les joueurs sont supprimables (mort inclus)", async () => {
    renderEditor(true);
    await waitFor(() =>
      expect(screen.getByTestId("player-edit-alive1")).toBeTruthy(),
    );

    expect(screen.getByTestId("remove-player-alive1").textContent).toContain(
      "Supprimer",
    );
    expect(screen.getByTestId("remove-player-dead1").textContent).toContain(
      "Retirer",
    );
  });

  it("le retrait d'un mort appelle DELETE après confirmation inline", async () => {
    renderEditor(false);
    await waitFor(() =>
      expect(screen.getByTestId("player-edit-dead1")).toBeTruthy(),
    );

    fireEvent.click(screen.getByTestId("remove-player-dead1"));
    fireEvent.click(screen.getByTestId("confirm-remove-player-dead1"));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/leagues/L1/teams/T1/players/dead1",
        { method: "DELETE" },
      ),
    );
  });
});
