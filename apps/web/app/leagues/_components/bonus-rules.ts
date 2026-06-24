// E1 — Modele cote UI des regles de points bonus de ligue.
//
// Le moteur d'evaluation ET la validation font autorite cote serveur
// (`apps/server/src/services/league-bonus-points.ts` + Zod
// `createLeagueSchema`). Ces types / presets sont une copie minimale
// dediee a l'editeur ; le serveur re-valide systematiquement via
// `parseBonusConfig`, donc tout drift est rattrape cote API.

export type BonusConditionType =
  | "tds_scored_gte"
  | "tds_conceded_lte"
  | "cas_inflicted_gte"
  | "killings_gte"
  | "completions_gte"
  | "margin_gte"
  | "clean_sheet"
  | "shut_out_win";

export type BonusAppliesTo = "home" | "away" | "both" | "winner" | "loser";

export interface BonusRuleValue {
  readonly id: string;
  readonly label: string;
  readonly condition: {
    readonly type: BonusConditionType;
    /** Seuil ; absent pour les conditions booleennes. */
    readonly value?: number;
  };
  readonly points: number;
  readonly appliesTo: BonusAppliesTo;
}

/** Aligne sur `createLeagueSchema` (`.max(20)`). */
export const MAX_BONUS_RULES = 20;

/** Conditions booleennes : pas de seuil `value`. */
export const BOOLEAN_CONDITIONS: ReadonlySet<BonusConditionType> = new Set<BonusConditionType>([
  "clean_sheet",
  "shut_out_win",
]);

export const BONUS_CONDITION_TYPES: readonly BonusConditionType[] = [
  "tds_scored_gte",
  "tds_conceded_lte",
  "cas_inflicted_gte",
  "killings_gte",
  "completions_gte",
  "margin_gte",
  "clean_sheet",
  "shut_out_win",
];

export const BONUS_APPLIES_TO: readonly BonusAppliesTo[] = [
  "both",
  "home",
  "away",
  "winner",
  "loser",
];

export interface BonusPreset {
  /** Cle stable pour le data-testid + la resolution i18n. */
  readonly key: string;
  readonly condition: { readonly type: BonusConditionType; readonly value?: number };
  readonly points: number;
  readonly appliesTo: BonusAppliesTo;
}

/** Presets pratiques (miroir de `BONUS_PRESETS` serveur). */
export const BONUS_PRESETS: readonly BonusPreset[] = [
  { key: "3tds", condition: { type: "tds_scored_gte", value: 3 }, points: 1, appliesTo: "both" },
  { key: "3cas", condition: { type: "cas_inflicted_gte", value: 3 }, points: 1, appliesTo: "both" },
  { key: "cleanSheet", condition: { type: "clean_sheet" }, points: 1, appliesTo: "both" },
  { key: "shutoutWin", condition: { type: "shut_out_win" }, points: 1, appliesTo: "winner" },
];

let idSeq = 0;
/** Id unique (monotone) pour une nouvelle regle cote client. */
export function nextBonusRuleId(): string {
  idSeq += 1;
  return `bonus_${idSeq}`;
}

export function isBonusConditionType(v: unknown): v is BonusConditionType {
  return (
    typeof v === "string" &&
    (BONUS_CONDITION_TYPES as readonly string[]).includes(v)
  );
}

export function isBonusAppliesTo(v: unknown): v is BonusAppliesTo {
  return (
    typeof v === "string" && (BONUS_APPLIES_TO as readonly string[]).includes(v)
  );
}

/** Construit une regle a partir d'un preset (id frais). */
export function presetToRule(preset: BonusPreset, label: string): BonusRuleValue {
  return {
    id: nextBonusRuleId(),
    label,
    condition: { ...preset.condition },
    points: preset.points,
    appliesTo: preset.appliesTo,
  };
}

/** Regle vierge par defaut (3 TD marques, both, +1). */
export function emptyBonusRule(label: string): BonusRuleValue {
  return {
    id: nextBonusRuleId(),
    label,
    condition: { type: "tds_scored_gte", value: 3 },
    points: 1,
    appliesTo: "both",
  };
}

