import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BlockDieIcon } from "./BlockDieIcon";
import { D6Icon } from "./D6Icon";
import type { DiceThemeRenderer } from "./types";

const FAKE_THEME: DiceThemeRenderer = {
  id: "fake",
  BlockFace: ({ face, label }) => <i data-testid="fake-block" data-face={face} aria-label={label} />,
  D6Face: ({ value, label }) => <i data-testid="fake-d6" data-value={value} aria-label={label} />,
};

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

  it("hors thème : le défaut « Nuffle » dessine (hook no-op hors provider)", () => {
    const { container } = render(<D6Icon value={2} />);
    expect(container.querySelector("[data-dice-theme='nuffle']")).not.toBeNull();
  });

  it("valeur hors 1-6 : rendu texte brut, jamais de plantage", () => {
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

  it("un thème forcé (aperçu) remplace celui du coach", () => {
    render(<BlockDieIcon face="stumble" theme={FAKE_THEME} />);
    expect(screen.getByTestId("fake-block").getAttribute("data-face")).toBe("stumble");
  });

  it("plusieurs dés sur une page ne partagent pas leur dégradé", () => {
    const { container } = render(
      <>
        <BlockDieIcon face="push" />
        <BlockDieIcon face="push" />
        <D6Icon value={6} />
      </>,
    );
    const ids = Array.from(container.querySelectorAll("linearGradient")).map((g) => g.id);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });
});
