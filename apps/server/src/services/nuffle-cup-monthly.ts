/**
 * S27.1a — Helpers Nuffle Cup mensuelles.
 *
 * Convention : une "Nuffle Cup mensuelle" est une `Cup` avec un couple
 * `(monthlyYear, monthlyMonth)` defini, marquant l'edition canonique
 * du mois (ex. "Nuffle Cup Avril 2026"). Les champs sont nullable sur
 * la table Cup pour rester retro-compatibles avec les cups privees
 * non programmees ; la validation du couple est faite ici (1-12 et
 * annee positive).
 *
 * Foundation pour le bracket visuel `/cups/{slug}`, le match-of-week
 * et le badge profil "Champion Nuffle Cup {Mois} {YYYY}" (S27.1b-d).
 *
 * Pas de catalogue par mois (anti-overengineering) : la convention
 * publique est "1 cup mensuelle Nuffle Cup {Mois} {YYYY}", librement
 * declinable par les admins selon les retours communautaires.
 */

export const MONTH_LABELS_FR: readonly string[] = Object.freeze([
  "Janvier",
  "Fevrier",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Aout",
  "Septembre",
  "Octobre",
  "Novembre",
  "Decembre",
]);

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export function getMonthLabelFr(month: number): string | null {
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return MONTH_LABELS_FR[month - 1];
}

export function isValidMonthlyCupSlot(year: number, month: number): boolean {
  if (!isPositiveInteger(year)) return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  return true;
}

export function formatMonthlyNuffleCupName(
  year: number,
  month: number,
): string | null {
  if (!isValidMonthlyCupSlot(year, month)) return null;
  return `Nuffle Cup ${MONTH_LABELS_FR[month - 1]} ${year}`;
}

export function formatMonthlyNuffleCupChampionLabel(
  year: number,
  month: number,
): string | null {
  if (!isValidMonthlyCupSlot(year, month)) return null;
  return `Champion Nuffle Cup ${MONTH_LABELS_FR[month - 1]} ${year}`;
}
