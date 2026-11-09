/**
 * Réinitialisation du bracket de play-offs par le commissaire : bouton
 * présent pour lui seul, grisé dès qu'une rencontre est engagée, confirmation
 * en deux temps avant l'appel au serveur.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PlayoffBracketView } from "./PlayoffBracketView";
import {
  canResetBracket,
  isBracketPairingEngaged,
} from "./playoff-bracket-edit";

const apiRequestMock = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiClientError: class extends Error {},
}));

function team(id: string, name: string) {
  return { id, name, roster: "human", owner: { id: `u-${id}`, coachName: name } };
}

function bracket(pairingOver: Record<string, unknown> = {}) {
  return {
    seasonId: "S1",
    playoffSize: 2,
    seasonStatus: "in_progress",
    playoffsPublished: false,
    rounds: [
      {
        id: "r-final",
        roundNumber: 5,
        bracketSlot: "final",
        status: "pending",
        pairings: [
          {
            id: "p1",
            status: "scheduled",
            match: null,
            matchSheet: null,
            homeParticipant: { id: "pa1", team: team("t1", "Reikland") },
            awayParticipant: { id: "pa2", team: team("t2", "Gouged Eye") },
            ...pairingOver,
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("playoff-bracket-edit (pur)", () => {
  const base = {
    id: "p",
    status: "scheduled",
    match: null,
    homeParticipant: { id: "a" },
    awayParticipant: { id: "b" },
  };
  it.each([
    [{}, false],
    [{ matchSheet: { status: "draft" } }, false],
    [{ status: "cancelled" }, false],
    [{ status: "played" }, true],
    [{ match: { id: "m" } }, true],
    [{ matchSheet: { status: "both_submitted" } }, true],
  ])("%j ⇒ engagée=%s", (over, expected) => {
    expect(isBracketPairingEngaged({ ...base, ...over })).toBe(expected);
  });

  it("canResetBracket : faux sans bracket ou avec une rencontre engagée", () => {
    expect(canResetBracket([])).toBe(false);
    expect(canResetBracket([{ pairings: [base] }])).toBe(true);
    expect(
      canResetBracket([{ pairings: [base] }, { pairings: [{ ...base, status: "played" }] }]),
    ).toBe(false);
  });
});

describe("PlayoffBracketView — réinitialisation", () => {
  it("un coach ne voit pas le bouton", async () => {
    apiRequestMock.mockResolvedValue({ ...bracket(), playoffsPublished: true });
    render(<PlayoffBracketView seasonId="S1" />);
    expect(await screen.findByTestId("playoff-bracket")).toBeTruthy();
    expect(screen.queryByTestId("playoff-reset-button")).toBeNull();
  });

  it("le commissaire confirme puis réinitialise", async () => {
    apiRequestMock.mockResolvedValueOnce(bracket());
    apiRequestMock.mockResolvedValueOnce({ seasonId: "S1", roundsDeleted: 1 });
    apiRequestMock.mockResolvedValue({ ...bracket(), rounds: [] });
    const onChanged = vi.fn();
    render(
      <PlayoffBracketView seasonId="S1" isCommissioner onChanged={onChanged} />,
    );

    fireEvent.click(await screen.findByTestId("playoff-reset-button"));
    // Rien n'est envoyé avant la confirmation.
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("playoff-reset-confirm"));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/leagues/seasons/S1/playoff-bracket/reset",
        { method: "POST" },
      ),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("bouton grisé dès qu'une rencontre a une feuille soumise", async () => {
    apiRequestMock.mockResolvedValue(
      bracket({ matchSheet: { status: "submitted_home" } }),
    );
    render(<PlayoffBracketView seasonId="S1" isCommissioner />);
    const btn = (await screen.findByTestId(
      "playoff-reset-button",
    )) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("affiche le refus du serveur", async () => {
    apiRequestMock.mockResolvedValueOnce(bracket());
    apiRequestMock.mockRejectedValueOnce(new Error("Rencontre engagée"));
    render(<PlayoffBracketView seasonId="S1" isCommissioner />);
    fireEvent.click(await screen.findByTestId("playoff-reset-button"));
    fireEvent.click(screen.getByTestId("playoff-reset-confirm"));
    expect(
      (await screen.findByTestId("playoff-reset-error")).textContent,
    ).toMatch(/Rencontre engagée/);
  });
});
