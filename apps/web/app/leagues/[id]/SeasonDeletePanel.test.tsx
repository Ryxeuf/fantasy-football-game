/**
 * Zone de danger « Supprimer la saison » : visible du commissaire / admin,
 * refus annoncé quand le calendrier montre un résultat, confirmation par le
 * nom exact, refus serveur affiché tel quel.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { LeaguePairingDetail, LeagueRoundDetail } from "./types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const apiRequest = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import { SeasonDeletePanel, seasonHasPlayedEffects } from "./SeasonDeletePanel";

function pairing(over: Partial<LeaguePairingDetail> = {}): LeaguePairingDetail {
  return {
    id: "pa",
    status: "scheduled",
    scheduledAt: null,
    deadlineAt: null,
    homeParticipant: {
      id: "a",
      teamId: "ta",
      team: { id: "ta", name: "A", roster: "human", ownerId: "o1" },
    },
    awayParticipant: {
      id: "b",
      teamId: "tb",
      team: { id: "tb", name: "B", roster: "orc", ownerId: "o2" },
    },
    match: null,
    ...over,
  };
}

function rounds(...pairings: LeaguePairingDetail[]): LeagueRoundDetail[] {
  return [
    {
      id: "r1",
      roundNumber: 1,
      name: null,
      status: "pending",
      startDate: null,
      endDate: null,
      pairings,
    },
  ];
}

function renderPanel(
  r: LeagueRoundDetail[],
  { canManage = true, onDeleted = vi.fn() } = {},
) {
  render(
    <SeasonDeletePanel
      season={{ id: "s-1", name: "Saison 2027", rounds: r, participantsCount: 4 }}
      canManage={canManage}
      onDeleted={onDeleted}
    />,
  );
  return onDeleted;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("seasonHasPlayedEffects", () => {
  it.each([
    ["calendrier vide", [], false],
    ["rencontres à jouer", rounds(pairing()), false],
    ["brouillon / soumise", rounds(pairing({ matchSheet: { status: "both_submitted" } })), false],
    ["rencontre jouée", rounds(pairing({ status: "played" })), true],
    ["forfait", rounds(pairing({ status: "forfeit_home" })), true],
    ["feuille validée", rounds(pairing({ matchSheet: { status: "validated" } })), true],
    ["feuille invalidée", rounds(pairing({ matchSheet: { status: "invalidated" } })), true],
  ] as const)("%s ⇒ %s", (_l, r, expected) => {
    expect(seasonHasPlayedEffects(r)).toBe(expected);
  });
});

describe("SeasonDeletePanel", () => {
  it("rien pour un coach qui ne gère pas la ligue", () => {
    renderPanel(rounds(), { canManage: false });
    expect(screen.queryByTestId("season-delete-panel")).toBeNull();
  });

  it("saison jouée : renvoie vers clôturer / archiver, pas de bouton", () => {
    renderPanel(rounds(pairing({ status: "played" })));
    expect(screen.getByTestId("season-delete-played").textContent).toMatch(
      /Clôturez-la, ou archivez la ligue/,
    );
    expect(screen.queryByTestId("season-delete-open")).toBeNull();
  });

  it("confirmation par le nom exact, puis DELETE et rappel", async () => {
    apiRequest.mockResolvedValue({ deleted: true });
    const onDeleted = renderPanel(rounds(pairing(), pairing({ id: "pb" })));

    fireEvent.click(screen.getByTestId("season-delete-open"));
    expect(screen.getByTestId("season-delete-panel").textContent).toContain(
      "2 rencontre(s) à jouer",
    );
    const button = screen.getByTestId("season-delete-button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByTestId("season-delete-confirm-input"), {
      target: { value: "Saison 20" },
    });
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("season-delete-confirm-input"), {
      target: { value: "  saison 2027 " },
    });
    expect(button.disabled).toBe(false);

    fireEvent.click(button);
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/leagues/seasons/s-1", {
        method: "DELETE",
      }),
    );
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });

  it("affiche le refus du serveur (ex. match en ligne déjà reporté)", async () => {
    apiRequest.mockRejectedValue(
      new Error("Suppression impossible : 1 match(s) deja reporte(s) au classement."),
    );
    const onDeleted = renderPanel(rounds());
    fireEvent.click(screen.getByTestId("season-delete-open"));
    fireEvent.change(screen.getByTestId("season-delete-confirm-input"), {
      target: { value: "Saison 2027" },
    });
    fireEvent.click(screen.getByTestId("season-delete-button"));
    expect((await screen.findByTestId("season-delete-error")).textContent).toContain(
      "deja reporte(s) au classement",
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
