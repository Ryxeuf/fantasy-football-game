import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import LeagueTeamRosterPage from "./page";

const apiRequestMock = vi.fn();
vi.mock("../../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiClientError: class extends Error {},
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "L1", teamId: "T1" }),
}));

const ROSTER = {
  team: {
    id: "T1",
    name: "Reikland Reavers",
    roster: "human",
    raceName: "Humains",
    coachName: "Sepp",
    treasury: 50_000,
    teamValue: 1_000_000,
    currentValue: 980_000,
    rerolls: 3,
    cheerleaders: 1,
    assistants: 2,
    apothecary: true,
    dedicatedFans: 4,
  },
  players: [
    {
      id: "pl1",
      name: "Griff",
      position: "human_blitzer",
      positionName: "Blitzer",
      number: 7,
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: "block,dodge",
      spp: 12,
      dead: false,
    },
  ],
};

describe("LeagueTeamRosterPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("affiche l'équipe, ses stats, un poste lisible et les compétences nommées", async () => {
    apiRequestMock.mockResolvedValue(ROSTER);
    render(
      <LanguageProvider>
        <LeagueTeamRosterPage />
      </LanguageProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("league-roster-page")).toBeTruthy(),
    );
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/leagues/L1/teams/T1/roster-view",
    );
    expect(
      screen.getByRole("heading", { name: "Reikland Reavers" }),
    ).toBeTruthy();
    expect(screen.getByText("Blitzer")).toBeTruthy();
    expect(screen.queryByText("human_blitzer")).toBeNull();
    // Compétences affichées par leur nom lisible (pas le slug).
    expect(screen.getByText("Blocage")).toBeTruthy();
    expect(screen.getByText("Esquive")).toBeTruthy();
    expect(screen.queryByText("block")).toBeNull();
  });

  it("affiche l'erreur renvoyée par l'API (ex: 403 non inscrit)", async () => {
    apiRequestMock.mockRejectedValue(
      new Error("Seuls les coachs inscrits a la ligue peuvent voir les rosters"),
    );
    render(
      <LanguageProvider>
        <LeagueTeamRosterPage />
      </LanguageProvider>,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId("league-roster-error").textContent,
      ).toContain("coachs inscrits"),
    );
  });
});
