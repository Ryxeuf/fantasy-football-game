/**
 * Le sélecteur de Star Players doit interroger l'API avec la Ligue régionale
 * retenue, et purger une recrue devenue indisponible après changement de
 * Ligue (sinon elle partait au serveur, qui refusait toute la création).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import StarPlayerSelector from "./StarPlayerSelector";
import { LanguageProvider } from "../contexts/LanguageContext";

const CINDY = {
  slug: "cindy_piewhistle",
  displayName: "Cindy Piewhistle",
  cost: 130000,
  ma: 5,
  st: 2,
  ag: 3,
  pa: 4,
  av: 7,
  skills: "",
  hirableBy: ["halfling_thimble_cup"],
};

const WILLOW = {
  ...CINDY,
  slug: "willow_rosebark",
  displayName: "Willow Rosebark",
  hirableBy: ["woodland_league"],
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    const starPlayers = url.includes("regionalLeague=woodland_league")
      ? [WILLOW]
      : [CINDY, WILLOW];
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ starPlayers }),
    } as Response);
  });
  vi.stubGlobal("fetch", fetchMock);
});

function renderSelector(props: Partial<Parameters<typeof StarPlayerSelector>[0]> = {}) {
  const onSelectionChange = vi.fn();
  const view = render(
    <LanguageProvider>
      <StarPlayerSelector
        roster="halfling"
        ruleset="season_3"
        selectedStarPlayers={[]}
        onSelectionChange={onSelectionChange}
        currentPlayerCount={11}
        availableBudget={1_000_000}
        {...props}
      />
    </LanguageProvider>,
  );
  return { ...view, onSelectionChange };
}

describe("StarPlayerSelector — Ligue régionale", () => {
  it("transmet la Ligue choisie à l'API et n'affiche que ses Star Players", async () => {
    renderSelector({ regionalLeague: "woodland_league" });

    await waitFor(() =>
      expect(screen.getByTestId("star-player-willow_rosebark")).toBeTruthy(),
    );
    expect(screen.queryByTestId("star-player-cindy_piewhistle")).toBeNull();
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "regionalLeague=woodland_league",
    );
  });

  it("sert l'union du roster quand aucune Ligue n'est retenue", async () => {
    renderSelector({ regionalLeague: null });

    await waitFor(() =>
      expect(screen.getByTestId("star-player-cindy_piewhistle")).toBeTruthy(),
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("regionalLeague");
  });

  it("retire de la sélection un Star Player absent de la nouvelle Ligue", async () => {
    const { onSelectionChange } = renderSelector({
      regionalLeague: "woodland_league",
      selectedStarPlayers: ["cindy_piewhistle"],
    });

    await waitFor(() => expect(onSelectionChange).toHaveBeenCalledWith([]));
  });
});
