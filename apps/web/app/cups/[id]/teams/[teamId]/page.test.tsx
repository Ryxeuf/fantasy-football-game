import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../../../contexts/LanguageContext";
import CupTeamRosterPage from "./page";

const apiRequestMock = vi.fn();
vi.mock("../../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiClientError: class extends Error {},
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "C1", teamId: "T1" }),
}));

const ROSTER = {
  cup: { id: "C1", name: "Coupe du Chaos" },
  source: "registration",
  registeredAt: Date.UTC(2026, 9, 1),
  team: {
    id: "T1",
    name: "Reikland Reavers",
    roster: "human",
    raceName: "Humains",
    coachName: "Sepp",
    teamValue: 1_050_000,
    currentValue: 1_050_000,
    rerolls: 3,
    cheerleaders: 1,
    assistants: 2,
    apothecary: true,
    dedicatedFans: 2,
    cupMatchesPlayed: 3,
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
      skills: "block",
      spp: 6,
      dead: false,
      totalTouchdowns: 2,
      totalCasualties: 1,
      totalCompletions: 0,
      totalInterceptions: 0,
      aggressions: 0,
      matchesPlayed: 3,
      value: 85_000,
      note: null,
    },
    {
      id: "star:morg_n_thorg",
      name: "Morg 'n' Thorg",
      position: "morg_n_thorg",
      positionName: "Star Player",
      number: null,
      ma: 6,
      st: 6,
      ag: 3,
      pa: 4,
      av: 11,
      skills: "block",
      spp: 0,
      dead: false,
      totalTouchdowns: 1,
      matchesPlayed: 3,
      value: 380_000,
      note: "Star Player",
    },
  ],
  inducements: [{ name: "Pot-de-vin", quantity: 2, unitCost: 100_000 }],
};

function renderPage() {
  return render(
    <LanguageProvider>
      <CupTeamRosterPage />
    </LanguageProvider>,
  );
}

describe("fiche de roster d'une équipe de coupe", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("charge le roster d'inscription de l'équipe dans la coupe", async () => {
    apiRequestMock.mockResolvedValue(ROSTER);
    renderPage();
    await waitFor(() => expect(screen.getByTestId("cup-roster-page")).toBeTruthy());
    expect(apiRequestMock).toHaveBeenCalledWith("/cup/C1/teams/T1/roster-view");
    expect(screen.getByRole("heading", { name: "Reikland Reavers" })).toBeTruthy();
    expect(screen.getByTestId("cup-roster-source").textContent).toContain(
      "Roster d'inscription",
    );
    expect(screen.getByText("← Retour à la coupe « Coupe du Chaos »")).toBeTruthy();
  });

  it("montre les stats de coupe, le Star Player inscrit et les coups de pouce", async () => {
    apiRequestMock.mockResolvedValue(ROSTER);
    renderPage();
    await waitFor(() => expect(screen.getByTestId("cup-roster-page")).toBeTruthy());
    expect(screen.getByTestId("player-td-pl1").textContent).toBe("2");
    expect(screen.getByTestId("player-matches-pl1").textContent).toBe("3");
    expect(screen.getByTestId("player-note-star:morg_n_thorg").textContent).toBe(
      "Star Player",
    );
    expect(screen.getByText("Matchs de coupe")).toBeTruthy();
    expect(screen.getByTestId("cup-roster-inducements").textContent).toContain(
      "Pot-de-vin ×2",
    );
  });

  it("ne montre ni trésorerie, ni blessures, ni disponibilité (résurrection)", async () => {
    apiRequestMock.mockResolvedValue(ROSTER);
    renderPage();
    await waitFor(() => expect(screen.getByTestId("cup-roster-page")).toBeTruthy());
    expect(screen.queryByText("Trésorerie")).toBeNull();
    expect(screen.queryByText("Blessures")).toBeNull();
    expect(screen.queryByTestId("player-availability-pl1")).toBeNull();
  });

  it("annonce un repli sur l'équipe en direct", async () => {
    apiRequestMock.mockResolvedValue({ ...ROSTER, source: "live", registeredAt: null });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("cup-roster-page")).toBeTruthy());
    expect(screen.getByTestId("cup-roster-source").textContent).toContain(
      "Roster actuel",
    );
  });

  it("affiche l'erreur de l'API (équipe non inscrite)", async () => {
    apiRequestMock.mockRejectedValue(new Error("Équipe non inscrite à cette coupe"));
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("cup-roster-error").textContent).toBe(
        "Équipe non inscrite à cette coupe",
      ),
    );
  });
});
