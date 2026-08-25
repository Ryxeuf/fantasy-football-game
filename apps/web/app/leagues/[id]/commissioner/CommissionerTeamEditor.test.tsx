/**
 * Éditeur commissaire — dialogue, onglets et effectif.
 *
 * Règle conservée : le bouton 🗑 n'apparaît qu'en pré-saison
 * (`canRemovePlayers`), SAUF pour un joueur MORT, retirable à tout moment
 * (retrait doux côté serveur, sans licenciement — la fiche et l'historique
 * sont conservés).
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
    name: "Reikland Reavers",
    roster: "human",
    treasury: 50_000,
    ruleset: "season_3",
  },
  players: [
    {
      id: "alive1",
      name: "Griff",
      position: "human_blitzer",
      number: 7,
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: "block",
      spp: 12,
      dead: false,
    },
    {
      id: "dead1",
      name: "Feu Igor",
      position: "human_lineman",
      number: 12,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: "",
      spp: 2,
      dead: true,
    },
  ],
  accessByPosition: {
    human_blitzer: {
      displayName: "Blitzer Humain",
      primarySkills: "G,S",
      secondarySkills: "A",
      innateSkills: ["block"],
    },
  },
};

const SETTINGS = {
  team: {
    id: "T1",
    name: "Reikland Reavers",
    roster: "human",
    ruleset: "season_3",
    format: "bb11",
    treasury: 50_000,
    teamValue: 1_000_000,
    currentValue: 950_000,
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
  staffConfig: {
    rerollCost: 50_000,
    maxRerolls: 8,
    apothecaryAllowed: true,
    apothecaryCost: 50_000,
    maxCheerleaders: 12,
    cheerleaderCost: 10_000,
    maxAssistants: 6,
    assistantCost: 10_000,
    maxDedicatedFans: 6,
    dedicatedFanCost: 10_000,
  },
  regionalLeague: {
    current: null,
    currentLabel: null,
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
  starPlayers: [],
};

function mockApi() {
  apiRequestMock.mockImplementation((path: string) => {
    if (typeof path !== "string") return Promise.resolve({});
    if (path.endsWith("/settings")) return Promise.resolve(SETTINGS);
    if (path.endsWith("/roster")) return Promise.resolve(ROSTER);
    if (path.startsWith("/api/skills")) {
      return Promise.resolve({
        skills: [
          { slug: "dodge", nameFr: "Esquive", category: "Agility" },
          { slug: "guard", nameFr: "Garde", category: "Strength" },
        ],
      });
    }
    return Promise.resolve({});
  });
}

function renderEditor(
  props: Partial<React.ComponentProps<typeof CommissionerTeamEditor>> = {},
) {
  return render(
    <CommissionerTeamEditor
      leagueId="L1"
      teamId="T1"
      teamName="Reikland Reavers"
      open
      canRemovePlayers={false}
      onClose={() => {}}
      {...props}
    />,
  );
}

describe("CommissionerTeamEditor — suppression de joueurs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockApi();
  });

  it("saison démarrée : seul le joueur MORT garde un bouton de retrait", async () => {
    renderEditor();
    await waitFor(() =>
      expect(screen.getByTestId("player-edit-dead1")).toBeTruthy(),
    );

    expect(screen.queryByTestId("remove-player-alive1")).toBeNull();
    expect(screen.getByTestId("remove-player-dead1").textContent).toContain(
      "Retirer",
    );
  });

  it("pré-saison : tous les joueurs sont supprimables (mort inclus)", async () => {
    renderEditor({ canRemovePlayers: true });
    await waitFor(() =>
      expect(screen.getByTestId("player-edit-alive1")).toBeTruthy(),
    );

    expect(screen.getByTestId("remove-player-alive1").textContent).toContain(
      "Supprimer",
    );
    expect(screen.getByTestId("remove-player-dead1").textContent).toContain(
      "Retirer",
    );
  });

  it("le retrait d'un mort appelle DELETE après confirmation inline", async () => {
    renderEditor();
    await waitFor(() =>
      expect(screen.getByTestId("player-edit-dead1")).toBeTruthy(),
    );

    fireEvent.click(screen.getByTestId("remove-player-dead1"));
    fireEvent.click(screen.getByTestId("confirm-remove-player-dead1"));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/leagues/L1/teams/T1/players/dead1",
        { method: "DELETE" },
      ),
    );
  });
});

describe("CommissionerTeamEditor — dialogue et effectif", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockApi();
  });

  it("expose un dialogue accessible et se ferme avec Échap", async () => {
    const onClose = vi.fn();
    renderEditor({ onClose });
    await waitFor(() =>
      expect(screen.getByTestId("commissioner-team-editor")).toBeTruthy(),
    );

    const dialog = screen.getByTestId("commissioner-team-editor");
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("replie les contrôles d'un joueur tant qu'on ne le déplie pas", async () => {
    renderEditor();
    await waitFor(() =>
      expect(screen.getByTestId("player-edit-alive1")).toBeTruthy(),
    );

    expect(screen.queryByTestId("spp-apply-alive1")).toBeNull();
    fireEvent.click(screen.getByTestId("player-toggle-alive1"));
    expect(screen.getByTestId("spp-apply-alive1")).toBeTruthy();
    expect(screen.getByTestId("identity-name-alive1")).toBeTruthy();
  });

  it("filtre l'effectif par recherche et par statut", async () => {
    renderEditor();
    await waitFor(() =>
      expect(screen.getByTestId("player-edit-alive1")).toBeTruthy(),
    );

    fireEvent.change(screen.getByTestId("roster-search"), {
      target: { value: "igor" },
    });
    expect(screen.queryByTestId("player-edit-alive1")).toBeNull();
    expect(screen.getByTestId("player-edit-dead1")).toBeTruthy();

    fireEvent.change(screen.getByTestId("roster-search"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByTestId("roster-filter-alive"));
    expect(screen.queryByTestId("player-edit-dead1")).toBeNull();
    expect(screen.getByTestId("roster-count").textContent).toContain("1 / 2");
  });

  it("applique un ajustement de PSP et confirme l'action", async () => {
    renderEditor();
    await waitFor(() =>
      expect(screen.getByTestId("player-edit-alive1")).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId("player-toggle-alive1"));

    fireEvent.change(screen.getByLabelText("Ajustement de PSP"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByTestId("spp-apply-alive1"));

    await waitFor(() =>
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/leagues/L1/teams/T1/players/alive1/spp",
        { method: "POST", body: JSON.stringify({ delta: 3 }) },
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId("editor-flash").textContent).toContain("PSP"),
    );
  });

  it("n'offre à l'ajout que les compétences accessibles au poste", async () => {
    renderEditor();
    await waitFor(() =>
      expect(screen.getByTestId("player-edit-alive1")).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId("player-toggle-alive1"));

    const select = screen.getByTestId(
      "skill-select-alive1",
    ) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    // Garde (Force, accès primaire) et Esquive (Agilité, secondaire) sont
    // proposées ; Blocage est déjà possédée (innée) donc absente.
    expect(values).toContain("guard");
    expect(values).toContain("dodge");
    expect(values).not.toContain("block");
  });
});
