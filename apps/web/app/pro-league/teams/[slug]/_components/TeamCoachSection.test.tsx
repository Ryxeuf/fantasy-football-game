import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import TeamCoachSection, { topTraits, type TeamCoach } from "./TeamCoachSection";

const coach: TeamCoach = {
  name: "Thrud Bonecrusher",
  philosophy: "Cogneur, posé",
  experience: 4,
  profile: { bashIndex: 90, pace: 20, patience: 55, passingFrequency: 50, riskAppetite: 30 },
  recentEvolutions: [
    { matchId: "m1", summary: "3 drives, 2 TD marqués, 0 encaissé, 1 turnover. Le coach ajuste : bashIndex +2.", createdAt: "2026-10-01T10:00:00Z" },
    { matchId: null, summary: "Réinitialisation par l'admin : retour au profil de race.", createdAt: "2026-09-28T10:00:00Z" },
  ],
};

describe("topTraits", () => {
  it("classe les traits par écart à 50, les plus marqués d'abord", () => {
    const traits = topTraits(coach.profile, 3);
    expect(traits.map((t) => t.label)).toEqual(["Bagarre", "Allure", "Risque"]);
    expect(traits[0].value).toBe(90);
  });

  it("vaut 50 pour un paramètre absent", () => {
    expect(topTraits({}, 1)[0].value).toBe(50);
  });
});

describe("TeamCoachSection", () => {
  it("ne rend rien sans coach", () => {
    const { container } = render(<TeamCoachSection coach={null} />);
    expect(container.innerHTML).toBe("");
    expect(render(<TeamCoachSection coach={undefined} />).container.innerHTML).toBe("");
  });

  it("affiche nom, philosophie, expérience, traits et évolutions", () => {
    render(<TeamCoachSection coach={coach} />);
    expect(screen.getByTestId("team-coach-name").textContent).toBe("Thrud Bonecrusher");
    expect(screen.getByTestId("team-coach-philosophy").textContent).toBe("Cogneur, posé");
    expect(screen.getByText(/4 matchs au compteur/)).toBeTruthy();
    expect(screen.getByTestId("team-coach-traits").querySelectorAll("li")).toHaveLength(4);
    expect(screen.getByTestId("team-coach-evolutions").querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText(/bashIndex \+2/)).toBeTruthy();
  });

  it("omet la liste des évolutions quand elle est vide", () => {
    render(<TeamCoachSection coach={{ ...coach, experience: 1, recentEvolutions: [] }} />);
    expect(screen.queryByTestId("team-coach-evolutions")).toBeNull();
    expect(screen.getByText(/1 match au compteur/)).toBeTruthy();
  });
});
