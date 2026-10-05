import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BlockDieIcon } from "./BlockDieIcon";
import { D6Icon } from "./D6Icon";
import { NumberDieIcon } from "./NumberDieIcon";
import { getDiceThemeRenderer } from "./themes/registry";
import type { DiceThemeRenderer } from "./types";

const FAKE_THEME: DiceThemeRenderer = {
  id: "fake",
  BlockFace: ({ face, label }) => <i data-testid="fake-block" data-face={face} aria-label={label} />,
  D6Face: ({ value, label }) => <i data-testid="fake-d6" data-value={value} aria-label={label} />,
  NumberFace: ({ value, label }) => <i data-testid="fake-number" data-value={value} aria-label={label} />,
};

const ORIGINAL = "/images/dices/nuffle-des-originaux/original-or";

describe("D6Icon", () => {
  it.each([1, 2, 3, 4, 5, 6])("face %i : autant de points que la valeur", (v) => {
    const { container } = render(<D6Icon value={v} />);
    expect(container.querySelectorAll("[data-pip]")).toHaveLength(v);
    expect(screen.getByRole("img", { name: `D6 : ${v}` })).toBeTruthy();
  });

  it("libellé accessible EN et surchargé", () => {
    render(<D6Icon value={3} lang="en" />);
    expect(screen.getByRole("img", { name: "D6: 3" })).toBeTruthy();
    render(<D6Icon value={4} label="Résultat du dé : 4" />);
    expect(screen.getByLabelText("Résultat du dé : 4")).toBeTruthy();
  });

  it("hors provider : le dé original or & charbon (hook no-op)", () => {
    const { container } = render(<D6Icon value={2} />);
    expect(container.querySelector("[data-dice-theme='nuffle']")).not.toBeNull();
    expect(container.querySelector("[data-pip]")?.getAttribute("fill")).toBe("#D2A84E");
  });

  it("valeur hors 1-6 : dé chiffré, jamais de plantage", () => {
    render(<D6Icon value={9} />);
    expect(screen.getByRole("img", { name: "9" }).textContent).toBe("9");
  });

  it("un thème forcé (aperçu) remplace celui du coach", () => {
    render(<D6Icon value={5} theme={FAKE_THEME} />);
    expect(screen.getByTestId("fake-d6").getAttribute("data-value")).toBe("5");
  });
});

describe("BlockDieIcon", () => {
  it("nom officiel de la face comme libellé accessible", () => {
    render(<BlockDieIcon face="pow" />);
    expect(screen.getByRole("img", { name: "Défenseur Plaqué" })).toBeTruthy();
    render(<BlockDieIcon face="bothdown" lang="en" />);
    expect(screen.getByRole("img", { name: "Both Down" })).toBeTruthy();
  });

  it("dessine la face PNG du dé ORIGINAL par défaut", () => {
    render(<BlockDieIcon face="pow" />);
    expect(screen.getByRole("img", { name: "Défenseur Plaqué" }).getAttribute("src")).toBe(`${ORIGINAL}/128px/defender-down.png`);
  });

  it("charge la résolution adaptée à la taille affichée", () => {
    render(<BlockDieIcon face="stumble" px={28} loading="lazy" />);
    const img = screen.getByRole("img", { name: "Bousculé" });
    expect(img.getAttribute("src")).toBe(`${ORIGINAL}/64px/defender-stumbles.png`);
    expect(img.getAttribute("loading")).toBe("lazy");
  });

  it("un thème forcé (aperçu) remplace celui du coach", () => {
    render(<BlockDieIcon face="stumble" theme={FAKE_THEME} />);
    expect(screen.getByTestId("fake-block").getAttribute("data-face")).toBe("stumble");
  });

  it("un thème d'équipe pointe vers ses propres faces", () => {
    render(<BlockDieIcon face="down" theme={getDiceThemeRenderer("nains")} />);
    expect(screen.getByRole("img", { name: "Attaquant Plaqué" }).getAttribute("src")).toBe("/images/dices/nuffle-des-31-equipes/equipes/nains/128px/attacker-down.png");
  });
});

describe("NumberDieIcon", () => {
  it("valeur + type de dé, libellé « D8 : n »", () => {
    render(<NumberDieIcon value={7} sides={8} />);
    const die = screen.getByRole("img", { name: "D8 : 7" });
    expect(die.textContent).toContain("7");
    expect(die.textContent).toContain("D8");
  });

  it("sans nombre de faces : « Jet : n » (EN « Roll: n »)", () => {
    render(<NumberDieIcon value={11} lang="en" />);
    expect(screen.getByRole("img", { name: "Roll: 11" })).toBeTruthy();
  });

  it("un thème forcé (aperçu) remplace celui du coach", () => {
    render(<NumberDieIcon value={3} sides={3} theme={FAKE_THEME} />);
    expect(screen.getByTestId("fake-number").getAttribute("data-value")).toBe("3");
  });
});
