/**
 * Bonus SPP appliques aux skills Blood Bowl d'un joueur NFL Fantasy.
 *
 * Contexte
 * --------
 * Apres `computeSpp()` (cf. `@bb/nfl-mapper`), un joueur a un set
 * d'events TD/CP/DP/CAS/MALUS. Si le joueur possede des skills BB
 * (ex: `pass`, `block`, `sure-hands`, dérivés via `nfl-bb-derivation`),
 * on ajoute un bonus thematique par skill — toujours capé pour éviter
 * qu'un super match unique ne snowball.
 *
 * Pur, deterministe, replay-friendly. Aucun I/O.
 *
 * Mapping curé
 * ------------
 * Chaque skill matche sur le type + un regex sur `reason` (reason text
 * généré par `@bb/nfl-mapper`). Plus un cap par skill pour borner.
 *
 * - `pass`                 +1 SPP par TD passing (cap 3)
 * - `sure-hands`           +1 SPP par MALUS fumble (cap 2)
 * - `safe-pair-of-hands`   +1 SPP par MALUS drop (cap 2)
 * - `catch`                +1 SPP si au moins 1 TD receiving (cap 1)
 * - `block`                +1 SPP par CAS (cap 3)
 * - `mighty-blow-1`        +1 SPP par CAS (cap 3) — variantes 2/3 idem
 * - `dodge`                +1 SPP par DP interception (cap 2)
 * - `tackle`               +1 SPP si au moins 1 forced fumble (cap 1)
 * - `frenzy`               +1 SPP si au moins 2 CAS sur le match (cap 1)
 *
 * Les autres skills (Trait, Scélérates, etc.) ne génèrent pas de bonus
 * de scoring V1.
 */

import type { SppEvent } from "@bb/nfl-mapper";

export interface SkillBonusEvent {
  readonly skill: string;
  readonly count: number;
  readonly spp: number;
  readonly reason: string;
}

export interface SkillBonusResult {
  readonly bonusEvents: readonly SkillBonusEvent[];
  readonly totalBonusSpp: number;
}

interface SkillRule {
  readonly cap: number;
  readonly match: (e: SppEvent) => boolean;
  readonly aggregate?: "per-event" | "any";
  readonly reasonLabel: string;
}

const REASON_PASSING_TD = /passing TD/i;
const REASON_RECEIVING_TD = /receiving TD/i;
const REASON_FUMBLE = /fumble lost/i;
const REASON_DROP = /drop/i;
const REASON_INT = /\bINT\b/;
const REASON_FORCED_FUMBLE = /forced fumble/i;

const SKILL_BONUS_RULES: ReadonlyMap<string, SkillRule> = new Map([
  [
    "pass",
    {
      cap: 3,
      match: (e) => e.type === "TD" && REASON_PASSING_TD.test(e.reason),
      aggregate: "per-event",
      reasonLabel: "passing TD",
    },
  ],
  [
    "catch",
    {
      cap: 1,
      match: (e) => e.type === "TD" && REASON_RECEIVING_TD.test(e.reason),
      aggregate: "any",
      reasonLabel: "receiving TD",
    },
  ],
  [
    "sure-hands",
    {
      cap: 2,
      match: (e) => e.type === "MALUS" && REASON_FUMBLE.test(e.reason),
      aggregate: "per-event",
      reasonLabel: "fumble compense",
    },
  ],
  [
    "safe-pair-of-hands",
    {
      cap: 2,
      match: (e) => e.type === "MALUS" && REASON_DROP.test(e.reason),
      aggregate: "per-event",
      reasonLabel: "drop compense",
    },
  ],
  [
    "block",
    {
      cap: 3,
      match: (e) => e.type === "CAS",
      aggregate: "per-event",
      reasonLabel: "CAS (block)",
    },
  ],
  [
    "dodge",
    {
      cap: 2,
      match: (e) => e.type === "DP" && REASON_INT.test(e.reason),
      aggregate: "per-event",
      reasonLabel: "INT",
    },
  ],
  [
    "tackle",
    {
      cap: 1,
      match: (e) => e.type === "DP" && REASON_FORCED_FUMBLE.test(e.reason),
      aggregate: "any",
      reasonLabel: "forced fumble",
    },
  ],
  [
    "frenzy",
    {
      cap: 1,
      match: (e) => e.type === "CAS",
      aggregate: "any",
      reasonLabel: "CAS multiple",
    },
  ],
]);

