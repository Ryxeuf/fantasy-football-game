/**
 * Onglets « Staff & trésorerie » et « Ligue régionale » de l'éditeur
 * commissaire — les deux capacités que le commissaire n'avait pas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { CommissionerTeamEditor } from "./CommissionerTeamEditor";

const apiRequestMock = vi.fn();
vi.mock("../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiClientError: class extends Error {},
}));

const ROSTER = {
  team: {
    id: "T1",
    name: "Norse Raiders",
    roster: "norse",
    treasury: 100_000,
    ruleset: "season_3",
  },
  players: [],
  accessByPosition: {},
};

const STAFF_CONFIG = {
  rerollCost: 60_000,
  maxRerolls: 8,
  apothecaryAllowed: true,
  apothecaryCost: 50_000,
  maxCheerleaders: 12,
  cheerleaderCost: 10_000,
  maxAssistants: 6,
  assistantCost: 10_000,
  maxDedicatedFans: 6,
  dedicatedFanCost: 10_000,
};

function settings(overrides: Record<string, unknown> = {}) {
  return {
    team: {
      id: "T1",
      name: "Norse Raiders",
      roster: "norse",
      ruleset: "season_3",
      format: "bb11",
      treasury: 100_000,
      teamValue: 1_000_000,
      currentValue: 980_000,
      tournamentRuleset: null,
      tournamentRulesetLabel: null,
    },
    staff: {
      rerolls: 2,
      cheerleaders: 1,
      assistants: 0,
      apothecary: false,
      dedicatedFans: 1,
    },
    staffConfig: STAFF_CONFIG,
    regionalLeague: {
      current: "old_world_classic",
      currentLabel: "Classique du Vieux Monde",
      applicable: true,
      options: [
        {
          slug: "old_world_classic",
          label: "Classique du Vieux Monde",
          description: "La ligue la plus suivie.",
          grants: [],
        },
        {
          slug: "chaos_clash",
          label: "Clash du Chaos",
          description: null,
          grants: ["khorne_favoured"],
        },
      ],
    },
    starPlayers: ["grak"],
    ...overrides,
  };
}

function mockApi(settingsPayload: unknown = settings()) {
  apiRequestMock.mockImplementation((path: string) => {
    if (typeof path !== "string") return Promise.resolve({});
    if (path.endsWith("/settings")) return Promise.resolve(settingsPayload);
    if (path.endsWith("/roster")) return Promise.resolve(ROSTER);
    if (path.startsWith("/api/skills")) return Promise.resolve({ skills: [] });
    if (path.endsWith("/regional-league")) {
      return Promise.resolve({
        regionalLeague: "chaos_clash",
        label: "Clash du Chaos",
        orphanedStarPlayers: ["grak"],
      });
    }
    return Promise.resolve({});
  });
}

async function openTab(tab: "staff" | "regional") {
  render(
    <CommissionerTeamEditor
      leagueId="L1"
      teamId="T1"
      teamName="Norse Raiders"
      open
      onClose={() => {}}
    />,
  );
  await waitFor(() =>
    expect(screen.getByTestId(`editor-tab-${tab}`)).toBeTruthy(),
  );
  fireEvent.click(screen.getByTestId(`editor-tab-${tab}`));
}

describe("Onglet staff", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockApi();
  });

  it("annonce le coût du différentiel avant enregistrement", async () => {
    await openTab("staff");
    await waitFor(() => expect(screen.getByTestId("staff-panel")).toBeTruthy());

    fireEvent.click(screen.getByTestId("staff-rerolls-plus"));
    expect(screen.getByTestId("staff-cost").textContent).toContain("60");
  });

  it("enregistre le staff sans toucher la trésorerie par défaut", async () => {
    await openTab("staff");
    await waitFor(() => expect(screen.getByTestId("staff-panel")).toBeTruthy());

    fireEvent.click(screen.getByTestId("staff-cheerleaders-plus"));
    fireEvent.click(screen.getByTestId("staff-save"));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/leagues/L1/teams/T1/staff",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    const call = apiRequestMock.mock.calls.find(
      (c) => c[0] === "/leagues/L1/teams/T1/staff",
    );
    const body = JSON.parse((call?.[1] as { body: string }).body);
    expect(body).toMatchObject({ cheerleaders: 2, chargeTreasury: false });
  });

  it("répercute la trésorerie quand la case est cochée", async () => {
    await openTab("staff");
    await waitFor(() => expect(screen.getByTestId("staff-panel")).toBeTruthy());

    fireEvent.click(screen.getByTestId("staff-rerolls-plus"));
    fireEvent.click(screen.getByTestId("staff-charge-treasury"));
    fireEvent.click(screen.getByTestId("staff-save"));

    await waitFor(() => {
      const call = apiRequestMock.mock.calls.find(
        (c) => c[0] === "/leagues/L1/teams/T1/staff",
      );
      expect(
        JSON.parse((call?.[1] as { body: string }).body).chargeTreasury,
      ).toBe(true);
    });
  });

  it("désactive l'apothicaire quand le roster n'y a pas droit", async () => {
    mockApi(
      settings({
        staffConfig: { ...STAFF_CONFIG, apothecaryAllowed: false },
      }),
    );
    await openTab("staff");
    await waitFor(() => expect(screen.getByTestId("staff-panel")).toBeTruthy());

    expect(
      (screen.getByTestId("staff-apothecary") as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it("bloque un ajustement de trésorerie qui la rendrait négative", async () => {
    await openTab("staff");
    await waitFor(() =>
      expect(screen.getByTestId("treasury-panel")).toBeTruthy(),
    );

    fireEvent.change(screen.getByLabelText("Ajustement de trésorerie"), {
      target: { value: "-200000" },
    });
    expect(
      (screen.getByTestId("treasury-adjust") as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe("Onglet Ligue régionale", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockApi();
  });

  it("liste les Ligues ouvertes au roster et marque l'actuelle", async () => {
    await openTab("regional");
    await waitFor(() =>
      expect(screen.getByTestId("regional-league-panel")).toBeTruthy(),
    );

    expect(
      (screen.getByTestId("regional-option-old_world_classic") as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(screen.getByTestId("regional-option-chaos_clash")).toBeTruthy();
    expect(screen.getByTestId("regional-option-none")).toBeTruthy();
  });

  it("enregistre le nouveau choix et signale les Star Players orphelins", async () => {
    await openTab("regional");
    await waitFor(() =>
      expect(screen.getByTestId("regional-league-panel")).toBeTruthy(),
    );

    fireEvent.click(screen.getByTestId("regional-option-chaos_clash"));
    fireEvent.click(screen.getByTestId("regional-save"));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/leagues/L1/teams/T1/regional-league",
        {
          method: "PATCH",
          body: JSON.stringify({ regionalLeague: "chaos_clash" }),
        },
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId("regional-orphans").textContent).toContain(
        "Grak",
      ),
    );
  });

  it("explique qu'un règlement de tournoi neutralise l'axe régional", async () => {
    mockApi(
      settings({
        team: {
          ...settings().team,
          tournamentRuleset: "naf_world_cup_2027",
          tournamentRulesetLabel: "NAF WC 2027",
        },
        regionalLeague: {
          current: null,
          currentLabel: null,
          applicable: false,
          options: [],
        },
      }),
    );
    await openTab("regional");

    await waitFor(() =>
      expect(
        screen.getByTestId("regional-not-applicable").textContent,
      ).toContain("NAF WC 2027"),
    );
  });
});
