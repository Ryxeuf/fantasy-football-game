import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { state } = vi.hoisted(() => ({
  state: {
    value: {
      enabled: true,
      loading: false,
      themeId: "nuffle",
      ownedThemeIds: new Set(["nuffle", "bone"]),
      selectTheme: vi.fn(async () => {}),
    } as Record<string, unknown>,
  },
}));

vi.mock("../../contexts/DiceThemeContext", () => ({
  useDiceTheme: () => state.value,
}));

// Deux thèmes possédés + un thème payant non acheté, pour couvrir les trois
// états d'une carte (le vrai catalogue n'a encore que le défaut).
vi.mock("../../components/dice/themes/catalogue", () => ({
  DEFAULT_DICE_THEME_ID: "nuffle",
  DICE_THEME_CATALOGUE: [
    { id: "nuffle", priceCrowns: null, name: { fr: "Nuffle", en: "Nuffle" }, description: { fr: "d", en: "d" } },
    { id: "bone", priceCrowns: null, name: { fr: "Os", en: "Bone" }, description: { fr: "d", en: "d" } },
    { id: "gold", priceCrowns: 500, name: { fr: "Or", en: "Gold" }, description: { fr: "d", en: "d" } },
  ],
}));

import DiceThemePicker from "./DiceThemePicker";

describe("DiceThemePicker", () => {
  beforeEach(() => {
    state.value = { ...state.value, enabled: true, themeId: "nuffle", selectTheme: vi.fn(async () => {}) };
  });

  it("flag OFF : rien n'est rendu", () => {
    state.value = { ...state.value, enabled: false };
    render(<DiceThemePicker />);
    expect(screen.queryByTestId("dice-theme-picker")).toBeNull();
  });

  it("marque le thème actif et prévisualise ses 5 faces de blocage + 6 D6", () => {
    render(<DiceThemePicker />);
    const card = screen.getByTestId("dice-theme-nuffle");
    expect(card.getAttribute("data-selected")).toBe("true");
    expect(card.textContent).toContain("Thème actif");
    expect(card.querySelectorAll("svg[role='img']")).toHaveLength(11);
  });

  it("un thème possédé se choisit", async () => {
    render(<DiceThemePicker />);
    const card = screen.getByTestId("dice-theme-bone");
    fireEvent.click(card.querySelector("button")!);
    await waitFor(() => expect(state.value.selectTheme).toHaveBeenCalledWith("bone"));
  });

  it("un thème payant non possédé est verrouillé avec son prix", () => {
    render(<DiceThemePicker />);
    const card = screen.getByTestId("dice-theme-gold");
    expect(card.textContent).toContain("500 Crowns");
    const btn = card.querySelector("button")!;
    expect(btn.disabled).toBe(true);
  });

  it("affiche l'erreur d'enregistrement", async () => {
    state.value = {
      ...state.value,
      selectTheme: vi.fn(async () => {
        throw new Error("Thème de dés non possédé");
      }),
    };
    render(<DiceThemePicker />);
    fireEvent.click(screen.getByTestId("dice-theme-bone").querySelector("button")!);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("non possédé");
  });
});
