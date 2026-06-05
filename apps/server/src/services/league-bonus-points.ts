/**
 * Lot E — Points bonus configurables par ligue.
 *
 * Permet au commissaire de definir des regles de bonus appliquees
 * automatiquement au scoring d'un match. Chaque regle est une paire
 * (condition, points) declenchee selon le contexte du match
 * (TD marques, sorties infligees, etc.) cote home et/ou away.
 *
 * Le service est **pur** (pas d'I/O) : il prend en entree la config
 * + les stats du match, retourne le delta a appliquer cote home/away
 * ainsi qu'un breakdown utile pour l'audit / l'UI.
 *
 * La config est stockee dans `League.bonusPointsConfig` (JSON ; cf.
 * migration Lot E). Quand le champ est null/undefined, aucun bonus
 * n'est applique.
 */

export type BonusConditionType =
  | "tds_scored_gte"
  | "tds_conceded_lte"
  | "cas_inflicted_gte"
  | "killings_gte"
  | "completions_gte"
  | "margin_gte"
  | "clean_sheet"
  | "shut_out_win";

export interface BonusCondition {
  readonly type: BonusConditionType;
  /** Seuil ; ignore pour les conditions booleennes (clean_sheet/shut_out_win). */
  readonly value?: number;
}

export type BonusAppliesTo =
  | "home"
  | "away"
  | "both"
  | "winner"
  | "loser";

export interface BonusRule {
  readonly id: string;
  readonly label: string;
  readonly condition: BonusCondition;
  readonly points: number;
  readonly appliesTo: BonusAppliesTo;
}

export interface MatchBonusContext {
  readonly tdsHome: number;
  readonly tdsAway: number;
  readonly casualtiesInflictedHome: number;
  readonly casualtiesInflictedAway: number;
  readonly killingsHome?: number;
  readonly killingsAway?: number;
  readonly completionsHome?: number;
  readonly completionsAway?: number;
  /** "home" | "away" | "draw" — derivable des scores. */
  readonly winner: "home" | "away" | "draw";
}

export interface BonusAppliedEntry {
  readonly ruleId: string;
  readonly label: string;
  readonly side: "home" | "away";
  readonly points: number;
}

export interface BonusEvaluationResult {
  readonly homeBonus: number;
  readonly awayBonus: number;
  readonly applied: ReadonlyArray<BonusAppliedEntry>;
}

/**
 * Evalue toutes les regles pour un match donne. Pour chaque regle,
 * verifie la condition cote home et cote away (selon `appliesTo`),
 * accumule les points par cote.
 *
 * Si `rules` est vide ou null, retourne {0, 0, []} (no-op).
 */
export function evaluateBonusRules(
  rules: ReadonlyArray<BonusRule> | null | undefined,
  ctx: MatchBonusContext,
): BonusEvaluationResult {
  if (!rules || rules.length === 0) {
    return { homeBonus: 0, awayBonus: 0, applied: [] };
  }

  let homeBonus = 0;
  let awayBonus = 0;
  const applied: BonusAppliedEntry[] = [];

  for (const rule of rules) {
    if (rule.points === 0 || !Number.isFinite(rule.points)) continue;

    const sides = sidesFor(rule.appliesTo, ctx.winner);
    for (const side of sides) {
      if (matchesCondition(rule.condition, side, ctx)) {
        if (side === "home") homeBonus += rule.points;
        else awayBonus += rule.points;
        applied.push({
          ruleId: rule.id,
          label: rule.label,
          side,
          points: rule.points,
        });
      }
    }
  }

  return { homeBonus, awayBonus, applied };
}

function sidesFor(
  appliesTo: BonusAppliesTo,
  winner: "home" | "away" | "draw",
): Array<"home" | "away"> {
  switch (appliesTo) {
    case "home":
      return ["home"];
    case "away":
      return ["away"];
    case "both":
      return ["home", "away"];
    case "winner":
      if (winner === "draw") return [];
      return [winner];
    case "loser":
      if (winner === "draw") return [];
      return [winner === "home" ? "away" : "home"];
  }
}

