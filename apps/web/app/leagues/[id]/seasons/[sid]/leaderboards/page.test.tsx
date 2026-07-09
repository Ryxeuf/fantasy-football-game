import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import LeaderboardsPage from "./page";

const apiRequestMock = vi.fn();
vi.mock("../../../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "L1", sid: "S1" }),
}));

const ROW = {
  rank: 1,
  playerId: "p1",
  playerName: "Griff",
  position: "Blitzer",
  teamId: "T1",
  teamName: "Reavers",
  teamRoster: "human",
  ownerId: "u1",
  ownerCoachName: "Sepp",
  value: 7,
  secondary: { matchesPlayed: 3, spp: 21 },
};

const CATALOGUE = {
  seasonId: "S1",
  topN: 5,
  scope: "season" as const,
  topScorers: [ROW],
  topBashers: [],
  topKillers: [],
  topAggressors: [],
  topTeamThrowers: [],
  topPassers: [],
  topInterceptors: [],
  topFutureStars: [],
  topMvps: [],
  topPunchingBags: [],
  categories: [
    {
      key: "topScorers",
      label: "Meilleur Marqueur",
      description: "Touchdowns marqués",
    },
    { key: "topBashers", label: "Meilleur Castagneur", description: "Élims" },
  ],
};

describe("LeaderboardsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("affiche les cartes de catégories avec podium, valeurs et badge de scope", async () => {
    apiRequestMock.mockResolvedValue(CATALOGUE);
    render(<LeaderboardsPage />);

    await waitFor(() =>
      expect(screen.getByTestId("leaderboards-global")).toBeTruthy(),
    );
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/leagues/seasons/S1/leaderboards?topN=5",
    );
    // Carte remplie : leader médaillé + pastille de valeur.
    const card = screen.getByTestId("leaderboard-card-Meilleur Marqueur");
    expect(card.textContent).toContain("Griff");
    expect(card.textContent).toContain("🥇");
    expect(card.textContent).toContain("7");
    // Carte vide : état explicite.
    expect(
      screen.getByTestId("leaderboard-card-Meilleur Castagneur").textContent,
    ).toContain("Pas encore de données");
    // Badge de périmètre saison.
    expect(screen.getByTestId("leaderboards-scope").textContent).toBe(
      "Saison",
    );
  });

  it("bascule en mode par équipe via le segmented control", async () => {
    apiRequestMock.mockImplementation((path: string) =>
      path.includes("/by-team")
        ? Promise.resolve({
            seasonId: "S1",
            teams: [{ teamId: "T1", teamName: "Reavers", catalogue: CATALOGUE }],
          })
        : Promise.resolve(CATALOGUE),
    );
    render(<LeaderboardsPage />);
    await waitFor(() =>
      expect(screen.getByTestId("leaderboards-global")).toBeTruthy(),
    );

    fireEvent.click(screen.getByTestId("leaderboards-mode-by-team"));
    await waitFor(() =>
      expect(screen.getByTestId("leaderboards-byteam")).toBeTruthy(),
    );
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/leagues/seasons/S1/leaderboards/by-team?topN=5",
    );
    expect(screen.getByText("Reavers")).toBeTruthy();
  });
});
