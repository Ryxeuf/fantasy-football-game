/**
 * Page d'équipe de la feuille de rencontre : les coups de pouce de l'équipe
 * y sont rappelés, là où on suit le match — ils n'étaient imprimés qu'en
 * page 1 (grille d'avant-match ou rappel d'inscription).
 */

import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import * as F from "../fixtures";
import { renderMatchSheet } from "./match-sheet";
import { inducementsLine, teamMatchInducements } from "./match-sheet-roster";
import type { MatchSheetDocument } from "../types";

/** Texte (non compressé) de chaque page, pour situer ce qui est imprimé où. */
function pagesText(data: MatchSheetDocument): string[] {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  renderMatchSheet(doc, data);
  const pages: string[] = [];
  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    doc.setPage(i);
    // Contenu brut de la page courante : `internal.pages` est indexé à 1.
    const raw = (doc.internal as unknown as { pages: string[][] }).pages[i];
    pages.push(raw.join("\n"));
  }
  return pages;
}

describe("teamMatchInducements", () => {
  it("reprend les achats d'avant-match du côté concerné", () => {
    expect(teamMatchInducements(F.leagueMatchSheet, "away")).toEqual([
      { name: "Pot-de-vin", qty: 1, cost: 100_000 },
      { name: "Prière à Nuffle", qty: 1, cost: 10_000 },
    ]);
    expect(teamMatchInducements(F.leagueMatchSheet, "home")).toEqual([]);
  });

  it("met les coups de pouce de l'inscription (coupe en build) en tête", () => {
    const data: MatchSheetDocument = {
      ...F.cupBuildMatchSheet,
      prefill: { inducementsHome: [{ name: "Pot-de-vin", qty: 1, cost: 100_000 }] },
    };
    expect(teamMatchInducements(data, "home").map((i) => i.name)).toEqual([
      "Mascotte d'Équipe",
      "Fûts de Blitz Premium",
      "Pot-de-vin",
    ]);
  });
});

describe("inducementsLine", () => {
  it("liste nom et quantité, rien sans achat", () => {
    expect(
      inducementsLine([
        { name: "Pot-de-vin", qty: 2, cost: 100_000 },
        { name: "Mascotte d'Équipe", qty: 1, cost: 25_000 },
      ]),
    ).toBe("Coups de pouce : Pot-de-vin ×2 · Mascotte d'Équipe ×1");
    expect(inducementsLine([])).toBeNull();
  });
});

describe("page d'équipe de la feuille imprimée", () => {
  it("rappelle les coups de pouce achetés en avant-match sur la page de l'équipe (ligue)", () => {
    const [, homePage, awayPage] = pagesText(F.leagueMatchSheet);
    expect(awayPage).toContain("Coups de pouce : Pot-de-vin ×1 · Prière à Nuffle ×1");
    // Le domicile n'a rien acheté : pas de ligne vide.
    expect(homePage).not.toContain("Coups de pouce :");
  });

  it("rappelle les coups de pouce de l'inscription sur la page de l'équipe (coupe en build)", () => {
    for (const data of [F.cupBuildMatchSheet, F.cupBuildSimplifiedMatchSheet]) {
      const [, homePage, awayPage] = pagesText(data);
      expect(homePage).toContain("Coups de pouce : Mascotte d'Équipe ×1 · Fûts de Blitz Premium ×2");
      expect(awayPage).not.toContain("Coups de pouce :");
    }
  });
});
