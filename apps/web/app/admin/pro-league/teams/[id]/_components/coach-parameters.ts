/**
 * Lot 4 « évolution persistée » — libellés français des 15 paramètres du
 * profil tactique (`TacticalProfile`, `@bb/sim-engine`). Miroir local pour
 * ne pas tirer le moteur dans le bundle client ; la cohérence avec
 * `TACTICAL_PROFILE_PARAMETERS` est verrouillée par le test du panneau.
 */

export interface CoachParameterLabel {
  readonly key: string;
  readonly label: string;
  readonly low: string;
  readonly high: string;
}

export const COACH_PARAMETERS: readonly CoachParameterLabel[] = [
  { key: "bashIndex", label: "Bagarre", low: "Déplacer", high: "Bloquer" },
  { key: "passingFrequency", label: "Passes", low: "Jeu au sol", high: "Jeu aérien" },
  { key: "riskAppetite", label: "Appétit pour le risque", low: "Prudent", high: "Joueur" },
  { key: "cageAffinity", label: "Cage", low: "Jeu ouvert", high: "Cage serrée" },
  { key: "blitzPriority", label: "Priorité au blitz", low: "Protéger", high: "Blitzer" },
  { key: "rerollUsage", label: "Relances", low: "Économe", high: "Dépensier" },
  { key: "pace", label: "Allure", low: "Posé", high: "Pressé" },
  { key: "foulFrequency", label: "Agressions", low: "Correct", high: "Vicieux" },
  { key: "stallTendency", label: "Temporisation", low: "Marquer vite", high: "Temporiser" },
  { key: "kickReturn", label: "Retour de coup d'envoi", low: "Sûr", high: "Échappée" },
  { key: "screenAffinity", label: "Écran défensif", low: "Pression", high: "Écran" },
  { key: "breakawayInstinct", label: "Instinct d'échappée", low: "Collectif", high: "Solo" },
  { key: "pressingDefense", label: "Pression défensive", low: "Zone", high: "Pression" },
  { key: "patience", label: "Patience", low: "Impulsif", high: "Patient" },
  { key: "gfiTolerance", label: "Tolérance aux GFI", low: "Aucun", high: "Enchaîner" },
];

export type CoachProfile = Readonly<Record<string, number>>;

/** Paramètres dont la valeur diffère entre deux profils. */
export function diffProfiles(a: CoachProfile, b: CoachProfile): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of COACH_PARAMETERS) {
    if (a[p.key] !== b[p.key]) out[p.key] = b[p.key];
  }
  return out;
}
