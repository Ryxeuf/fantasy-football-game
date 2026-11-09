/**
 * Éditeur de calendrier : renommer et supprimer une journée.
 * La règle d'affichage (bouton grisé + raison) est un miroir du serveur ; le
 * refus serveur, lui, s'affiche tel quel.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type {
  LeagueParticipantDetail,
  LeaguePairingDetail,
  LeagueRoundDetail,
} from "./types";

const apiRequest = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import {
  ManualScheduleEditor,
  roundDeletionBlocker,
  roundDeletionSummary,
  roundLabel,
} from "./ManualScheduleEditor";

function participant(id: string, ownerId: string): LeagueParticipantDetail {
  return {
    id,
    seasonElo: 1000,
    status: "active",
    teamId: `t-${id}`,
    team: {
      id: `t-${id}`,
      name: `Equipe ${id}`,
      roster: "human",
      owner: { id: ownerId, coachName: `Coach ${ownerId}` },
    },
  };
}

function pairing(over: Partial<LeaguePairingDetail> = {}): LeaguePairingDetail {
  return {
    id: "pa-1",
    status: "scheduled",
    scheduledAt: null,
    deadlineAt: null,
    homeParticipant: {
      id: "a",
      teamId: "t-a",
      team: { id: "t-a", name: "Equipe a", roster: "human", ownerId: "o1" },
    },
    awayParticipant: {
      id: "b",
      teamId: "t-b",
      team: { id: "t-b", name: "Equipe b", roster: "human", ownerId: "o2" },
    },
    match: null,
    ...over,
  };
}

function round(over: Partial<LeagueRoundDetail> = {}): LeagueRoundDetail {
  return {
    id: "r-1",
    roundNumber: 3,
    name: "Derby",
    status: "pending",
    kind: "regular",
    bracketSlot: null,
    startDate: null,
    endDate: null,
    pairings: [pairing()],
    ...over,
  };
}

function renderEditor(rounds: LeagueRoundDetail[], onChanged = vi.fn()) {
  render(
    <ManualScheduleEditor
      seasonId="s-1"
      rounds={rounds}
      participants={[participant("a", "o1"), participant("b", "o2")]}
      onChanged={onChanged}
    />,
  );
  fireEvent.click(screen.getByTestId("open-manual-schedule"));
  return onChanged;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("règles d'affichage", () => {
  it("roundLabel : le nom, sinon « Journée N »", () => {
    expect(roundLabel({ roundNumber: 2, name: "Derby" })).toBe("Derby");
    expect(roundLabel({ roundNumber: 2, name: null })).toBe("Journée 2");
    expect(roundLabel({ roundNumber: 2, name: "  " })).toBe("Journée 2");
  });

  it("roundDeletionSummary annonce les rencontres et pronostics emportés", () => {
    expect(roundDeletionSummary(0)).toBe("La journée est vide.");
    expect(roundDeletionSummary(1)).toContain("1 rencontre à jouer et leurs pronostics");
    expect(roundDeletionSummary(3)).toContain("3 rencontres à jouer");
  });

  it.each([
    ["journée à jouer", round(), null],
    ["brouillon de feuille", round({ pairings: [pairing({ matchSheet: { status: "draft" } })] }), null],
    ["play-off (kind)", round({ kind: "playoff" }), "play-off"],
    ["play-off (slot)", round({ bracketSlot: "final" }), "play-off"],
    ["rencontre jouée", round({ pairings: [pairing({ status: "played" })] }), "jouée"],
    ["forfait", round({ pairings: [pairing({ status: "forfeit_away" })] }), "forfait"],
    ["match lancé", round({ pairings: [pairing({ match: { id: "m", status: "active" } })] }), "match lancé"],
    ["feuille soumise", round({ pairings: [pairing({ matchSheet: { status: "submitted_home" } })] }), "soumise"],
  ] as const)("roundDeletionBlocker — %s", (_l, given, fragment) => {
    const blocker = roundDeletionBlocker(given);
    if (fragment === null) expect(blocker).toBeNull();
    else expect(blocker).toContain(fragment);
  });
});

describe("ManualScheduleEditor — journées", () => {
  it("renomme une journée en ligne (PATCH du nom rogné)", async () => {
    apiRequest.mockResolvedValue({});
    const onChanged = renderEditor([round()]);

    fireEvent.click(screen.getByTestId("manual-rename-round-r-1"));
    const input = screen.getByTestId("manual-round-name-r-1") as HTMLInputElement;
    expect(input.value).toBe("Derby");
    fireEvent.change(input, { target: { value: "  Grand Derby " } });
    fireEvent.click(screen.getByTestId("manual-round-name-save-r-1"));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/leagues/rounds/r-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Grand Derby" }),
      }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("un nom vidé revient au nom par défaut (name: \"\")", async () => {
    apiRequest.mockResolvedValue({});
    renderEditor([round()]);
    fireEvent.click(screen.getByTestId("manual-rename-round-r-1"));
    fireEvent.change(screen.getByTestId("manual-round-name-r-1"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByTestId("manual-round-name-save-r-1"));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/leagues/rounds/r-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "" }),
      }),
    );
  });

  it("supprime après une confirmation explicite", async () => {
    apiRequest.mockResolvedValue({ deleted: true });
    const onChanged = renderEditor([round()]);

    fireEvent.click(screen.getByTestId("manual-delete-round-r-1"));
    // Rien n'est parti avant la confirmation.
    expect(apiRequest).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("manual-delete-round-confirm-box-r-1").textContent,
    ).toContain("1 rencontre à jouer et leurs pronostics");

    fireEvent.click(screen.getByTestId("manual-delete-round-confirm-r-1"));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/leagues/rounds/r-1", {
        method: "DELETE",
      }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("annuler la confirmation ne supprime rien", () => {
    renderEditor([round()]);
    fireEvent.click(screen.getByTestId("manual-delete-round-r-1"));
    fireEvent.click(screen.getByText("Annuler"));
    expect(screen.queryByTestId("manual-delete-round-confirm-box-r-1")).toBeNull();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("journée jouée : bouton grisé et raison affichée", () => {
    renderEditor([round({ pairings: [pairing({ status: "played" })] })]);
    const button = screen.getByTestId("manual-delete-round-r-1") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(
      screen.getByTestId("manual-delete-round-blocked-r-1").textContent,
    ).toContain("Suppression impossible");
  });

  it("affiche le refus du serveur tel quel", async () => {
    apiRequest.mockRejectedValue(
      new Error("Un match de cette journee est deja reporte au classement : suppression impossible"),
    );
    renderEditor([round()]);
    fireEvent.click(screen.getByTestId("manual-delete-round-r-1"));
    fireEvent.click(screen.getByTestId("manual-delete-round-confirm-r-1"));
    expect(
      await screen.findByText(/deja reporte au classement/),
    ).toBeTruthy();
  });
});
