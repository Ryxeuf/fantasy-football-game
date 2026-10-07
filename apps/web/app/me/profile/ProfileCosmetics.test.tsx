import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { state } = vi.hoisted(() => ({
  state: { dice: {} as Record<string, unknown>, crowns: {} as Record<string, unknown> },
}));

vi.mock("../../contexts/DiceThemeContext", () => ({
  useDiceTheme: () => state.dice,
}));
vi.mock("../../contexts/CrownsContext", () => ({
  useCrowns: () => state.crowns,
}));

import CrownsCard from "./CrownsCard";
import { getDiceThemeRenderer } from "../../components/dice/themes/registry";
import DiceThemeSummaryCard from "./DiceThemeSummaryCard";

beforeEach(() => {
  state.dice = {
    enabled: true,
    themeId: "orques",
    renderer: getDiceThemeRenderer("orques"),
    themes: [{ id: "orques", name: { fr: "Orques", en: "Orcs" } }],
    ownedThemeIds: new Set(["nuffle", "orques"]),
  };
  state.crowns = {
    enabled: true,
    loading: false,
    balance: 1250,
    transactions: [
      { id: "t1", type: "SINK", amount: -400, ref: "dice-theme:orques", createdAt: "2026-10-01T10:00:00Z" },
      { id: "t2", type: "ADMIN_ADJUST", amount: 1650, ref: "Lot du tournoi", createdAt: "2026-09-30T10:00:00Z" },
      {
        id: "t3",
        type: "REWARD",
        amount: 325,
        ref: "rewards:abc",
        createdAt: "2026-09-29T10:00:00Z",
        rewards: { sheets: 1, achievements: 1, signup: true, capped: 0 },
      },
    ],
    schedule: { sheet: 25, achievement: 50, signup: 250, seasonSheetCap: 500 },
  };
});

describe("CrownsCard (profil)", () => {
  it("flag `crowns` OFF : rien n'est rendu", () => {
    state.crowns = { ...state.crowns, enabled: false };
    render(<CrownsCard />);
    expect(screen.queryByTestId("crowns-card")).toBeNull();
  });

  it("solde, opérations lisibles et lien vers la boutique", () => {
    render(<CrownsCard />);
    expect(screen.getByTestId("crowns-card-balance").textContent?.replace(/\s/g, " ")).toBe("1 250 Crowns");
    const history = screen.getByTestId("crowns-card-history").textContent ?? "";
    expect(history).toContain("Achat du thème de dés « Orques »");
    expect(history).toContain("−400");
    expect(history).toContain("Lot du tournoi");
    expect(screen.getByText(/Dépenser mes Couronnes/)).toBeTruthy();
    expect(screen.getByTestId("crowns-shop-link").getAttribute("href")).toBe("/me/shop");
  });

  it("explique comment gagner des Couronnes et détaille un passage de récompenses", () => {
    render(<CrownsCard />);
    expect(screen.getByTestId("crowns-how-to-earn").textContent).toContain("+25 par coach");
    expect(screen.getByTestId("crowns-card-history").textContent).toContain(
      "Récompenses : 1 feuille de match, 1 succès, bonus de bienvenue",
    );
  });

  it("sans thèmes de dés : pas de lien boutique", () => {
    state.dice = { ...state.dice, enabled: false };
    render(<CrownsCard />);
    expect(screen.queryByText(/Dépenser mes Couronnes/)).toBeNull();
  });
});

describe("DiceThemeSummaryCard (profil)", () => {
  it("flag `dice_themes` OFF : rien n'est rendu", () => {
    state.dice = { ...state.dice, enabled: false };
    render(<DiceThemeSummaryCard />);
    expect(screen.queryByTestId("dice-theme-summary")).toBeNull();
  });

  it("thème actif, nombre de thèmes possédés, lien vers la boutique", () => {
    render(<DiceThemeSummaryCard />);
    expect(screen.getByTestId("dice-theme-summary-name").textContent).toBe("Orques");
    expect(screen.getByText("2 thèmes possédés")).toBeTruthy();
    expect(screen.getByTestId("dice-theme-summary-link").getAttribute("href")).toBe("/me/shop/dice-themes");
    // L'aperçu dessine le thème ACTIF du coach.
    // Un seul nom accessible pour l'aperçu, les faces sont masquées aux lecteurs d'écran.
    expect(screen.getByRole("img", { name: "Aperçu de votre thème de dés Orques" })).toBeTruthy();
    expect(
      document.querySelector('img[alt="Défenseur Plaqué"]')?.getAttribute("src"),
    ).toBe("/images/dices/nuffle-des-31-equipes/equipes/orques/128px/defender-down.png");
  });
});
