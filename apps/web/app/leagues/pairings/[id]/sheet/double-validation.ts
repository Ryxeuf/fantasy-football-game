/**
 * Double validation de la feuille (PUR) — miroir de
 * `apps/server/src/services/sheet-double-validation` : le serveur reste juge,
 * l'écran désactive le bouton du commissaire et dit qui manque.
 *
 * Sous l'option, la validation attend la soumission des deux coachs, hors
 * coach forfaitaire (un coach absent bloquerait sinon la ronde).
 */

export type SheetSide = "home" | "away";

export interface SheetSubmissionState {
  readonly status: string;
  readonly submittedByHomeAt?: string | null;
  readonly submittedByAwayAt?: string | null;
  readonly forfeitSide?: string | null;
}

/**
 * Côtés dont la soumission manque. Les dates de soumission sont lues en
 * priorité ; un serveur qui ne les servirait pas retombe sur le statut.
 */
export function pendingSubmissionSides(sheet: SheetSubmissionState): SheetSide[] {
  const homeDone =
    Boolean(sheet.submittedByHomeAt) ||
    sheet.status === "submitted_home" ||
    sheet.status === "both_submitted";
  const awayDone =
    Boolean(sheet.submittedByAwayAt) ||
    sheet.status === "submitted_away" ||
    sheet.status === "both_submitted";
  const missing: SheetSide[] = [];
  if (!homeDone && sheet.forfeitSide !== "home") missing.push("home");
  if (!awayDone && sheet.forfeitSide !== "away") missing.push("away");
  return missing;
}

/** « en attente de la soumission de Orcs et Rats » — vide si rien ne manque. */
export function pendingSubmissionsLabel(
  missing: readonly SheetSide[],
  teamNames: { readonly home?: string | null; readonly away?: string | null },
): string {
  if (missing.length === 0) return "";
  const names = missing.map((side) =>
    side === "home" ? teamNames.home || "Domicile" : teamNames.away || "Extérieur",
  );
  return `En attente de la soumission de ${names.join(" et ")}`;
}
