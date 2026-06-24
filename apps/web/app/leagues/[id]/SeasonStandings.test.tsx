import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { SeasonStandings } from "./SeasonStandings";
import type { StandingRow } from "./types";

// E2 — Tests de la colonne "Bonus" du classement (sous-total des points
// bonus snapshotés, déjà inclus dans le total).

function row(over: Partial<StandingRow> & { participantId: string }): StandingRow {
  return {
    teamId: `${over.participantId}-team`,
    teamName: over.participantId,
    roster: "humans",
    ownerId: `${over.participantId}-owner`,
    coachName: null,
    played: 1,
    wins: 1,
    draws: 0,
    losses: 0,
    points: 4,
    touchdownsFor: 3,
    touchdownsAgainst: 1,
    touchdownDifference: 2,
    casualtiesFor: 1,
    casualtiesAgainst: 0,
    seasonElo: 1000,
    status: "active",
    ...over,
  };
}

function renderStandings(rows: StandingRow[]) {
  render(
    <LanguageProvider>
      <SeasonStandings rows={rows} />
    </LanguageProvider>,
  );
}

describe("SeasonStandings — colonne Bonus (E2)", () => {
  it("affiche la colonne Bonus quand au moins une équipe a un bonus non nul", () => {
    renderStandings([
      row({ participantId: "p1", bonusPoints: 2 }),
      row({ participantId: "p2", bonusPoints: 0 }),
    ]);
    expect(screen.getByTestId("standings-bonus-header")).toBeTruthy();
    expect(
      screen.getByTestId("standings-row-p1-bonus").textContent,
    ).toContain("2");
    expect(
      screen.getByTestId("standings-row-p2-bonus").textContent,
    ).toContain("0");
  });

  it("masque la colonne Bonus quand aucune équipe n'a de bonus", () => {
    renderStandings([
      row({ participantId: "p1", bonusPoints: 0 }),
      row({ participantId: "p2", bonusPoints: 0 }),
    ]);
    expect(screen.queryByTestId("standings-bonus-header")).toBeNull();
    expect(screen.queryByTestId("standings-row-p1-bonus")).toBeNull();
  });

  it("traite bonusPoints absent comme 0 (rétro-compat pré-E2)", () => {
    renderStandings([row({ participantId: "p1" })]);
    expect(screen.queryByTestId("standings-bonus-header")).toBeNull();
  });

  it("affiche aussi la colonne pour un bonus négatif (malus)", () => {
    renderStandings([row({ participantId: "p1", bonusPoints: -1 })]);
    expect(screen.getByTestId("standings-bonus-header")).toBeTruthy();
    expect(
      screen.getByTestId("standings-row-p1-bonus").textContent,
    ).toContain("-1");
  });
});
