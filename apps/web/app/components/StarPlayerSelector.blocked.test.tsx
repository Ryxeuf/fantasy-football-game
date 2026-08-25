/**
 * Le sélecteur doit DIRE pourquoi une recrue est impossible.
 *
 * Avant, une ligne inerte (case grisée) ne distinguait pas « trop cher » de
 * « plus de place », et un Star Player banni par le règlement de tournoi
 * disparaissait purement et simplement de la liste.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import StarPlayerSelector from "./StarPlayerSelector";
import { LanguageProvider } from "../contexts/LanguageContext";

const GRIFF = {
  slug: "griff_oberwald",
  displayName: "Griff Oberwald",
  cost: 280000,
  ma: 7,
  st: 4,
  ag: 2,
  pa: 3,
  av: 9,
  skills: "block,dodge",
  hirableBy: ["all"],
};

const MORG = {
  ...GRIFF,
  slug: "morg_n_thorg",
  displayName: "Morg 'n' Thorg",
  cost: 380000,
};

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ starPlayers: [GRIFF, MORG] }),
    } as Response),
  );
});

function renderSelector(
  props: Partial<Parameters<typeof StarPlayerSelector>[0]> = {},
) {
  return render(
    <LanguageProvider>
      <StarPlayerSelector
        roster="human"
        ruleset="season_3"
        selectedStarPlayers={[]}
        onSelectionChange={vi.fn()}
        currentPlayerCount={11}
        availableBudget={1_000_000}
        {...props}
      />
    </LanguageProvider>,
  );
}

describe("StarPlayerSelector — raison d'indisponibilité", () => {
  it("n'affiche aucune raison quand la recrue est possible", async () => {
    renderSelector();
    await waitFor(() =>
      expect(screen.getByTestId("star-player-griff_oberwald")).toBeTruthy(),
    );
    expect(screen.queryByTestId("star-player-blocked-griff_oberwald")).toBeNull();
  });

  it("explique un budget insuffisant et désactive la case", async () => {
    renderSelector({ availableBudget: 300_000 });
    await waitFor(() =>
      expect(screen.getByTestId("star-player-blocked-morg_n_thorg")).toBeTruthy(),
    );
    expect(
      screen.getByTestId("star-player-blocked-morg_n_thorg").textContent,
    ).toContain("Budget insuffisant");
    expect(
      (screen.getByTestId("star-player-morg_n_thorg") as HTMLInputElement)
        .disabled,
    ).toBe(true);
    // Griff (280K) rentre encore dans les 300K : lui n'est pas bloqué.
    expect(screen.queryByTestId("star-player-blocked-griff_oberwald")).toBeNull();
  });

  it("explique le plafond de joueurs du format", async () => {
    renderSelector({ currentPlayerCount: 11, maxTotalPlayers: 11 });
    await waitFor(() =>
      expect(screen.getByTestId("star-player-blocked-griff_oberwald")).toBeTruthy(),
    );
    expect(
      screen.getByTestId("star-player-blocked-griff_oberwald").textContent,
    ).toContain("maximum 11 joueurs");
  });

  it("affiche — au lieu de masquer — un Star Player banni par le règlement", async () => {
    renderSelector({ excludedSlugs: ["morg_n_thorg"] });
    await waitFor(() =>
      expect(screen.getByTestId("star-player-blocked-morg_n_thorg")).toBeTruthy(),
    );
    expect(screen.getByText("Morg 'n' Thorg")).toBeTruthy();
    expect(
      screen.getByTestId("star-player-blocked-morg_n_thorg").textContent,
    ).toContain("règlement");
  });
});
