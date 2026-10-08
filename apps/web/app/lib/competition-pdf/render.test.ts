/**
 * Rendu des sept exports sur les jeux d'exemple (ligue et coupe) : chaque
 * document se génère sans erreur, a le bon nombre de pages et contient les
 * textes qui comptent. Le flux PDF n'étant pas compressé, les textes y sont
 * lisibles tels quels.
 */

import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import * as F from "./fixtures";
import { orientationFor, renderCompetitionPdf, type CompetitionPdfRequest } from "./render";
import { pdfFilename } from "./filename";
import { pdfSafe, formatGoldPdf } from "./theme";
import { compressWeatherResults, kickoffTableRows, prayersTableRows } from "./reference";
import { bracketCenters } from "./documents/bracket";
import { renderMatchSheet } from "./documents/match-sheet";

function pdfText(doc: jsPDF): string {
  return doc.output();
}

const CASES: Array<[string, CompetitionPdfRequest, number, string[]]> = [
  ["journée ligue", { kind: "matchday", data: F.leagueMatchday }, 1, ["Poule du Nord", "Les Crocs de Morr", "RAPPEL"]],
  ["classement ligue", { kind: "standings", data: F.leagueStandings }, 1, ["POULE DU SUD", "qualifi", "Forfait -1"]],
  ["tops ligue", { kind: "leaderboards", data: F.leagueLeaderboards }, 2, ["Meilleurs marqueurs", "Griff Oberwald"]],
  ["calendrier ligue", { kind: "calendar", data: F.leagueCalendar }, 2, ["JOURN", "2 - 1"]],
  ["play-offs ligue", { kind: "bracket", data: F.leagueBracket }, 1, ["DEMI-FINALES", "VAINQUEUR"]],
  ["stats ligue", { kind: "stats", data: F.leagueStats }, 1, ["PALMAR", "Basher", "TOTAUX PAR"]],
  ["feuille ligue", { kind: "match-sheet", data: F.leagueMatchSheet }, 5, ["Durin Brisecr", "Pot-de-vin", "JOURNAL DES", "FIN DE MATCH"]],
  ["ronde coupe", { kind: "matchday", data: F.cupMatchday }, 1, ["Ronde 3", "COUPE"]],
  ["classement coupe", { kind: "standings", data: F.cupStandings }, 1, ["Victoire 1000"]],
  ["tops coupe", { kind: "leaderboards", data: F.cupLeaderboards }, 1, ["Bashers"]],
  ["calendrier coupe", { kind: "calendar", data: F.cupCalendar }, 1, ["Syst"]],
  ["play-offs coupe", { kind: "bracket", data: F.cupBracket }, 1, ["QUARTS DE FINALE"]],
  ["stats coupe", { kind: "stats", data: F.cupStats }, 1, ["Passoires"]],
  ["feuille coupe", { kind: "match-sheet", data: F.cupMatchSheet }, 5, ["NOTES", "Coupe : aucun PSP"]],
];

