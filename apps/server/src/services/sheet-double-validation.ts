/**
 * Double validation des feuilles de match (PUR).
 *
 * Option de coupe (`Cup.sheetDoubleValidation`) : cochée, le commissaire ne
 * valide une feuille qu'une fois SOUMISE par ses deux coachs — c'est
 * l'accord des deux tables sur ce qui s'est passé, avant que le résultat
 * n'entre au classement.
 *
 * Exception : sur un forfait déclaré, la soumission du coach FORFAITAIRE
 * n'est pas attendue. Un forfait se déclare souvent parce qu'un coach ne
 * s'est pas présenté ; l'attendre bloquerait la ronde entière.
 */

export type SheetSide = "home" | "away";

export interface SheetSubmissionState {
  readonly submittedByHomeAt?: Date | string | null;
  readonly submittedByAwayAt?: Date | string | null;
  /** Côté ayant déclaré forfait (`home` | `away`), sinon `null`. */
  readonly forfeitSide?: string | null;
}

/**
 * Côtés dont la soumission manque encore pour que le commissaire puisse
 * valider, dans l'ordre domicile → extérieur. Vide = rien n'est attendu.
 */
export function missingCoachSubmissions(
  sheet: SheetSubmissionState,
): SheetSide[] {
  const missing: SheetSide[] = [];
  if (!sheet.submittedByHomeAt && sheet.forfeitSide !== "home") {
    missing.push("home");
  }
  if (!sheet.submittedByAwayAt && sheet.forfeitSide !== "away") {
    missing.push("away");
  }
  return missing;
}

/** Message de refus : nomme les équipes dont la soumission manque. */
export function missingSubmissionsMessage(
  missing: readonly SheetSide[],
  teamNames: { readonly home?: string | null; readonly away?: string | null },
): string {
  const names = missing.map((side) =>
    side === "home"
      ? `« ${teamNames.home || "Domicile"} »`
      : `« ${teamNames.away || "Extérieur"} »`,
  );
  return `Double validation : la feuille doit d'abord être soumise par ${
    missing.length > 1 ? "les coachs de" : "le coach de"
  } ${names.join(" et ")} avant la validation du commissaire`;
}
