/**
 * Les lettres d'accès d'un poste doivent porter le CODE COULEUR OFFICIEL des
 * catégories — elles étaient toutes vertes (primaire) ou grises (secondaire),
 * donc indiscernables entre elles.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SkillAccessBadges, { parseAccessCodes } from "./SkillAccessBadges";
import { LanguageProvider } from "../../../contexts/LanguageContext";
import { getSkillAccessPalette } from "../../../lib/skill-category-colors";

function renderBadges(primary: string | null, secondary: string | null) {
  return render(
    <LanguageProvider>
      <SkillAccessBadges primary={primary} secondary={secondary} />
    </LanguageProvider>,
  );
}

describe("SkillAccessBadges — code couleur officiel", () => {
  it("peint chaque lettre d'accès primaire à la teinte de sa catégorie", () => {
    renderBadges("G,A,S,P,M,K", null);
    // Force s'abrège « F » en français, Sournoiserie « S ».
    const byLetter: ReadonlyArray<readonly [string, string]> = [
      ["G", "G"],
      ["A", "A"],
      ["F", "S"],
      ["P", "P"],
      ["M", "M"],
      ["S", "K"],
    ];
    for (const [letter, code] of byLetter) {
      const badge = screen
        .getAllByText(letter)
        .find((el) => el.getAttribute("title")?.startsWith("Primaire"));
      expect(badge, `lettre ${letter} absente`).toBeTruthy();
      const palette = getSkillAccessPalette(code);
      for (const cls of palette.base.split(" ")) {
        expect(badge!.className).toContain(cls);
      }
    }
  });

  it("distingue le rôle par la bordure, pas par la couleur", () => {
    renderBadges("G", "G");
    const [primary, secondary] = screen
      .getAllByText("G")
      .sort((a) =>
        a.getAttribute("title")?.startsWith("Primaire") ? -1 : 1,
      );
    const palette = getSkillAccessPalette("G");
    // Même teinte des deux côtés…
    expect(primary.className).toContain(palette.base.split(" ")[0]);
    expect(secondary.className).toContain(palette.base.split(" ")[0]);
    // …le rôle se lit à la bordure.
    expect(primary.className).toContain("border-2");
    expect(secondary.className).toContain("border-dashed");
  });

  it("ne rend rien quand aucun accès n'est renseigné (season_2)", () => {
    const { container } = renderBadges(null, null);
    expect(container.firstChild).toBeNull();
  });
});

describe("parseAccessCodes", () => {
  it("normalise l'alias F→S, déduplique et ordonne", () => {
    expect(parseAccessCodes("F,g,a")).toEqual(["G", "A", "S"]);
    expect(parseAccessCodes("SSK")).toEqual(["S", "K"]);
    expect(parseAccessCodes(null)).toEqual([]);
  });
});
