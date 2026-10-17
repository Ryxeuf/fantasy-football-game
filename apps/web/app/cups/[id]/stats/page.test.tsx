import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CupStatsPage from "./page";

const apiRequest = vi.fn();
vi.mock("../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "C1" }) }));

const RESPONSE = {
  cup: { id: "C1", name: "Coupe du Chaos" },
  topN: 10,
  players: {
    topN: 10,
    topScorers: [
      { rank: 1, playerId: "pl1", playerName: "Grishnak", teamId: "t1", teamName: "Orcs", teamRoster: "orc", value: 3 },
    ],
    topBashers: [],
  },
  playerCategories: [
    { key: "topScorers", label: "Meilleur marqueur", description: "Touchdowns inscrits" },
    { key: "topBashers", label: "Meilleur castagneur", description: "Sorties" },
  ],
  teams: {
    topScorers: [
      { rank: 1, teamId: "t1", teamName: "Orcs", roster: "orc", logoUrl: null, matchesPlayed: 2, value: 5 },
    ],
  },
  teamCategories: [{ key: "topScorers", label: "Marqueurs de TD", description: "TD" }],
};

describe("page statistiques de coupe", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue(RESPONSE);
  });

  it("charge le top 10 par défaut et lie l'équipe à son roster", async () => {
    render(<CupStatsPage />);
    expect(await screen.findByTestId("cup-stats-players")).toBeTruthy();
    expect(apiRequest).toHaveBeenCalledWith("/cup/C1/leaderboards?topN=10");
    expect(screen.getByText("Grishnak")).toBeTruthy();
    expect(
      screen.getByTestId("team-roster-link-stats-topScorers-pl1").getAttribute("href"),
    ).toBe("/cups/C1/teams/t1");
    // Catégorie vide : un message, pas une carte muette.
    expect(screen.getByTestId("cup-stats-player-topBashers").textContent).toContain(
      "Pas encore de données",
    );
  });

  it("recharge au top N choisi et bascule sur les équipes", async () => {
    render(<CupStatsPage />);
    await screen.findByTestId("cup-stats-players");
    fireEvent.change(screen.getByTestId("cup-stats-topn"), { target: { value: "20" } });
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/cup/C1/leaderboards?topN=20"),
    );
    fireEvent.click(screen.getByTestId("cup-stats-mode-teams"));
    expect(await screen.findByTestId("cup-stats-teams")).toBeTruthy();
    expect(
      screen.getByTestId("team-roster-link-stats-team-topScorers-t1").getAttribute("href"),
    ).toBe("/cups/C1/teams/t1");
  });
});
