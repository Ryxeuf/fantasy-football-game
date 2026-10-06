import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { state } = vi.hoisted(() => ({
  state: {
    dice: {} as Record<string, unknown>,
    crowns: {} as Record<string, unknown>,
  },
}));

vi.mock("../../contexts/DiceThemeContext", () => ({
  useDiceTheme: () => state.dice,
}));
vi.mock("../../contexts/CrownsContext", () => ({
  useCrowns: () => state.crowns,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import DiceThemeShop from "./DiceThemeShop";

function option(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    collection: "team",
    name: { fr: `Thème ${id}`, en: id },
    description: { fr: "desc", en: "desc" },
    priceCrowns: 400,
    owned: false,
    forSale: true,
    ...over,
  };
}

const THEMES = [
  option("nuffle", { collection: "classic", priceCrowns: null, owned: true, forSale: false }),
  option("glace", { collection: "classic", priceCrowns: 250 }),
  option("orques", { owned: true, forSale: false }),
  option("nains", { priceCrowns: 900 }),
];

beforeEach(() => {
  state.dice = {
    enabled: true,
    loading: false,
    themeId: "nuffle",
    themes: THEMES,
    selectTheme: vi.fn(async () => {}),
    purchaseTheme: vi.fn(async () => 50),
  };
  state.crowns = {
    enabled: true,
    balance: 300,
    schedule: { sheet: 25, achievement: 50, signup: 250, seasonSheetCap: 500 },
    applyBalance: vi.fn(),
    refresh: vi.fn(async () => {}),
  };
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("DiceThemeShop", () => {
  it("flag OFF : message d'indisponibilité, pas de boutique", () => {
    state.dice = { ...state.dice, enabled: false };
    render(<DiceThemeShop />);
    expect(screen.getByTestId("dice-shop-disabled")).toBeTruthy();
    expect(screen.queryByTestId("dice-theme-shop")).toBeNull();
  });

  it("une carte par thème, 11 faces d'aperçu, thème actif marqué", () => {
    render(<DiceThemeShop />);
    const card = screen.getByTestId("dice-theme-nuffle");
    expect(card.getAttribute("data-selected")).toBe("true");
    expect(card.textContent).toContain("Thème actif");
    // 11 faces masquées aux lecteurs d'écran derrière UN aperçu nommé.
    expect(card.querySelectorAll("img, svg[role='img']")).toHaveLength(11);
    expect(screen.getByRole("img", { name: "Aperçu du thème Thème nuffle" })).toBeTruthy();
    expect(screen.getByTestId("crowns-balance").textContent).toContain("300");
  });

  it("filtre « Mes thèmes » et « Classiques »", () => {
    render(<DiceThemeShop />);
    fireEvent.click(screen.getByTestId("dice-shop-filter-owned"));
    expect(screen.queryByTestId("dice-theme-glace")).toBeNull();
    expect(screen.getByTestId("dice-theme-orques")).toBeTruthy();
    fireEvent.click(screen.getByTestId("dice-shop-filter-classic"));
    expect(screen.queryByTestId("dice-theme-orques")).toBeNull();
    expect(screen.getByTestId("dice-theme-glace")).toBeTruthy();
  });

  it("un thème possédé se choisit", async () => {
    render(<DiceThemeShop />);
    fireEvent.click(screen.getByTestId("dice-theme-orques").querySelector("button")!);
    await waitFor(() => expect(state.dice.selectTheme).toHaveBeenCalledWith("orques"));
  });

  it("achat confirmé : POST, solde appliqué", async () => {
    render(<DiceThemeShop />);
    fireEvent.click(screen.getByTestId("dice-theme-buy-glace"));
    await waitFor(() => expect(state.dice.purchaseTheme).toHaveBeenCalledWith("glace"));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("250 Crowns"));
    await waitFor(() => expect(state.crowns.applyBalance).toHaveBeenCalledWith(50));
  });

  it("achat annulé : rien n'est envoyé", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<DiceThemeShop />);
    fireEvent.click(screen.getByTestId("dice-theme-buy-glace"));
    expect(state.dice.purchaseTheme).not.toHaveBeenCalled();
  });

  it("solde insuffisant : bouton désactivé", () => {
    render(<DiceThemeShop />);
    const btn = screen.getByTestId("dice-theme-nains").querySelector("button")!;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain("Solde insuffisant");
  });

  it("explique comment gagner des Couronnes", () => {
    render(<DiceThemeShop />);
    expect(screen.getByTestId("crowns-how-to-earn").textContent).toContain("+25 par coach");
  });

  it("Crowns fermées : pas d'explication des gains", () => {
    state.crowns = { ...state.crowns, enabled: false, balance: null };
    render(<DiceThemeShop />);
    expect(screen.queryByTestId("crowns-how-to-earn")).toBeNull();
  });

  it("Crowns fermées (flag OFF) : thème payant verrouillé, pas de solde", () => {
    state.crowns = { ...state.crowns, enabled: false, balance: null };
    render(<DiceThemeShop />);
    const btn = screen.getByTestId("dice-theme-glace").querySelector("button")!;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain("Bientôt disponible");
    expect(screen.queryByTestId("crowns-balance")).toBeNull();
  });

  it("solde en chargement : jamais « Bientôt disponible »", () => {
    state.crowns = { ...state.crowns, balance: null, loading: true, error: false };
    render(<DiceThemeShop />);
    const btn = screen.getByTestId("dice-theme-glace").querySelector("button")!;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain("Chargement du solde");
  });

  it("solde en erreur : bandeau + Réessayer", () => {
    const refresh = vi.fn(async () => {});
    state.crowns = { ...state.crowns, balance: null, loading: false, error: true, refresh };
    render(<DiceThemeShop />);
    expect(screen.getByTestId("dice-theme-glace").querySelector("button")!.textContent).toContain("Solde indisponible");
    fireEvent.click(screen.getByTestId("dice-shop-crowns-error").querySelector("button")!);
    expect(refresh).toHaveBeenCalled();
  });

  it("boutique en erreur : bandeau + Réessayer, pas de « aucun thème »", () => {
    const refresh = vi.fn(async () => {});
    state.dice = { ...state.dice, themes: [], error: true, refresh };
    render(<DiceThemeShop />);
    expect(screen.queryByTestId("dice-shop-empty")).toBeNull();
    fireEvent.click(screen.getByTestId("dice-shop-load-error").querySelector("button")!);
    expect(refresh).toHaveBeenCalled();
  });

  it("filtres : boutons à état pressé", () => {
    render(<DiceThemeShop />);
    expect(screen.getByTestId("dice-shop-filter-all").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByTestId("dice-shop-filter-team"));
    expect(screen.getByTestId("dice-shop-filter-team").getAttribute("aria-pressed")).toBe("true");
  });

  it("affiche l'erreur d'un achat refusé", async () => {
    state.dice = {
      ...state.dice,
      purchaseTheme: vi.fn(async () => {
        throw new Error("Solde de Crowns insuffisant");
      }),
    };
    render(<DiceThemeShop />);
    fireEvent.click(screen.getByTestId("dice-theme-buy-glace"));
    expect((await screen.findByRole("alert")).textContent).toContain("insuffisant");
  });
});
