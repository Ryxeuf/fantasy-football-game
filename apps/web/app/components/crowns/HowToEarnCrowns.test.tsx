import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HowToEarnCrowns } from "./HowToEarnCrowns";

const SCHEDULE = { sheet: 25, achievement: 50, signup: 250, seasonSheetCap: 500 };

describe("HowToEarnCrowns", () => {
  it("affiche le barème servi par le serveur", () => {
    render(<HowToEarnCrowns schedule={SCHEDULE} />);
    const text = (screen.getByTestId("crowns-how-to-earn").textContent ?? "").replace(/\s/g, " ");
    expect(text).toContain("feuille de match validée");
    expect(text).toContain("+25 par coach");
    expect(text).toContain("gagnant comme perdant");
    expect(text).toContain("succès débloqué : +50");
    expect(text).toContain("bonus de bienvenue : +250");
    expect(text).toContain("au plus 500 Couronnes par saison de ligue");
  });

  it("sans barème (API antérieure) : le texte reste, sans montants", () => {
    render(<HowToEarnCrowns schedule={null} />);
    const text = screen.getByTestId("crowns-how-to-earn").textContent ?? "";
    expect(text).toContain("feuille de match validée");
    expect(text).not.toMatch(/\+\d/);
    expect(text).toContain("plafonnés par saison de ligue");
  });
});