const MIGHTY_BLOW_RULE: SkillRule = {
  cap: 3,
  match: (e) => e.type === "CAS",
  aggregate: "per-event",
  reasonLabel: "CAS (mighty-blow)",
};

function resolveRule(skillSlug: string): SkillRule | null {
  const direct = SKILL_BONUS_RULES.get(skillSlug);
  if (direct) return direct;
  if (skillSlug.startsWith("mighty-blow")) return MIGHTY_BLOW_RULE;
  return null;
}

/**
 * Pour `aggregate: "per-event"` → bonus = min(events matchés, cap).
 * Pour `aggregate: "any"` → bonus = 1 si au moins 1 event matche
 * (frenzy demande un minimum de 2 CAS — règle inline).
 */
function applyRule(
  skillSlug: string,
  rule: SkillRule,
  events: readonly SppEvent[],
): SkillBonusEvent | null {
  let matched = 0;
  for (const e of events) {
    if (rule.match(e)) matched += e.count;
  }
  if (matched === 0) return null;

  if (skillSlug === "frenzy" && matched < 2) return null;

  const count = rule.aggregate === "per-event" ? Math.min(matched, rule.cap) : 1;
  return {
    skill: skillSlug,
    count,
    spp: count,
    reason: `+${count} SPP via ${skillSlug} (${rule.reasonLabel})`,
  };
}

/**
 * Calcule les bonus SPP que les skills BB du joueur ajoutent aux
 * events de scoring déjà calculés par `computeSpp()`.
 *
 * @param events Events SPP du match (issus de `NflGameStat.sppBreakdown`).
 * @param bbSkills Skills BB du joueur (`NflPlayer.bbSkills`).
 * @returns Bonus events + total SPP additionnel.
 */
export function applySkillBonuses(opts: {
  events: readonly SppEvent[];
  bbSkills: readonly string[];
}): SkillBonusResult {
  if (opts.events.length === 0 || opts.bbSkills.length === 0) {
    return { bonusEvents: [], totalBonusSpp: 0 };
  }
  const seen = new Set<string>();
  const bonusEvents: SkillBonusEvent[] = [];
  let total = 0;
  for (const skillSlug of opts.bbSkills) {
    if (seen.has(skillSlug)) continue;
    seen.add(skillSlug);
    const rule = resolveRule(skillSlug);
    if (!rule) continue;
    const bonus = applyRule(skillSlug, rule, opts.events);
    if (bonus) {
      bonusEvents.push(bonus);
      total += bonus.spp;
    }
  }
  return { bonusEvents, totalBonusSpp: total };
}

/**
 * Parser tolerant (PG natif vs sqlite serialise) pour extraire les
 * events d'un `sppBreakdown` lu en DB. Retourne `[]` si non parsable.
 */
export function parseSppEvents(raw: unknown): readonly SppEvent[] {
  if (!raw) return [];
  let candidate: unknown = raw;
  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (typeof candidate !== "object" || candidate === null) return [];
  const obj = candidate as { events?: unknown };
  if (!Array.isArray(obj.events)) return [];
  const out: SppEvent[] = [];
  for (const e of obj.events) {
    if (typeof e !== "object" || e === null) continue;
    const ev = e as Partial<SppEvent>;
    if (
      typeof ev.type === "string" &&
      typeof ev.count === "number" &&
      typeof ev.spp === "number" &&
      typeof ev.reason === "string"
    ) {
      out.push(ev as SppEvent);
    }
  }
  return out;
}

/**
 * Parser tolerant pour `bbSkills` (Json — array natif PG ou string
 * serialisee sqlite, null/undefined autorisé).
 */
export function parseBbSkills(raw: unknown): readonly string[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}
