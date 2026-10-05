import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiceSkinProvider } from "./DiceSkinContext";
import { SkinnedBlockFace, SkinnedNumberFace, SkinnedPipFace } from "./DieFaces";
import { getDiceSkin } from "./skins";

describe("faces de dés skinnées", () => {
  it("face de blocage : PNG du dé original hors provider", () => {
    render(<SkinnedBlockFace outcome="push" label="Repoussé" />);
    const img = screen.getByRole("img", { name: "Repoussé" });
    expect(img).toHaveAttribute("src", "/images/dices/nuffle-des-originaux/original-or/128px/push.png");
    expect(img).toHaveAttribute("data-dice-theme", "nuffle");
  });

  it("face de blocage : skin forcé et taille d'image choisie selon px", () => {
    render(<SkinnedBlockFace outcome="defender-down" label="Défenseur Plaqué" px={320} skin={getDiceSkin("glace")} />);
    expect(screen.getByRole("img", { name: "Défenseur Plaqué" })).toHaveAttribute(
      "src",
      "/images/dices/nuffle-des-pack-5-themes/glace/320px/defender-down.png",
    );
  });

  it("D6 : autant de points que la valeur, couleur du symbole du skin", () => {
    const { container } = render(<SkinnedPipFace value={5} label="D6 : 5" />);
    const pips = container.querySelectorAll("[data-pip]");
    expect(pips).toHaveLength(5);
    expect(pips[0].getAttribute("fill")).toBe("#D2A84E");
  });

  it("D6 : prend le skin du contexte et dessine un liseré si le skin en a un", () => {
    const { container } = render(
      <DiceSkinProvider skin={getDiceSkin("khorne")}>
        <SkinnedPipFace value={2} label="D6 : 2" />
      </DiceSkinProvider>,
    );
    const svg = screen.getByRole("img", { name: "D6 : 2" });
    expect(svg).toHaveAttribute("data-dice-theme", "khorne");
    expect(container.querySelectorAll("rect")).toHaveLength(2);
  });

  it("D6 hors 1-6 (total de 2D6) : valeur chiffrée", () => {
    const { container } = render(<SkinnedPipFace value={9} label="2D6 : 9" />);
    expect(container.querySelector("[data-die-value]")?.textContent).toBe("9");
    expect(container.querySelectorAll("[data-pip]")).toHaveLength(0);
  });

  it("dé chiffré : valeur + type de dé en coin", () => {
    render(<SkinnedNumberFace value={7} sides={8} label="D8 : 7" />);
    const svg = screen.getByRole("img", { name: "D8 : 7" });
    expect(svg.textContent).toContain("7");
    expect(svg.textContent).toContain("D8");
  });
});
