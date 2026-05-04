/**
 * S27.1e — Tests du composant `CoachCupChampionshipsBanner`.
 *
 * Banniere affichee sur `/coach/[slug]` listant les Nuffle Cup
 * mensuelles remportees par le coach. Source : champ `cupChampionships`
 * du DTO `/coach/:slug` (cf. S27.1d).
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CoachCupChampionshipsBanner from "./CoachCupChampionshipsBanner";
import type { CoachCupChampionship } from "./types";

const april2026: CoachCupChampionship = {
  cupId: "cup-april-2026",
  cupName: "Nuffle Cup Avril 2026",
  monthlyYear: 2026,
  monthlyMonth: 4,
  label: "Champion Nuffle Cup Avril 2026",
};

const march2026: CoachCupChampionship = {
  cupId: "cup-march-2026",
  cupName: "Nuffle Cup Mars 2026",
  monthlyYear: 2026,
  monthlyMonth: 3,
  label: "Champion Nuffle Cup Mars 2026",
};

describe("CoachCupChampionshipsBanner (S27.1e)", () => {
  it("ne rend rien quand cupChampionships est undefined", () => {
    const { container } = render(
      <CoachCupChampionshipsBanner cupChampionships={undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("ne rend rien quand cupChampionships est vide", () => {
    const { container } = render(
      <CoachCupChampionshipsBanner cupChampionships={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("affiche un badge par titre remporte avec son label", () => {
    render(
      <CoachCupChampionshipsBanner
        cupChampionships={[april2026, march2026]}
      />,
    );
    expect(screen.getByText("Champion Nuffle Cup Avril 2026")).toBeTruthy();
    expect(screen.getByText("Champion Nuffle Cup Mars 2026")).toBeTruthy();
    expect(
      screen.getAllByTestId(/^cup-championship-badge-/),
    ).toHaveLength(2);
  });

  it("identifie chaque badge par cupId dans le data-testid", () => {
    render(
      <CoachCupChampionshipsBanner
        cupChampionships={[april2026, march2026]}
      />,
    );
    expect(
      screen.getByTestId("cup-championship-badge-cup-april-2026"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("cup-championship-badge-cup-march-2026"),
    ).toBeTruthy();
  });

  it("lie chaque titre a sa cup d'origine /cups/{cupId}", () => {
    render(
      <CoachCupChampionshipsBanner cupChampionships={[april2026]} />,
    );
    const link = screen
      .getAllByRole("link")
      .find((a) =>
        (a as HTMLAnchorElement).href.endsWith("/cups/cup-april-2026"),
      );
    expect(link).toBeTruthy();
  });

  it("affiche le mois/annee en sous-texte sous le label", () => {
    render(<CoachCupChampionshipsBanner cupChampionships={[april2026]} />);
    expect(screen.getByText(/04\/2026/)).toBeTruthy();
  });
});
