/**
 * Feuille de match saisie mais pas encore validée par le commissaire :
 * la page de la journée doit l'annoncer (« En attente validation »)
 * plutôt que d'afficher le statut du pairing, qui reste « Programmé »
 * jusqu'à la validation.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeasonCalendar, matchSheetPendingLabel } from "./SeasonCalendar";
import { LanguageProvider } from "../../contexts/LanguageContext";
import type { LeagueRoundDetail } from "./types";

vi.mock("./PairingBonusBreakdown", () => ({
  PairingBonusBreakdown: () => null,
}));

function round(sheetStatus: string | null): LeagueRoundDetail {
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
        matchSheet: sheetStatus ? { status: sheetStatus } : null,
      },
    ],
  };
}

function renderCalendar(sheetStatus: string | null) {
  render(
    <LanguageProvider>
      <SeasonCalendar rounds={[round(sheetStatus)]} currentUserId={null} />
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
