/**
 * Sprint Pro League — Lot 3.B.1 : resolver driverKind hybrid/full.
 *
 * Cohabitation `hybrid` (synthèse archétype-vs-archétype, lot 0.A.2)
 * et `full` (auto-play game-engine roster-aware, lot 3.A.2). Pour
 * permettre un A/B test progressif au sein d'une même saison sans
 * forcer une migration en bloc, le toggle est porté à deux niveaux :
 *
 *  - `ProLeagueSeason.driverKind` : default pour tous les matchs
 *    de la saison. Pinne à la création de saison, comme `engineVer`.
 *  - `ProLeagueMatch.driverKindOverride` : optionnel par match.
 *    Si non-null, prend précédence sur la saison.
 *
 * Le sim-runner (lot 1.A.4) lit ces deux champs en début de
 * `simulateProMatch` et appelle `runHybridDriver` ou `runFullDriver`
 * en fonction. La sélection est figée pour la durée de la sim — on
 * ne switche jamais en plein match (cohérence du replay).
 *
 * Garde-fous
 * ----------
 *  - Toute valeur non reconnue côté DB (corruption, downgrade futur)
 *    retombe sur `hybrid` côté saison (= behavior pré-3.B.1) plutôt
 *    que de planter, et l'override invalide est ignoré.
 *  - `isValidDriverKind` exporté pour validation côté Zod (admin
 *    routes 2.C.2 / 3.B.2).
 */

import type { SimDriver } from "../utils/metrics";

const VALID_KINDS = new Set<SimDriver>(["hybrid", "full"]);

/**
 * Type-guard public : narrow `unknown` en `SimDriver` strict.
 * Strict case-sensitive (`'Hybrid'` est rejeté) pour rester aligné
 * avec les valeurs persistées en DB et les enum Prometheus.
 */
export function isValidDriverKind(value: unknown): value is SimDriver {
  return typeof value === "string" && VALID_KINDS.has(value as SimDriver);
}

export interface DriverResolveInput {
  /**
   * Valeur de `season.driverKind` pinnée à la création de la saison.
   * Default DB = `'hybrid'` (cf. migration 20260508000000).
   */
  readonly seasonDriverKind: SimDriver | string;
  /**
   * Override optionnel sur `match.driverKindOverride`. `null` ou
   * `undefined` = pas d'override, on inherit la saison.
   */
  readonly matchOverride?: SimDriver | string | null;
}

/**
 * Résout le `SimDriver` à utiliser pour un match donné, en combinant
 * la valeur saison et l'override match. Pure / déterministe / sans
 * I/O — l'appelant fournit les valeurs déjà chargées depuis Prisma.
 *
 * Ordre de précédence :
 *  1. `matchOverride` si valide (`'hybrid' | 'full'`)
 *  2. `seasonDriverKind` si valide
 *  3. Fallback `'hybrid'` (= behavior pré-3.B.1, le plus safe)
 */
export function resolveDriverKind(input: DriverResolveInput): SimDriver {
  if (input.matchOverride && isValidDriverKind(input.matchOverride)) {
    return input.matchOverride;
  }
  if (isValidDriverKind(input.seasonDriverKind)) {
    return input.seasonDriverKind;
  }
  return "hybrid";
}
