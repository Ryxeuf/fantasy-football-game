/**
 * Service level-up / progression skill (Lot 3.C.4 + 4.D.1).
 *
 * Apres que le SPP service (Lot 3.C.2) ait crediter les Star Player
 * Points sur les rosters, on calcule le `level` attendu via la table
 * BB officielle (6/16/31/51/76/176 SPP cumulatifs) et on ajoute le
 * nombre d'advancements manquants. Chaque level-up :
 *
 *   - Lot 3.C.4 (skill) : 5/6 chance -> tirage du pool General
 *     (deterministe via hash(rosterId) + offset par level).
 *   - Lot 4.D.1 (stat) : 1/6 chance -> "double" BB (+1 sur une stat
 *     pondere : MA/PA majoritaires, AG/AV moyen, ST rare).
 *
 * Le 1/6 reproduit la proba BB officielle d'un double sur 2D6 (chaque
 * paire xx a 1/36 -> 6 paires possibles -> 6/36 = 1/6).
 *
 * Architecture
 * ------------
 *  - `levelForSpp(spp)` : pure, table -> level.
 *  - `pickAdvancement(skills, seed)` : pure, choisit un skill General
 *    non encore connu.
 *  - `pickStatIncrease(seed)` : pure, choisit une stat parmi MA/AG/PA/AV/ST.
 *  - `rollStatVsSkill(seed)` : pure, true si "double" (1/6).
 *  - `applyLevelUps(rosterId)` : I/O, applique tous les level-ups
 *    manquants en un seul UPDATE. Idempotent.
 *  - `sweepLevelUps()` cron : sweep rosters actifs avec spp>0.
 *
 * Hors scope
 * ----------
 *  - Pool S/A/P/M par position (Lot 4.D.2 a venir). Pour le moment,
 *    seul General est utilise pour les skills.
 *  - Coach choice : en BB IRL, le coach choisit ; ici tout est
 *    aleatoire deterministe (coherent avec auto-play).
 *  - Stat caps : un Lineman peut theoriquement gagner +5 MA pour
 *    aller de 6 a 11. BB officiel limite +2 par stat. Lot futur si
 *    besoin (rare en MVP).
 */

import { prisma } from "../prisma";
import { computePlayerTv, type StatBonuses } from "./pro-roster-tv";

/**
 * Seuils SPP cumulatifs pour atteindre les niveaux 2..7. Index `i`
 * correspond au seuil pour passer level `i+2` (exemple : index 0 = 6
 * SPP -> level 2).
 *
 * Source : Blood Bowl (Season 2/3) Star Player Points table.
 */
export const SPP_LEVEL_THRESHOLDS: readonly number[] = [
  6, 16, 31, 51, 76, 176,
] as const;

/**
 * Pool de skills "General" BB officiels. MVP : on ne distingue pas
 * encore par position (tous les rosters tirent dans ce pool unique).
 * Lot futur : tableau par position avec G/A/S/P/M.
 *
 * Slugs alignes sur la registry game-engine (lowercase, no space).
 */
export const GENERAL_SKILL_POOL: readonly string[] = [
  "block",
  "dauntless",
  "dirty_player",
  "fend",
  "frenzy",
  "kick",
  "pro",
  "shadowing",
  "strip_ball",
  "sure_hands",
  "tackle",
  "wrestle",
] as const;

export type LevelUpErrorCode =
  | "ROSTER_NOT_FOUND"
  | "INVALID_SKILLS_JSON";

export class LevelUpError extends Error {
  constructor(
    public readonly code: LevelUpErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LevelUpError";
  }
}

/** Calcule le niveau attendu (1..7) depuis le total SPP cumule. */
export function levelForSpp(spp: number): number {
  if (!Number.isFinite(spp) || spp < 0) return 1;
  let level = 1;
  for (const threshold of SPP_LEVEL_THRESHOLDS) {
    if (spp >= threshold) level += 1;
    else break;
  }
  return level;
}

/** PRNG seede deterministe (mulberry32). Identique a SPP service. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash naïf d'une string vers un u32 (sert a transformer rosterId en seed). */
function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/**
 * Choisit un skill du pool general que le roster ne connait pas encore.
 * Retourne `null` si toutes les skills du pool sont deja prises.
 *
 * Deterministe : meme `(skills, seed)` -> meme pick.
 */
export function pickAdvancement(
  skills: readonly string[],
  seed: number,
): string | null {
  const known = new Set(skills);
  const available = GENERAL_SKILL_POOL.filter((s) => !known.has(s));
  if (available.length === 0) return null;
  const rng = mulberry32(seed);
  const idx = Math.floor(rng() * available.length);
  return available[idx] ?? null;
}