/**
 * Parse le champ `bonusPointsConfig` renvoye par l'API en regles
 * canoniques. Tolerant PG (array natif) + sqlite (string JSON) + null.
 * Cf. CLAUDE.md « Parser tolerant PG + sqlite pour JSON fields ».
 * Les entrees malformees sont silencieusement ignorees.
 */
export function parseBonusRulesFromApi(raw: unknown): BonusRuleValue[] {
  let arr: unknown[];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      arr = parsed;
    } catch {
      return [];
    }
  } else {
    return [];
  }

  const rules: BonusRuleValue[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const cond = r.condition;
    if (typeof cond !== "object" || cond === null) continue;
    const condType = (cond as Record<string, unknown>).type;
    if (!isBonusConditionType(condType)) continue;
    if (typeof r.points !== "number" || !Number.isFinite(r.points)) continue;
    if (!isBonusAppliesTo(r.appliesTo)) continue;
    const rawValue = (cond as Record<string, unknown>).value;
    const value =
      typeof rawValue === "number" && Number.isFinite(rawValue)
        ? rawValue
        : undefined;
    rules.push({
      id: typeof r.id === "string" && r.id.length > 0 ? r.id : nextBonusRuleId(),
      label: typeof r.label === "string" ? r.label : "",
      condition: BOOLEAN_CONDITIONS.has(condType)
        ? { type: condType }
        : { type: condType, value: value ?? 0 },
      points: r.points,
      appliesTo: r.appliesTo,
    });
  }
  return rules;
}

export interface SerializedBonusRule {
  id: string;
  label: string;
  condition: { type: BonusConditionType; value?: number };
  points: number;
  appliesTo: BonusAppliesTo;
}

/**
 * Serialise les regles pour le body POST/PATCH. Retourne `null` quand il
 * n'y a aucune regle (le serveur traite null = pas de bonus). Garantit
 * des entiers + un libelle non vide pour satisfaire le schema Zod.
 */
export function serializeBonusRules(
  rules: readonly BonusRuleValue[],
): SerializedBonusRule[] | null {
  if (rules.length === 0) return null;
  return rules.map((r) => {
    const isBool = BOOLEAN_CONDITIONS.has(r.condition.type);
    const points = Number.isFinite(r.points) ? Math.trunc(r.points) : 0;
    const label = r.label.trim().slice(0, 120) || "Bonus";
    if (isBool) {
      return { id: r.id, label, condition: { type: r.condition.type }, points, appliesTo: r.appliesTo };
    }
    const rawValue = r.condition.value;
    const value = typeof rawValue === "number" && Number.isFinite(rawValue) ? Math.trunc(rawValue) : 0;
    return { id: r.id, label, condition: { type: r.condition.type, value }, points, appliesTo: r.appliesTo };
  });
}

// E3 — Lecture du breakdown des bonus appliqués par match (snapshot
// `LeaguePairing.bonusBreakdown` : [{ ruleId, label, side, points }]).

export interface BonusBreakdownEntry {
  readonly ruleId: string;
  readonly label: string;
  readonly side: "home" | "away";
  readonly points: number;
}

/**
 * Parse le snapshot `bonusBreakdown` renvoyé par l'API en entrées
 * canoniques. Tolérant PG (array natif) + sqlite (string JSON) + null.
 * Les entrées malformées sont ignorées.
 */
export function parseBonusBreakdown(raw: unknown): BonusBreakdownEntry[] {
  let arr: unknown[];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      arr = parsed;
    } catch {
      return [];
    }
  } else {
    return [];
  }

  const out: BonusBreakdownEntry[] = [];
  for (const item of arr) {
    if (typeof item !== "object" || item === null) continue;
    const e = item as Record<string, unknown>;
    if (e.side !== "home" && e.side !== "away") continue;
    if (typeof e.points !== "number" || !Number.isFinite(e.points)) continue;
    out.push({
      ruleId: typeof e.ruleId === "string" ? e.ruleId : "",
      label: typeof e.label === "string" ? e.label : "",
      side: e.side,
      points: e.points,
    });
  }
  return out;
}
