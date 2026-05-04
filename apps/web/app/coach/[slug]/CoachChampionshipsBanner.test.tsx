/**
 * S26.6e — Tests du composant `CoachChampionshipsBanner`.
 *
 * Bannière affichée sur `/coach/[slug]` listant les titres remportés
 * par le coach sur les saisons thématiques. Source : champ
 * `championships` du DTO `/coach/:slug` (cf. S26.6d).
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CoachChampionshipsBanner from "./CoachChampionshipsBanner";
import type { CoachThemedChampionship } from "./types";

const skaven2026: CoachThemedChampionship = {
  seasonId: "season-1",
  theme: "skaven_cup",
  themeYear: 2026,
  label: "Champion Skaven Cup 2026",
  leagueId: "lg-1",
  leagueName: "Skaven League",
  badgeColor: "#7a8c2c",
};

const nordic2026: CoachThemedChampionship = {
  seasonId: "season-2",
  theme: "nordic_challenge",
  themeYear: 2026,
  label: "Champion Nordic Challenge 2026",
  leagueId: "lg-2",
  leagueName: "Nordic League",
  badgeColor: "#2c5d8c",
};

describe("CoachChampionshipsBanner (S26.6e)", () => {
  it("ne rend rien quand championships est undefined", () => {
    const { container } = render(
      <CoachChampionshipsBanner championships={undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("ne rend rien quand championships est vide", () => {
    const { container } = render(
      <CoachChampionshipsBanner championships={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("affiche un badge par titre remporte avec son label", () => {
    render(
      <CoachChampionshipsBanner
        championships={[skaven2026, nordic2026]}
      />,
    );
    expect(screen.getByText("Champion Skaven Cup 2026")).toBeTruthy();
    expect(screen.getByText("Champion Nordic Challenge 2026")).toBeTruthy();
    expect(
      screen.getAllByTestId(/^championship-badge-/),
    ).toHaveLength(2);
  });

  it("expose la couleur du badge via data-color (testabilite + style)", () => {
    render(<CoachChampionshipsBanner championships={[skaven2026]} />);
    const swatch = screen.getByTestId("championship-color-skaven_cup-2026");
    expect(swatch.getAttribute("data-color")?.toLowerCase()).toBe("#7a8c2c");
  });

  it("identifie chaque badge par theme + annee dans le data-testid", () => {
    render(
      <CoachChampionshipsBanner
        championships={[skaven2026, nordic2026]}
      />,
    );
    expect(
      screen.getByTestId("championship-badge-skaven_cup-2026"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("championship-badge-nordic_challenge-2026"),
    ).toBeTruthy();
  });

  it("lie chaque titre a sa ligue d'origine", () => {
    render(<CoachChampionshipsBanner championships={[skaven2026]} />);
    const link = screen
      .getAllByRole("link")
      .find((a) =>
        (a as HTMLAnchorElement).href.endsWith("/leagues/lg-1"),
      );
    expect(link).toBeTruthy();
  });
});
