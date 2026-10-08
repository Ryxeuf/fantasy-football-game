/**
 * Profil de saisie d'une feuille de rencontre imprimée. Une coupe en saisie
 * simplifiée garde le MÊME gabarit : ses sections et colonnes non demandées
 * sont retirées, rien n'est redessiné.
 */

import type { MatchSheetDocument, PdfSheetEntry } from "../types";

/** Feuille complète : ce que montre un document sans profil (rétro-compat). */
export const FULL_SHEET_ENTRY: PdfSheetEntry = {
  preMatch: "full",
  halfAndTurn: true,
  injuryDetails: true,
  kickoffDetails: true,
  passReceiver: true,
  eventLegend: null,
  tally: null,
};

export function sheetEntryOf(data: MatchSheetDocument): PdfSheetEntry {
  return data.entry ?? FULL_SHEET_ENTRY;
}
