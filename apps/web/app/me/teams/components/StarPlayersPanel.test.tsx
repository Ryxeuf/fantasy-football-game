/**
 * Les Star Players d'une équipe doivent apparaître sur sa fiche : ce ne sont
 * pas des `TeamPlayer`, donc le tableau de composition ne les liste pas.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StarPlayersPanel from "./StarPlayersPanel";
import { LanguageProvider } from "../../../contexts/LanguageContext";

/** `toLocaleString("fr-FR")` sépare les milliers avec U+202F : on normalise. */
function normalizeSpaces(text: string | null): string {
  return (text ?? "").replace(/[  ]/g, " ");
}

const CINDY = {
  id: "tsp-1",
  slug: "cindy_piewhistle",
  cost: 130_000,
  displayName: "Cindy Piewhistle",
  ma: 5,
  st: 2,
  ag: 3,
  pa: 4,
  av: 7,
  skills: "dodge,stunty",
  specialRule: "Cuisinière hors pair",
  keywords: "Halfling, Coureur",
};

const DEENY = {
  id: "tsp-2",
  slug: "deeproot_strongbranch",
  cost: 280_000,
  displayName: "Deeproot Strongbranch",
  ma: 5,
  st: 6,
  ag: 5,
  pa: null,
  av: 11,
  skills: "mighty_blow",
};

function renderPanel(starPlayers: unknown[]) {
  return render(
    <LanguageProvider>
      <StarPlayersPanel starPlayers={starPlayers as never} />
    </LanguageProvider>,
  );
}

describe("StarPlayersPanel", () => {
  it("liste chaque Star Player avec son coût", () => {
    renderPanel([CINDY, DEENY]);

    expect(screen.getByTestId("team-star-players")).toBeTruthy();
    expect(screen.getByText("Cindy Piewhistle")).toBeTruthy();
    expect(
      normalizeSpaces(
        screen.getByTestId("team-star-player-cost-cindy_piewhistle").textContent,
      ),
    ).toBe("130K po");
    expect(screen.getByText("Deeproot Strongbranch")).toBeTruthy();
  });

  it("totalise le coût des Star Players", () => {
    renderPanel([CINDY, DEENY]);

    expect(
      normalizeSpaces(screen.getByTestId("team-star-players-total").textContent),
    ).toBe("410K po");
  });

  it("affiche « - » pour une caractéristique absente", () => {
    renderPanel([DEENY]);

    const row = screen.getByTestId("team-star-player-deeproot_strongbranch");
    expect(row.textContent).toContain("PA -");
  });

  it("ne rend rien quand l'équipe n'a aucun Star Player", () => {
    const { container } = renderPanel([]);
    expect(container.innerHTML).toBe("");
  });
});
