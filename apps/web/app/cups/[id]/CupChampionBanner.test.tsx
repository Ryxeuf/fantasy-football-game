import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CupChampionBanner } from "./CupChampionBanner";

const TEAM = { id: "t1", name: "Les Gobbos", roster: "goblin", coachName: "Bob" };

describe("CupChampionBanner", () => {
  it("annonce le vainqueur de la finale, lien vers son roster, et l'Oracle", () => {
    render(
      <CupChampionBanner
        cupId="cup-1"
        champion={{ team: TEAM, source: "final", finalScore: "2 – 1" }}
        oracles={[{ userId: "u1", displayName: "Alice", rank: 1, points: 11 }]}
      />,
    );
    expect(
      screen.getByTestId("team-roster-link-champion").getAttribute("href"),
    ).toBe("/cups/cup-1/teams/t1");
    expect(screen.getByTestId("cup-champion-detail").textContent).toBe(
      "Coach Bob · vainqueur de la finale (2 – 1)",
    );
    expect(screen.getByTestId("cup-oracle").textContent).toContain("Alice");
    expect(screen.getByTestId("cup-oracle").textContent).toContain("11 pts");
  });

  it("premier du classement d'une coupe sans play-offs, sans Oracle", () => {
    render(
      <CupChampionBanner
        cupId="cup-1"
        champion={{ team: { ...TEAM, coachName: null }, source: "standings", finalScore: null }}
        oracles={[]}
      />,
    );
    expect(screen.getByTestId("cup-champion-detail").textContent).toBe(
      "en tête du classement final",
    );
    expect(screen.queryByTestId("cup-oracle")).toBeNull();
  });

  it("rien tant que la coupe n'a pas de champion", () => {
    const { container } = render(
      <CupChampionBanner cupId="cup-1" champion={null} oracles={[]} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
