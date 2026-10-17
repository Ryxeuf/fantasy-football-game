/**
 * Cellules « suivi » de la feuille de roster PDF (4 colonnes après le coût).
 *
 * Elles étaient écrites vides : un coach qui imprimait son roster après une
 * saison de ligue n'y retrouvait ni ses PSP, ni ses blessures. Chaque langue
 * garde ses en-têtes (feuille d'équipe officielle en français : PSP, RPM,
 * BP, RC ; en anglais : SPP, TDS, CAS, INT) et chaque cellule porte ce que
 * son en-tête annonce. RC reste à remplir à la main (aucune donnée).
 *
 * PUR : testable sans jsPDF.
 */
import type { PlayerCareer } from "../../../lib/player-career";

export interface RosterPdfPlayerStatus {
  readonly missNextMatch?: boolean | null;
  readonly nigglingInjuries?: number | null;
}

/** Valeur entière affichée, vide pour zéro (feuille à compléter au stylo). */
function countCell(value: number | null | undefined): string {
  return typeof value === "number" && value > 0 ? String(value) : "";
}

export function rosterPdfTrackingCells(
  player: RosterPdfPlayerStatus,
  career: PlayerCareer,
  language: "fr" | "en",
): [string, string, string, string] {
  if (language === "en") {
    return [
      String(career.spp),
      countCell(career.touchdowns),
      countCell(career.casualties),
      countCell(career.interceptions),
    ];
  }
  return [
    String(career.spp),
    player.missNextMatch ? "X" : "",
    countCell(player.nigglingInjuries),
    "",
  ];
}
