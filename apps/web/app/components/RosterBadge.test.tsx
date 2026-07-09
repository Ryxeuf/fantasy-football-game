import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RosterBadge from "./RosterBadge";

describe("RosterBadge", () => {
  it("affiche le nom lisible du roster, jamais le slug", () => {
    render(<RosterBadge slug="tomb_kings" />);
    const badge = screen.getByTestId("roster-badge-tomb_kings");
    expect(badge.textContent).toBe("Rois des tombes");
    expect(badge.textContent).not.toContain("tomb_kings");
  });

  it("applique la couleur canonique du roster en fond", () => {
    render(<RosterBadge slug="human" />);
    const badge = screen.getByTestId("roster-badge-human");
    // human = 0x1e3a8a (bleu du Reikland)
    expect(badge.getAttribute("style")).toContain("rgb(30, 58, 138)");
  });

  it("préfère un nom déjà résolu (raceName API) quand fourni", () => {
    render(<RosterBadge slug="undead" name="Morts ambulants" />);
    expect(
      screen.getByTestId("roster-badge-undead").textContent,
    ).toBe("Morts ambulants");
  });

  it("retombe sur le slug pour un roster inconnu (couleur par défaut)", () => {
    render(<RosterBadge slug="mystery_team" />);
    const badge = screen.getByTestId("roster-badge-mystery_team");
    expect(badge.textContent).toBe("mystery_team");
  });
});