describe("renderCompetitionPdf", () => {
  it.each(CASES)("%s : pages et contenu", (_label, req, pages, needles) => {
    const doc = renderCompetitionPdf(req);
    expect(doc.getNumberOfPages()).toBe(pages);
    const text = pdfText(doc);
    for (const n of needles) expect(text).toContain(n);
    // Pied de page numéroté sur la dernière page.
    expect(text).toContain(`Page ${pages} / ${pages}`);
  });

  it("met le bracket et la feuille de rencontre en paysage", () => {
    expect(orientationFor("bracket")).toBe("landscape");
    expect(orientationFor("match-sheet")).toBe("landscape");
    expect(orientationFor("standings")).toBe("portrait");
    const doc = renderCompetitionPdf({ kind: "bracket", data: F.leagueBracket });
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight());
  });

  it("ne dessine ni gains ni évolutions sur une feuille de coupe", () => {
    const league = pdfText(renderCompetitionPdf({ kind: "match-sheet", data: F.leagueMatchSheet }));
    const cup = pdfText(renderCompetitionPdf({ kind: "match-sheet", data: F.cupMatchSheet }));
    expect(league).toContain("Bonus de classement");
    expect(league).toContain("AMÉLIORATION");
    expect(cup).not.toContain("Bonus de classement");
    expect(cup).not.toContain("Trésorerie finale");
  });

  it("retire de la feuille de coupe simplifiée tout ce que le formulaire ne demande pas", () => {
    const full = pdfText(renderCompetitionPdf({ kind: "match-sheet", data: F.cupMatchSheet }));
    const doc = renderCompetitionPdf({ kind: "match-sheet", data: F.cupSimplifiedMatchSheet });
    // Même gabarit : mêmes pages, on retire des sections.
    expect(doc.getNumberOfPages()).toBe(5);
    const simplified = pdfText(doc);
    expect(simplified).toContain("Forfait");
    expect(simplified).toContain("JOURNAL DES");
    expect(simplified).toContain("Agression");
    for (const absent of ["Toss gagn", "Popularit", "Coups de pouce", "Table des Pri", "COUP D'ENVOI", "Commotion", "Lancer de co"]) {
      expect(full).toContain(absent);
      expect(simplified).not.toContain(absent);
    }
  });

  it("reporte les évènements déjà saisis dans le journal", () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    renderMatchSheet(doc, {
      ...F.leagueMatchSheet,
      prefill: {
        score: { home: 2, away: 1 },
        events: [{ half: 1, turn: 4, side: "home", kind: "TD", actor: "n°3", target: null, injury: null, detail: null }],
      },
    });
    const text = pdfText(doc);
    expect(text).toContain("n°3");
  });

  it("gère les documents vides sans planter", () => {
    const meta = F.LEAGUE_META;
    const empty: CompetitionPdfRequest[] = [
      { kind: "calendar", data: { meta, rounds: [] } },
      { kind: "standings", data: { meta, tables: [] } },
      { kind: "leaderboards", data: { meta, sections: [] } },
      { kind: "bracket", data: { meta, stages: [] } },
    ];
    for (const req of empty) expect(renderCompetitionPdf(req).getNumberOfPages()).toBe(1);
  });
});

describe("helpers", () => {
  it("pdfSafe retire emojis et flèches non encodables", () => {
    expect(pdfSafe("🏆 Finale → Karak ≥ 2")).toBe("Finale > Karak >= 2");
    expect(pdfSafe("Étourdissante — œuvre")).toBe("Étourdissante — œuvre");
    expect(pdfSafe(null)).toBe("");
  });

  it("formatGoldPdf groupe les milliers", () => {
    expect(formatGoldPdf(1_150_000)).toBe("1 150 k po");
    expect(formatGoldPdf(500)).toBe("500 po");
    expect(formatGoldPdf(null)).toBe("");
  });

  it("pdfFilename produit un nom ASCII", () => {
    expect(pdfFilename("standings", "Ligue du Vieux Monde", "Saison 3")).toBe(
      "classement-ligue-du-vieux-monde-saison-3.pdf",
    );
    expect(pdfFilename("match-sheet", "Crocs vs Khémri")).toBe("feuille-de-rencontre-crocs-vs-khemri.pdf");
  });

  it("compressWeatherResults regroupe les jets consécutifs identiques", () => {
    expect(
      compressWeatherResults([
        { roll: 3, condition: "Soleil" },
        { roll: 2, condition: "Chaleur" },
        { roll: 4, condition: "Parfait" },
        { roll: 5, condition: "Parfait" },
        { roll: 6, condition: "Parfait" },
        { roll: 7, condition: "Pluie" },
      ]),
    ).toEqual([
      { roll: "2", condition: "Chaleur" },
      { roll: "3", condition: "Soleil" },
      { roll: "4-6", condition: "Parfait" },
      { roll: "7", condition: "Pluie" },
    ]);
  });

  it("lit les tables de coup d'envoi (2D6) et de prières (D16) du moteur", () => {
    const kickoff = kickoffTableRows();
    expect(kickoff).toHaveLength(11);
    expect(kickoff[0].roll).toBe("2");
    expect(prayersTableRows()).toHaveLength(16);
  });

  it("bracketCenters centre chaque tour entre ses deux rencontres d'origine", () => {
    const [qf, sf, fin] = bracketCenters([4, 2, 1], 0, 80);
    expect(qf).toEqual([10, 30, 50, 70]);
    expect(sf).toEqual([20, 60]);
    expect(fin).toEqual([40]);
    // Tour qui ne compte pas la moitié du précédent : réparti à plat.
    expect(bracketCenters([3, 1], 0, 60)[1]).toEqual([30]);
  });
});
