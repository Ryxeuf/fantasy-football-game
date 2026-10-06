import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Blocks } from "./Blocks";
import { BLOCK_DIE_FIGURE_FACES } from "./CompendiumDice";
import { getChapter } from "./data";

function chapterBlocks(slug: string) {
  const chapter = getChapter(slug);
  if (!chapter) throw new Error(`chapitre ${slug} introuvable`);
  return chapter.blocks;
}

describe("Blocks : dés du compendium", () => {
  it("déplie les six faces du Dé de Blocage, dont deux Repoussé", () => {
    expect(BLOCK_DIE_FIGURE_FACES).toEqual([
      "down",
      "bothdown",
      "push",
      "push",
      "stumble",
      "pow",
    ]);

    render(<Blocks blocks={chapterBlocks("des-de-blocage")} />);
    const figure = screen.getByTestId("compendium-block-dice");
    const faces = within(figure).getAllByRole("img");
    expect(faces).toHaveLength(6);
    expect(within(figure).getAllByAltText("Repoussé")).toHaveLength(2);
    // Dé original servi hors provider (visiteur, flag OFF).
    expect(faces[0].getAttribute("src")).toContain("/images/dices/nuffle-des-originaux/");
    expect(faces[0].getAttribute("data-dice-face")).toBe("attacker-down");
  });

  it("illustre chaque ligne de la table des faces de sa face", () => {
    render(<Blocks blocks={chapterBlocks("des-de-blocage")} />);
    const table = screen.getByRole("table");
    for (const name of [
      "Attaquant Plaqué",
      "Les Deux Plaqués",
      "Repoussé",
      "Bousculé",
      "Défenseur Plaqué",
    ]) {
      expect(within(table).getByAltText(name), name).toBeTruthy();
    }
  });

  it("dessine les jets de 2D6 en dés chiffrés et garde le texte pour l'accessibilité", () => {
    render(<Blocks blocks={chapterBlocks("blessures-eliminations")} />);
    const standard = screen.getByText("Tableau de blessure (standard)").closest("figure");
    if (!standard) throw new Error("table standard introuvable");
    expect(within(standard).getByText("2D6 : 2 à 7")).toBeTruthy();
    expect(within(standard).getByText("2D6 : 10 à 12")).toBeTruthy();
    const rolls = within(standard).getAllByTestId("compendium-roll");
    expect(rolls).toHaveLength(3);
    // « 2-7 » = deux faces chiffrées séparées d'un tiret.
    expect(rolls[0].querySelectorAll("svg")).toHaveLength(2);
  });

  it("dessine un D6 en faces à points, une par valeur de la plage", () => {
    render(<Blocks blocks={chapterBlocks("agressions")} />);
    const rolls = screen.getAllByTestId("compendium-roll");
    // Contester la décision : 1 / 2-5 / 6.
    expect(rolls.map((r) => r.querySelectorAll("circle[data-pip]").length > 0)).toEqual([
      true,
      true,
      true,
    ]);
    expect(rolls[1].querySelectorAll("svg")).toHaveLength(4);
    expect(within(rolls[1]).getByText("D6 : 2 à 5")).toBeTruthy();
  });

  it("laisse en texte une colonne qui n'est pas un jet", () => {
    render(<Blocks blocks={chapterBlocks("jeu-en-ligue")} />);
    // « Jet de D6 » porte des conditions, pas des plages.
    expect(screen.getByText("D6 ≥ Fans Dévoués actuels")).toBeTruthy();
  });
});
