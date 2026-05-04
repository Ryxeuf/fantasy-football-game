/**
 * L2.C.2 — Tests du composant `CoachLeagueChampionshipsBanner`.
 *
 * Banniere affichee sur `/coach/[slug]` listant les saisons de ligue
 * remportees par le coach.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CoachLeagueChampionshipsBanner from "./CoachLeagueChampionshipsBanner";
import type { CoachLeagueChampionship } from "./types";

const championship1: CoachLeagueChampionship = {
  seasonId: "season-1",
  leagueId: "league-1",
  leagueName: "Ligue Skaven",
  seasonNumber: 1,
  seasonName: "Saison 1",
  label: "Champion Ligue Skaven — Saison 1",
  wonAt: "2026-05-01T10:00:00.000Z",
};

const championship2: CoachLeagueChampionship = {
  seasonId: "season-2",
  leagueId: "league-2",
  leagueName: "Ligue Goblin",
  seasonNumber: 2,
  seasonName: "Saison Hiver",
  label: "Champion Ligue Goblin — Saison Hiver",
  wonAt: "2026-04-01T10:00:00.000Z",
};

describe("CoachLeagueChampionshipsBanner", () => {
  it("renders nothing when leagueChampionships is undefined", () => {
    const { container } = render(
      <CoachLeagueChampionshipsBanner leagueChampionships={undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when leagueChampionships is empty", () => {
    const { container } = render(
      <CoachLeagueChampionshipsBanner leagueChampionships={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the banner heading + a badge per championship", () => {
    render(
      <CoachLeagueChampionshipsBanner
        leagueChampionships={[championship1, championship2]}
      />,
    );
    expect(
      screen.getByTestId("coach-league-championships-banner"),
    ).toBeTruthy();
    expect(
      screen.getByText("Champion Ligue Skaven — Saison 1"),
    ).toBeTruthy();
    expect(
      screen.getByText("Champion Ligue Goblin — Saison Hiver"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("league-championship-badge-season-1"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("league-championship-badge-season-2"),
    ).toBeTruthy();
  });

  it("links each badge to the season recap page", () => {
    render(
      <CoachLeagueChampionshipsBanner
        leagueChampionships={[championship1]}
      />,
    );
    const link = screen.getByRole("link", {
      name: /champion ligue skaven/i,
    }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(
      "/leagues/league-1/seasons/season-1/recap",
    );
  });

  it("includes the season number + league name as subtitle", () => {
    render(
      <CoachLeagueChampionshipsBanner
        leagueChampionships={[championship1]}
      />,
    );
    expect(screen.getByText(/S1\s+—\s+Ligue Skaven/i)).toBeTruthy();
  });
});
