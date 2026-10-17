/**
 * Classement de coupe : le nom de chaque équipe mène à sa fiche de roster
 * de coupe (roster d'inscription), comme le classement de ligue.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CupStandings, { type CupStandingRow } from "./CupStandings";

const row = (teamId: string, teamName: string): CupStandingRow => ({
  teamId,
  teamName,
  roster: "orc",
  matchesPlayed: 1,
  wins: 1,
  draws: 0,
  losses: 0,
  touchdownsFor: 2,
  touchdownsAgainst: 0,
  touchdownDiff: 2,
  passes: 0,
  blockCasualties: 1,
  foulCasualties: 0,
  totalPoints: 1013,
});

describe("CupStandings — accès au roster", () => {
  it("rend chaque nom cliquable vers /cups/:id/teams/:teamId", () => {
    render(<CupStandings standings={[row("t1", "Orcs"), row("t2", "Rats")]} cupId="C1" />);
    expect(
      screen.getByTestId("team-roster-link-standings-t1").getAttribute("href"),
    ).toBe("/cups/C1/teams/t1");
    expect(
      screen.getByTestId("team-roster-link-standings-t2").getAttribute("href"),
    ).toBe("/cups/C1/teams/t2");
  });

  it("garde le texte seul sans coupe de consultation", () => {
    render(<CupStandings standings={[row("t1", "Orcs")]} />);
    expect(screen.queryByTestId("team-roster-link-standings-t1")).toBeNull();
    expect(screen.getByText("Orcs")).toBeTruthy();
  });
});
