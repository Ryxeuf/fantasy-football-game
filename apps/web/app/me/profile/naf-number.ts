/**
 * Numéro NAF du profil — logique PURE de l'écran (format, statut, lien).
 * La vérification elle-même est faite par le serveur (`PUT /user/naf-number`).
 */

/** URL publique de l'annuaire NAF (fiche coach). */
export const NAF_MEMBER_URL = "https://member.thenaf.net/index.php";

/** 1 à 7 chiffres, ou vide (effacement). Même règle que le serveur. */
export function isValidNafNumberInput(raw: string): boolean {
  const s = raw.trim();
  if (s === "") return true;
  return /^\d{1,7}$/.test(s) && Number.parseInt(s, 10) >= 1;
}

export interface NafNumberState {
  readonly nafNumber: number | null;
  readonly nafName: string | null;
  readonly nafVerifiedAt: string | null;
}

export type NafNumberStatus = "none" | "verified" | "pending";

/** Aucun numéro / vérifié / en attente de vérification. */
export function nafNumberStatus(state: NafNumberState): NafNumberStatus {
  if (state.nafNumber === null) return "none";
  return state.nafVerifiedAt ? "verified" : "pending";
}

/** Fiche coach publique sur thenaf.net. */
export function nafCoachPageUrl(nafNumber: number): string {
  return `${NAF_MEMBER_URL}?module=NAF&type=coachpage&coach=${nafNumber}`;
}
