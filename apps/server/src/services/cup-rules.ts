/**
 * Règles avancées de composition d'une coupe (mode coupe).
 *
 * Service **pur** (aucune I/O) : résout, pour une équipe donnée, le budget
 * max et le pool de PSP de départ imposés par la configuration d'une coupe.
 *
 * Les maps de config (`tierBudgets`, `rosterBudgetOverrides`,
 * `tierStartingPsp`) sont stockées en colonne JSON : objet natif côté
 * Postgres, string sérialisée côté miroir SQLite (tests). On parse donc de
 * façon **tolérante** aux deux formes (cf. CLAUDE.md « Parser tolerant PG +
 * sqlite »).
 */

import { getNextAdvancementPspCost, type AdvancementType } from '@bb/game-engine';

/** Tiers de roster reconnus (Blood Bowl 2025). */
export const CUP_TIERS = ['I', 'II', 'III', 'IV'] as const;
export type CupTier = (typeof CUP_TIERS)[number];

/** Champs de config coupe pertinents pour la résolution. Tous nullable. */
export interface CupRulesConfig {
  readonly tierBudgets?: unknown;
  readonly rosterBudgetOverrides?: unknown;
  readonly tierStartingPsp?: unknown;
  readonly rosterStartingPspOverrides?: unknown;
}

/** Ce dont on a besoin d'un roster pour résoudre ses règles. */
export interface RosterForRules {
  /** slug du roster (ex: "skaven"). */
  readonly slug: string;
  /** tier "I" | "II" | "III" | "IV". */
  readonly tier: string;
  /** Budget par défaut du roster, en kpo. */
  readonly budget: number;
}

/**
 * Parse une map `{ clé: nombre }` tolérante à :
 *  - `null` / `undefined` → `{}`
 *  - objet natif (Postgres JSONB)
 *  - string JSON sérialisée (miroir SQLite)
 * Ne conserve que les entrées dont la valeur est un nombre fini ≥ 0.
 */
export function parseNumberMap(raw: unknown): Record<string, number> {
  let source: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return {};
    try {
      source = JSON.parse(trimmed);
    } catch {
      return {};
    }
  }
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return {};
  }
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Budget max (kpo) imposé à une équipe par la coupe.
 * Précédence : **override par roster > budget du tier > budget par défaut du
 * roster**. Une coupe sans config renvoie donc le budget natif du roster.
 */
export function resolveCupBudget(
  config: CupRulesConfig,
  roster: RosterForRules,
): number {
  const overrides = parseNumberMap(config.rosterBudgetOverrides);
  if (roster.slug in overrides) {
    return overrides[roster.slug];
  }
  const tierBudgets = parseNumberMap(config.tierBudgets);
  if (roster.tier in tierBudgets) {
    return tierBudgets[roster.tier];
  }
  return roster.budget;
}

/**
 * Pool de PSP de départ que le coach peut dépenser en améliorations au build.
 * Précédence : **override par roster > PSP du tier > 0** (comportement neutre).
 */
export function resolveCupStartingPsp(
  config: CupRulesConfig,
  roster: RosterForRules,
): number {
  const overrides = parseNumberMap(config.rosterStartingPspOverrides);
  if (roster.slug in overrides) {
    return overrides[roster.slug];
  }
  const tierPsp = parseNumberMap(config.tierStartingPsp);
  return roster.tier in tierPsp ? tierPsp[roster.tier] : 0;
}

/**
 * Coût total en PSP des améliorations déjà prises par un joueur, en
 * additionnant le barème BB (getNextAdvancementPspCost) à chaque palier.
 * Tolérant : ignore les entrées mal formées.
 */
export function advancementsPspCost(
  advancements: ReadonlyArray<{ type?: unknown }>,
): number {
  let total = 0;
  advancements.forEach((adv, index) => {
    const type = adv?.type;
    if (
      type === 'primary' ||
      type === 'secondary' ||
      type === 'random-primary' ||
      type === 'characteristic'
    ) {
      total += getNextAdvancementPspCost(index, type as AdvancementType);
    }
  });
  return total;
}

/**
 * Coût PSP total des améliorations d'une équipe, à partir de la liste de ses
 * joueurs (champ `advancements` = JSON string). Sert à valider qu'une équipe
 * (Flow A) ne dépasse pas le pool de PSP de départ accordé par la coupe.
 */
export function teamAdvancementsPspCost(
  players: ReadonlyArray<{ advancements?: string | null }>,
): number {
  return players.reduce((sum, p) => {
    let parsed: unknown = [];
    if (p.advancements) {
      try {
        parsed = JSON.parse(p.advancements);
      } catch {
        parsed = [];
      }
    }
    return sum + (Array.isArray(parsed) ? advancementsPspCost(parsed) : 0);
  }, 0);
}
