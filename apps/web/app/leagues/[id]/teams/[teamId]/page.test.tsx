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
      // FR20 — stats + dispo
      totalTouchdowns: 4,
      totalCasualties: 2,
      totalCompletions: 5,
      totalInterceptions: 1,
      aggressions: 3,
      matchesPlayed: 6,
      missNextMatch: false,
      nigglingInjuries: 0,
      statReductions: { ma: 0, st: 0, ag: 0, pa: 0, av: 0 },
    },
    {
      id: "pl2",
      name: "Boris",
      position: "human_lineman",
      positionName: "Trois-quarts",
      number: 3,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: "",
      spp: 2,
      dead: false,
      totalTouchdowns: 0,
      totalCasualties: 0,
      totalCompletions: 0,
      totalInterceptions: 0,
      aggressions: 0,
      matchesPlayed: 5,
      missNextMatch: true,
      nigglingInjuries: 2,
      statReductions: { ma: 1, st: 0, ag: 0, pa: 0, av: 0 },
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

  it("FR20 — affiche les stats par joueur, les blessures permanentes et la dispo", async () => {
    apiRequestMock.mockResolvedValue(ROSTER);
    render(
      <LanguageProvider>
        <LeagueTeamRosterPage />
      </LanguageProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("league-roster-page")).toBeTruthy(),
    );

    // En-têtes des colonnes stats.
    for (const header of ["TD", "Élim.", "Pas.", "Int.", "Agr.", "PSP", "Blessures", "Dispo"]) {
      expect(screen.getByText(header)).toBeTruthy();
    }

    // Griff : disponible, sans blessure durable.
    expect(
      screen.getByTestId("player-availability-pl1").textContent,
    ).toContain("✓");
    expect(
      screen.getByTestId("player-injuries-pl1").textContent,
    ).toContain("—");

    // Boris : rate le prochain match, -1 M + 2 séquelles.
    expect(
      screen.getByTestId("player-availability-pl2").textContent,
    ).toContain("Absent");
    const borisInjuries = screen.getByTestId("player-injuries-pl2").textContent;
    expect(borisInjuries).toContain("-1 M");
    expect(borisInjuries).toContain("2 séquelles");
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