function matchesCondition(
  condition: BonusCondition,
  side: "home" | "away",
  ctx: MatchBonusContext,
): boolean {
  const tdsFor = side === "home" ? ctx.tdsHome : ctx.tdsAway;
  const tdsAgainst = side === "home" ? ctx.tdsAway : ctx.tdsHome;
  const casFor =
    side === "home"
      ? ctx.casualtiesInflictedHome
      : ctx.casualtiesInflictedAway;
  const killsFor =
    side === "home" ? ctx.killingsHome ?? 0 : ctx.killingsAway ?? 0;
  const completionsFor =
    side === "home"
      ? ctx.completionsHome ?? 0
      : ctx.completionsAway ?? 0;
  const margin = tdsFor - tdsAgainst;
  const threshold = condition.value ?? 0;

  switch (condition.type) {
    case "tds_scored_gte":
      return tdsFor >= threshold;
    case "tds_conceded_lte":
      return tdsAgainst <= threshold;
    case "cas_inflicted_gte":
      return casFor >= threshold;
    case "killings_gte":
      return killsFor >= threshold;
    case "completions_gte":
      return completionsFor >= threshold;
    case "margin_gte":
      return margin >= threshold;
    case "clean_sheet":
      return tdsAgainst === 0;
    case "shut_out_win":
      return tdsAgainst === 0 && tdsFor > 0;
  }
}

/**
 * Parse + valide une config JSON arbitraire (cote serveur, defensive).
 * Retourne `null` si la config est mal formee, sinon le tableau de
 * regles canoniques (typed).
 */
export function parseBonusConfig(raw: unknown): BonusRule[] | null {
  // Le champ peut etre un string (sqlite mirror) ou un array (PG). Cf.
  // CLAUDE.md "Parser tolerant PG + sqlite pour JSON fields".
  let arr: unknown[];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      arr = parsed;
    } catch {
      return null;
    }
  } else {
    return null;
  }

  const rules: BonusRule[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== "string" || r.id.length === 0) continue;
    if (typeof r.label !== "string") continue;
    if (typeof r.points !== "number" || !Number.isFinite(r.points)) continue;
    const appliesTo = r.appliesTo;
    if (
      appliesTo !== "home" &&
      appliesTo !== "away" &&
      appliesTo !== "both" &&
      appliesTo !== "winner" &&
      appliesTo !== "loser"
    ) {
      continue;
    }
    const cond = r.condition as Record<string, unknown> | undefined;
    if (!cond || typeof cond !== "object") continue;
    const condType = cond.type;
    if (!isBonusConditionType(condType)) continue;
    const condValue =
      typeof cond.value === "number" && Number.isFinite(cond.value)
        ? cond.value
        : undefined;
    rules.push({
      id: r.id,
      label: r.label,
      condition: { type: condType, value: condValue },
      points: r.points,
      appliesTo,
    });
  }
  return rules;
}

function isBonusConditionType(v: unknown): v is BonusConditionType {
  return (
    v === "tds_scored_gte" ||
    v === "tds_conceded_lte" ||
    v === "cas_inflicted_gte" ||
    v === "killings_gte" ||
    v === "completions_gte" ||
    v === "margin_gte" ||
    v === "clean_sheet" ||
    v === "shut_out_win"
  );
}

/** Presets pratiques pour pre-remplir l'editeur cote UI. */
export const BONUS_PRESETS: ReadonlyArray<BonusRule> = [
  {
    id: "preset_3_tds",
    label: "3 TD marques",
    condition: { type: "tds_scored_gte", value: 3 },
    points: 1,
    appliesTo: "both",
  },
  {
    id: "preset_3_cas",
    label: "3 sorties infligees",
    condition: { type: "cas_inflicted_gte", value: 3 },
    points: 1,
    appliesTo: "both",
  },
  {
    id: "preset_clean_sheet",
    label: "Aucun TD encaisse",
    condition: { type: "clean_sheet" },
    points: 1,
    appliesTo: "both",
  },
  {
    id: "preset_shutout_win",
    label: "Victoire avec aucun TD encaisse",
    condition: { type: "shut_out_win" },
    points: 1,
    appliesTo: "winner",
  },
];
