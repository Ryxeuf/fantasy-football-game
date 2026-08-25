/**
 * Logos d'équipe dans le bracket de coupe.
 *
 * Le bracket n'affichait que les noms : sur une grille de 8 matches, rien
 * ne distinguait visuellement les équipes. `TeamLogo` retombe sur le logo
 * programmatique du roster quand aucun logo n'est uploadé.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import CupBracketView from "./CupBracketView";

const MATCHES = [
  {
    id: "m1",
    name: "Quart 1",
    status: "completed",
    isPublic: true,
    teamA: {
      id: "a",
      name: "Reavers",
      roster: "human",
      ruleset: "season_3",
      logoUrl: "/images/team-logos/reavers-abc.png",
    },
    teamB: {
      id: "b",
      name: "Gouge",
      roster: "skaven",
      ruleset: "season_3",
      logoUrl: null,
    },
    scoreTeamA: 2,
    scoreTeamB: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("CupBracketView — logos", () => {
  it("rend le logo uploadé et le repli programmatique", () => {
    const { container } = render(<CupBracketView matches={MATCHES} />);
    const img = container.querySelector(
      'img[src="/images/team-logos/reavers-abc.png"]',
    );
    expect(img).toBeTruthy();
    expect(img?.getAttribute("alt")).toBe("Reavers");
    // L'équipe B n'a pas de logo uploadé : SVG inline, pas de 2e <img>.
    expect(container.querySelectorAll("img").length).toBe(1);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });
});
