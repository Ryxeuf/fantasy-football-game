/**
 * Feuille de match saisie mais pas encore validée par le commissaire :
 * la page de la journée doit l'annoncer (« En attente validation »)
 * plutôt que d'afficher le statut du pairing, qui reste « Programmé »
 * jusqu'à la validation.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  SeasonCalendar,
  matchSheetPendingLabel,
  pairingScoreLabel,
} from "./SeasonCalendar";
import { LanguageProvider } from "../../contexts/LanguageContext";
import type { LeagueRoundDetail } from "./types";

vi.mock("./PairingBonusBreakdown", () => ({
  PairingBonusBreakdown: () => null,
}));

function round(
  sheetStatus: string | null,
  score?: { scoreHome: number | null; scoreAway: number | null },
): LeagueRoundDetail {
  return {
    id: "r1",
    roundNumber: 1,
    name: null,
    status: "pending",
    startDate: null,
    endDate: null,
    pairings: [
      {
        id: "pa1",
        status: "scheduled",
        scheduledAt: null,
        deadlineAt: null,
        homeParticipant: {
          id: "p1",
          teamId: "t1",
          team: { id: "t1", name: "Reikland", roster: "human", ownerId: "o1" },
        },
        awayParticipant: {
          id: "p2",
          teamId: "t2",
          team: { id: "t2", name: "Skavenblight", roster: "skaven", ownerId: "o2" },
        },
        match: null,
        matchSheet: sheetStatus
          ? { status: sheetStatus, ...(score ?? {}) }
          : null,
      },
    ],
  };
}

function renderCalendar(
  sheetStatus: string | null,
  score?: { scoreHome: number | null; scoreAway: number | null },
) {
  render(
    <LanguageProvider>
      <SeasonCalendar
        rounds={[round(sheetStatus, score)]}
        currentUserId={null}
      />
    </LanguageProvider>,
  );
}

describe("matchSheetPendingLabel", () => {
  it("signale l'attente de validation quand les 2 coachs ont soumis", () => {
    expect(matchSheetPendingLabel("both_submitted")).toBe(
      "En attente validation",
    );
  });

  it("distingue la saisie partielle (un seul coach)", () => {
    expect(matchSheetPendingLabel("submitted_home")).toBe(
      "En attente validation (1/2)",
    );
    expect(matchSheetPendingLabel("submitted_away")).toBe(
      "En attente validation (1/2)",
    );
  });

  it("ne signale rien pour un brouillon, une feuille validée ou absente", () => {
    expect(matchSheetPendingLabel("draft")).toBeNull();
    expect(matchSheetPendingLabel("validated")).toBeNull();
    expect(matchSheetPendingLabel("invalidated")).toBeNull();
    expect(matchSheetPendingLabel(null)).toBeNull();
    expect(matchSheetPendingLabel(undefined)).toBeNull();
  });
});

describe("SeasonCalendar — feuille en attente de validation", () => {
  it("affiche le badge d'attente à la place du statut du pairing", () => {
    renderCalendar("both_submitted");
    expect(screen.getByTestId("pairing-sheet-pending-pa1").textContent).toBe(
      "En attente validation",
    );
  });

  it("garde le statut du pairing quand la feuille est validée", () => {
    renderCalendar("validated");
    expect(screen.queryByTestId("pairing-sheet-pending-pa1")).toBeNull();
  });

  it("garde le statut du pairing sans feuille de match", () => {
    renderCalendar(null);
    expect(screen.queryByTestId("pairing-sheet-pending-pa1")).toBeNull();
  });
});

describe("pairingScoreLabel", () => {
  it("rend le score une fois la feuille validée", () => {
    expect(
      pairingScoreLabel({
        matchSheet: { status: "validated", scoreHome: 2, scoreAway: 1 },
      }),
    ).toBe("2 – 1");
  });

  it("rend un 0 – 0 validé (score légitime, pas une absence de score)", () => {
    expect(
      pairingScoreLabel({
        matchSheet: { status: "validated", scoreHome: 0, scoreAway: 0 },
      }),
    ).toBe("0 – 0");
  });

  it("ne rend rien tant que le commissaire n'a pas validé", () => {
    expect(
      pairingScoreLabel({
        matchSheet: { status: "both_submitted", scoreHome: 2, scoreAway: 1 },
      }),
    ).toBeNull();
  });

  it("ne rend rien pour une feuille invalidée ou absente", () => {
    expect(
      pairingScoreLabel({
        matchSheet: { status: "invalidated", scoreHome: 2, scoreAway: 1 },
      }),
    ).toBeNull();
    expect(pairingScoreLabel({ matchSheet: null })).toBeNull();
    expect(pairingScoreLabel({})).toBeNull();
  });

  it("ne rend rien si le score n'est pas exploitable (API pré-score)", () => {
    expect(pairingScoreLabel({ matchSheet: { status: "validated" } })).toBeNull();
    expect(
      pairingScoreLabel({
        matchSheet: { status: "validated", scoreHome: 2, scoreAway: null },
      }),
    ).toBeNull();
  });
});

describe("SeasonCalendar — résultat validé", () => {
  it("affiche le score à la place du statut « Joué »", () => {
    renderCalendar("validated", { scoreHome: 3, scoreAway: 1 });
    expect(screen.getByTestId("pairing-score-pa1").textContent).toBe("3 – 1");
    // Plus de badge d'attente, et le statut du pairing s'efface.
    expect(screen.queryByTestId("pairing-sheet-pending-pa1")).toBeNull();
  });

  it("garde l'attente de validation tant que le commissaire n'a pas tranché", () => {
    renderCalendar("both_submitted", { scoreHome: 3, scoreAway: 1 });
    expect(screen.queryByTestId("pairing-score-pa1")).toBeNull();
    expect(screen.getByTestId("pairing-sheet-pending-pa1").textContent).toBe(
      "En attente validation",
    );
  });

  it("retombe sur le statut quand la feuille validée n'a pas de score", () => {
    renderCalendar("validated");
    expect(screen.queryByTestId("pairing-score-pa1")).toBeNull();
  });
});