/**
 * Lot 4.D.1 — pool de stat increases ponderes pour le pick aleatoire.
 *
 * Distribution choisie pour eviter une avalanche de +ST (BB tres
 * puissant) tout en gardant l'option presente. MA/PA dominent (catchers,
 * throwers), AG/AV moyens, ST rare.
 */
export type StatIncreaseKind = "ma" | "ag" | "pa" | "av" | "st";

const STAT_INCREASE_WEIGHTS: ReadonlyArray<readonly [StatIncreaseKind, number]> = [
  ["ma", 5],
  ["pa", 5],
  ["ag", 4],
  ["av", 4],
  ["st", 2],
];

/**
 * Choisit une stat increase ponderee par STAT_INCREASE_WEIGHTS.
 * Deterministe via le seed.
 */
export function pickStatIncrease(seed: number): StatIncreaseKind {
  const rng = mulberry32(seed);
  let total = 0;
  for (const [, w] of STAT_INCREASE_WEIGHTS) total += w;
  const target = rng() * total;
  let cumulative = 0;
  for (const [stat, w] of STAT_INCREASE_WEIGHTS) {
    cumulative += w;
    if (target < cumulative) return stat;
  }
  // Edge case rounding : retombe sur la derniere.
  return STAT_INCREASE_WEIGHTS[STAT_INCREASE_WEIGHTS.length - 1][0];
}

/**
 * Lot 4.D.1 — `true` si l'advancement roll est un "double" (1/6
 * proba). En BB rules, un double sur 2D6 ouvre l'option stat increase
 * au lieu d'un skill primary/secondary.
 */
export function rollStatVsSkill(seed: number): boolean {
  const rng = mulberry32(seed);
  return rng() < 1 / 6;
}

export type LevelUpSkipReason =
  | "level_up_to_date"
  | "inactive_roster"
  | "no_skill_available";

/**
 * Lot 4.D.1 — un advancement applique au level-up est soit un skill
 * du pool General (90.83%) soit un stat increase (16.67% via doubles
 * roll, fallback skill si le pool est vide). Le retour est une union
 * discriminee pour que le caller puisse logger / afficher precisement
 * ce qui a ete distribue.
 */
export type Advancement =
  | { readonly kind: "skill"; readonly skill: string }
  | { readonly kind: "stat"; readonly stat: StatIncreaseKind };

export interface ApplyLevelUpsResult {
  readonly rosterId: string;
  readonly skipped: boolean;
  readonly skipReason: LevelUpSkipReason | null;
  readonly oldLevel: number;
  readonly newLevel: number;
  readonly advancements: readonly Advancement[];
}

/**
 * Lit `skills` JSON (Postgres = Json natif, SQLite = string serialisee
 * via le mirror). Tente de parse en array string ; sinon retourne []
 * (defense-in-depth).
 */
function parseSkillsJson(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((s: unknown): s is string => typeof s === "string");
      }
    } catch {
      // ignore
    }
  }
  return [];
}

/**
 * Applique les level-ups en attente sur un roster. Idempotent :
 *   - level deja >= levelForSpp(spp) -> skip 'level_up_to_date'
 *   - status != 'active' -> skip 'inactive_roster'
 *   - pool epuise -> skip 'no_skill_available' (level non bumpe)
 *
 * Sinon : append les skills manquants (deterministe via hash(rosterId)
 * + offset par level), update level + skills en une seule mutation.
 */
