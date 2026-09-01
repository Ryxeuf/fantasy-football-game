import React from "react";
import { render, screen } from "@testing-library/react";
import { BLOCK_DIE_FACE_INFO, type BlockResult } from "@bb/game-engine";
import { BlockDiceIcon } from "@bb/ui";

/**
 * Le libellé de l'icône vient de `BLOCK_DIE_FACE_INFO` (les noms du
 * livre : Attaquant Plaqué, Les Deux Plaqués, Repoussé, Bousculé,
 * Défenseur Plaqué). On le dérive ici au lieu de le recopier, pour que
 * le test suive la table sans re-figer une deuxième fois les textes.
 */
function altFor(result: BlockResult): string {
  const info = BLOCK_DIE_FACE_INFO[result];
  return `${info.nameFr} — ${info.effectFr}`;
}

describe("BlockDiceIcon", () => {
  const testCases = [
    {
      result: "PLAYER_DOWN",
      expectedImage: "/images/blocking_dice/player_down.png",
    },
    {
      result: "BOTH_DOWN",
      expectedImage: "/images/blocking_dice/both_down.png",
    },
    {
      result: "PUSH_BACK",
      expectedImage: "/images/blocking_dice/push_back.png",
    },
    { result: "STUMBLE", expectedImage: "/images/blocking_dice/stumble.png" },
    { result: "POW", expectedImage: "/images/blocking_dice/pow.png" },
  ] as const;

  testCases.forEach(({ result, expectedImage }) => {
    it(`devrait afficher la bonne image pour ${result}`, () => {
      render(<BlockDiceIcon result={result} />);

      const alt = altFor(result);
      const img = screen.getByAltText(alt);
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", expectedImage);
      expect(img).toHaveAttribute("title", alt);
    });
  });

  it("nomme les faces comme le livre, pas comme l'ancien jargon", () => {
    render(<BlockDiceIcon result="POW" />);
    // `pow.png` = Défenseur Plaqué, pas « POW! » ni « Joueur à terre ».
    expect(screen.getByAltText(altFor("POW")).getAttribute("alt")).toMatch(
      /^Défenseur Plaqué —/,
    );
  });

  it("devrait utiliser la taille par défaut de 24px", () => {
    render(<BlockDiceIcon result="PUSH_BACK" />);

    const img = screen.getByAltText(altFor("PUSH_BACK"));
    expect(img).toHaveStyle({ width: "24px", height: "24px" });
  });

  it("devrait utiliser une taille personnalisée", () => {
    render(<BlockDiceIcon result="PUSH_BACK" size={48} />);

    const img = screen.getByAltText(altFor("PUSH_BACK"));
    expect(img).toHaveStyle({ width: "48px", height: "48px" });
  });

  it("devrait appliquer les classes CSS personnalisées", () => {
    render(<BlockDiceIcon result="PUSH_BACK" className="custom-class" />);

    const img = screen.getByAltText(altFor("PUSH_BACK"));
    expect(img).toHaveClass("inline-block", "custom-class");
  });

  it("devrait avoir les bonnes propriétés de style", () => {
    render(<BlockDiceIcon result="PUSH_BACK" />);

    const img = screen.getByAltText(altFor("PUSH_BACK"));
    expect(img).toHaveStyle({
      objectFit: "contain",
    });
  });
});
