/**
 * Erreurs Coûteuses (Expensive Mistakes) — Blood Bowl 2025 (saison 3).
 *
 * Étape de la Séquence d'Après-Match d'une Rencontre de Ligue : si la
 * trésorerie d'une équipe atteint 100 000 po à cette étape (après les
 * achats), elle jette un D6 et croise le résultat avec la colonne de
 * trésorerie correspondante du tableau.
 *
 * Référence interne : docs/regles-bb-2025/page-11.md (transcription non
 * publiée) — les libellés exposés ici sont reformulés.
 */

export type ExpensiveMistakeOutcome =
  | "crisis_averted"
  | "minor_incident"
  | "major_incident"
  | "catastrophe";

/** Trésorerie minimale (en po) déclenchant un jet d'Erreurs Coûteuses. */
export const EXPENSIVE_MISTAKES_THRESHOLD = 100_000;

const CRISIS = "crisis_averted" as const;
const MINOR = "minor_incident" as const;
const MAJOR = "major_incident" as const;
const CATA = "catastrophe" as const;

/**
 * Tableau officiel S2025 : lignes = D6 (1 à 6), colonnes = tranches de
 * trésorerie (100-195k, 200-295k, 300-395k, 400-495k, 500-595k, 600k+).
 */
const TABLE: ReadonlyArray<ReadonlyArray<ExpensiveMistakeOutcome>> = [
  [MINOR, MINOR, MINOR, MAJOR, MAJOR, CATA], // D6 = 1
  [CRISIS, MINOR, MINOR, MAJOR, CATA, CATA], // D6 = 2
  [CRISIS, CRISIS, MINOR, MINOR, MAJOR, MAJOR], // D6 = 3
  [CRISIS, CRISIS, CRISIS, MINOR, MINOR, MAJOR], // D6 = 4
  [CRISIS, CRISIS, CRISIS, CRISIS, MINOR, MAJOR], // D6 = 5
  [CRISIS, CRISIS, CRISIS, CRISIS, CRISIS, MINOR], // D6 = 6
];

/** Libellés FR affichables (reformulés, mêmes termes que le jeu). */
export const EXPENSIVE_MISTAKE_LABELS_FR: Record<
  ExpensiveMistakeOutcome,
  string
> = {
  crisis_averted: "Crise Évitée",
  minor_incident: "Incident Mineur",
  major_incident: "Incident Majeur",
  catastrophe: "Catastrophe",
};

/**
 * Index de colonne du tableau pour une trésorerie donnée, ou null si la
 * trésorerie est sous le seuil (aucun jet requis).
 */
export function expensiveMistakeBand(treasury: number): number | null {
  if (treasury < EXPENSIVE_MISTAKES_THRESHOLD) return null;
  if (treasury >= 600_000) return 5;
  return Math.floor(treasury / 100_000) - 1;
}

/**
 * Résultat du tableau pour une trésorerie et un jet de D6 donnés.
 * Retourne null si aucun jet n'est requis (trésorerie < 100 000 po).
 */
export function expensiveMistakeOutcome(
  treasury: number,
  d6: number,
): ExpensiveMistakeOutcome | null {
  const band = expensiveMistakeBand(treasury);
  if (band === null) return null;
  if (!Number.isInteger(d6) || d6 < 1 || d6 > 6) {
    throw new Error(`Jet de D6 invalide: ${d6}`);
  }
  return TABLE[d6 - 1][band];
}

/**
 * Résultats possibles (dédupliqués, du plus clément au plus grave) pour la
 * colonne de trésorerie donnée — pour proposer un choix en liste quand le
 * jet est fait physiquement autour de la table.
 */
export function possibleExpensiveMistakeOutcomes(
  treasury: number,
): ExpensiveMistakeOutcome[] {
  const band = expensiveMistakeBand(treasury);
  if (band === null) return [];
  const order: ExpensiveMistakeOutcome[] = [CRISIS, MINOR, MAJOR, CATA];
  const present = new Set(TABLE.map((row) => row[band]));
  return order.filter((o) => present.has(o));
}

const floorTo5k = (gold: number) => Math.floor(gold / 5_000) * 5_000;

/**
 * Perte de trésorerie (en po) pour un résultat donné.
 * - Crise Évitée : rien.
 * - Incident Mineur : D3 × 10 000 po (passer `dice.d3`).
 * - Incident Majeur : la moitié de la trésorerie part, le reste est
 *   arrondi aux 5 000 po inférieurs.
 * - Catastrophe : tout part sauf 2D6 × 10 000 po (passer `dice.twoD6`).
 */
export function expensiveMistakeLoss(
  treasury: number,
  outcome: ExpensiveMistakeOutcome,
  dice?: { d3?: number; twoD6?: number },
): number {
  switch (outcome) {
    case "crisis_averted":
      return 0;
    case "minor_incident": {
      const d3 = dice?.d3;
      if (!Number.isInteger(d3) || d3! < 1 || d3! > 3) {
        throw new Error(`Jet de D3 requis pour un Incident Mineur: ${d3}`);
      }
      return Math.min(treasury, d3! * 10_000);
    }
    case "major_incident":
      return treasury - floorTo5k(Math.floor(treasury / 2));
    case "catastrophe": {
      const twoD6 = dice?.twoD6;
      if (!Number.isInteger(twoD6) || twoD6! < 2 || twoD6! > 12) {
        throw new Error(`Jet de 2D6 requis pour une Catastrophe: ${twoD6}`);
      }
      const kept = Math.min(treasury, twoD6! * 10_000);
      return treasury - kept;
    }
  }
}