export async function applyLevelUps(
  rosterId: string,
): Promise<ApplyLevelUpsResult> {
  const roster = await prisma.proTeamRoster.findUnique({
    where: { id: rosterId },
    select: {
      id: true,
      spp: true,
      level: true,
      skills: true,
      status: true,
      // Lot 3.C.5 — position lue pour recompute tvCached inline.
      position: true,
      // Lot 4.D.1 — stat bonuses lus pour appliquer leur cost dans
      // le tvCached recompute. Prisma `increment` accumule ensuite.
      maBonus: true,
      agBonus: true,
      paBonus: true,
      avBonus: true,
      stBonus: true,
      // Lot 4.D.3 — niggling lu pour appliquer le malus -10k/niggling
      // dans le tvCached recompute.
      niggling: true,
    },
  });
  if (!roster) {
    throw new LevelUpError(
      "ROSTER_NOT_FOUND",
      `ProTeamRoster '${rosterId}' introuvable`,
    );
  }

  const oldLevel = (roster.level as number) ?? 1;

  if ((roster.status as string) !== "active") {
    return {
      rosterId,
      skipped: true,
      skipReason: "inactive_roster",
      oldLevel,
      newLevel: oldLevel,
      advancements: [],
    };
  }

  const targetLevel = levelForSpp((roster.spp as number) ?? 0);
  if (targetLevel <= oldLevel) {
    return {
      rosterId,
      skipped: true,
      skipReason: "level_up_to_date",
      oldLevel,
      newLevel: oldLevel,
      advancements: [],
    };
  }

  const skills = parseSkillsJson(roster.skills);
  const baseSeed = hashStringToInt(rosterId);
  const advancements: Advancement[] = [];
  // Stats accumules pour l'UPDATE final (incremente sur chaque "double").
  const accruedStats: { ma: number; ag: number; pa: number; av: number; st: number } = {
    ma: 0,
    ag: 0,
    pa: 0,
    av: 0,
    st: 0,
  };
  // Skills accumulees (pour eviter dupes inter-level si plusieurs
  // levels grimpes d'un coup).
  const newSkillsAcc: string[] = [];
  let currentLevel = oldLevel;
  for (let l = oldLevel + 1; l <= targetLevel; l += 1) {
    // Variation par level pour eviter qu'un meme rosterId pioche
    // plusieurs fois le meme skill quand on grimpe de plusieurs
    // niveaux d'un coup.
    const seedSkill = (baseSeed ^ (l * 0x9e3779b9)) >>> 0;
    // Lot 4.D.1 — seed independant pour le check skill/stat (eviter
    // que le meme seed conditionne a la fois le pick skill ET la
    // decision stat).
    const seedRollKind = (baseSeed ^ (l * 0x85ebca6b)) >>> 0;
    const seedStat = (baseSeed ^ (l * 0xc2b2ae35)) >>> 0;

    if (rollStatVsSkill(seedRollKind)) {
      const stat = pickStatIncrease(seedStat);
      accruedStats[stat] += 1;
      advancements.push({ kind: "stat", stat });
      currentLevel = l;
      continue;
    }

    const skill = pickAdvancement([...skills, ...newSkillsAcc], seedSkill);
    if (!skill) {
      // Pool epuise sur ce level. On stoppe la progression (les
      // levels suivants seront tente au prochain tick une fois que
      // le pool aura grandit — peu probable, mais defensif).
      break;
    }
    newSkillsAcc.push(skill);
    advancements.push({ kind: "skill", skill });
    currentLevel = l;
  }

  if (advancements.length === 0) {
    return {
      rosterId,
      skipped: true,
      skipReason: "no_skill_available",
      oldLevel,
      newLevel: oldLevel,
      advancements: [],
    };
  }

  const newSkills = [...skills, ...newSkillsAcc];
  // Lot 3.C.5 + 4.D.1 + 4.D.3 — recompute TV inline avec stat bonuses
  // accumules dans la session de level-up + ceux deja persistes +
  // malus niggling courant (le casualty applier peut avoir incremente
  // niggling avant le tick level-up).
  const totalStatBonuses: StatBonuses = {
    ma: ((roster.maBonus as number) ?? 0) + accruedStats.ma,
    ag: ((roster.agBonus as number) ?? 0) + accruedStats.ag,
    pa: ((roster.paBonus as number) ?? 0) + accruedStats.pa,
    av: ((roster.avBonus as number) ?? 0) + accruedStats.av,
    st: ((roster.stBonus as number) ?? 0) + accruedStats.st,
  };
  const newTvCached = computePlayerTv(
    (roster.position as string) ?? "",
    newSkills.length,
    (roster.niggling as number) ?? 0,
    totalStatBonuses,
  );
  await prisma.proTeamRoster.update({
    where: { id: rosterId },
    data: {
      level: currentLevel,
      skills: newSkills,
      tvCached: newTvCached,
      // Lot 4.D.1 — Prisma `increment` evite les race conditions
      // (un casualty applier qui tournerait en parallele ne casse
      // pas la valeur).
      maBonus: { increment: accruedStats.ma },
      agBonus: { increment: accruedStats.ag },
      paBonus: { increment: accruedStats.pa },
      avBonus: { increment: accruedStats.av },
      stBonus: { increment: accruedStats.st },
    },
  });

  return {
    rosterId,
    skipped: false,
    skipReason: null,
    oldLevel,
    newLevel: currentLevel,
    advancements,
  };
}

/**
 * Cron sweep : tous les rosters `active` avec SPP > 0. Limit 200
 * pour borner la latence du tick. Erreurs isolees par roster.
 *
 * Note perf : avec 16 teams * 16 rosters = 256 rosters, on est juste
 * sur le seuil. Si la League s'agrandit, augmenter LIMIT ou paginer.
 */
export async function sweepLevelUps(): Promise<{
  inspected: number;
  processed: number;
  failed: number;
}> {
  const candidates = await prisma.proTeamRoster.findMany({
    where: { status: "active", spp: { gt: 0 } },
    select: { id: true },
    take: 200,
  });
  let processed = 0;
  let failed = 0;
  for (const { id } of candidates) {
    try {
      const out = await applyLevelUps(id as string);
      if (!out.skipped) processed += 1;
    } catch {
      failed += 1;
    }
  }
  return { inspected: candidates.length, processed, failed };
}
