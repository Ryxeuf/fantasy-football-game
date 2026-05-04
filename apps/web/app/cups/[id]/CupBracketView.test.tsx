/**
 * S27.1j — Tests du composant `CupBracketView`.
 *
 * Affiche la grille visuelle des matches d'une cup (chronologique +
 * statut + score). Foundation pour un futur vrai bracket
 * d'elimination (necessite l'infra round/seed pas encore en place).
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CupBracketView from "./CupBracketView";

type CupMatchUI = {
  id: string;
  name: string | null;
  status: string;
  isPublic: boolean;
  teamA: { id: string; name: string; roster: string; ruleset: string };
  teamB: { id: string; name: string; roster: string; ruleset: string } | null;
  scoreTeamA: number | null;
  scoreTeamB: number | null;
  createdAt: string;
};

const completedMatch: CupMatchUI = {
  id: "m-completed",
  name: "Final",
  status: "completed",
  isPublic: true,
  teamA: { id: "tA", name: "Skaven Stars", roster: "skaven", ruleset: "season_3" },
  teamB: { id: "tB", name: "Nordic Wolves", roster: "norse", ruleset: "season_3" },
  scoreTeamA: 3,
  scoreTeamB: 1,
  createdAt: "2026-04-15T10:00:00.000Z",
};

const pendingMatch: CupMatchUI = {
  id: "m-pending",
  name: "Match 2",
  status: "pending",
  isPublic: true,
  teamA: { id: "tA", name: "Skaven Stars", roster: "skaven", ruleset: "season_3" },
  teamB: null,
  scoreTeamA: null,
  scoreTeamB: null,
  createdAt: "2026-04-16T10:00:00.000Z",
};

describe("CupBracketView (S27.1j)", () => {
  it("ne rend rien quand matches est undefined", () => {
    const { container } = render(<CupBracketView matches={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("ne rend rien quand matches est vide", () => {
    const { container } = render(<CupBracketView matches={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("affiche un noeud par match avec teams + statut", () => {
    render(<CupBracketView matches={[completedMatch, pendingMatch]} />);
    expect(screen.getByTestId("cup-bracket-view")).toBeTruthy();
    const nodes = screen.getAllByTestId(/^cup-bracket-match-/);
    expect(nodes).toHaveLength(2);
  });

  it("affiche le score quand un match est completed", () => {
    render(<CupBracketView matches={[completedMatch]} />);
    const node = screen.getByTestId("cup-bracket-match-m-completed");
    expect(node.textContent).toContain("Skaven Stars");
    expect(node.textContent).toContain("Nordic Wolves");
    expect(node.textContent).toMatch(/3.*1/);
  });

  it("masque le score quand le match est pending et indique l'adversaire absent", () => {
    render(<CupBracketView matches={[pendingMatch]} />);
    const node = screen.getByTestId("cup-bracket-match-m-pending");
    expect(node.textContent).toContain("Skaven Stars");
    // pas de score affiche
    expect(node.textContent).not.toMatch(/\d+\s*[-–]\s*\d+/);
  });

  it("trie les matchs par createdAt ASC pour une lecture chronologique", () => {
    // pendingMatch est plus recent que completedMatch
    render(<CupBracketView matches={[pendingMatch, completedMatch]} />);
    const nodes = screen.getAllByTestId(/^cup-bracket-match-/);
    expect(nodes[0].getAttribute("data-testid")).toBe(
      "cup-bracket-match-m-completed",
    );
    expect(nodes[1].getAttribute("data-testid")).toBe(
      "cup-bracket-match-m-pending",
    );
  });

  it("met en evidence le vainqueur via data-winner='A'|'B'|'draw'", () => {
    render(<CupBracketView matches={[completedMatch]} />);
    const node = screen.getByTestId("cup-bracket-match-m-completed");
    expect(node.getAttribute("data-winner")).toBe("A");
  });
});
