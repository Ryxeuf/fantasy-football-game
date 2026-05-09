/**
 * Service level-up / progression skill (Lot 3.C.4).
 *
 * Apres que le SPP service (Lot 3.C.2) ait crediter les Star Player
 * Points sur les rosters, on calcule le `level` attendu via la table
 * BB officielle (6/16/31/51/76/176 SPP cumulatifs) et on ajoute le
 * nombre d'advancements manquants. Pour le MVP, chaque level-up =
 * 1 skill aleatoire deterministe depuis le pool "general" BB.
 *
 * Architecture
 * ------------
 *  - `levelForSpp(spp)` : pure, table -> level.
 *  - `pickAdvancement(skills, seed)` : pure, choisit un skill non
 *    deja connu via mulberry32 + le pool general.
 *  - `applyLevelUps(rosterId)` : I/O, applique tous les level-ups
 *    manquants en un seul UPDATE. Idempotent : si le level est deja
 *    a jour, no-op.
 *  - `sweepLevelUps()` cron : sweep tous les rosters actifs
 *    (limit 200) et applique. Erreur par roster isolee.
 *
 * Hors scope MVP
 * --------------
 *  - Stat increases (doubles roll). BB autorise +1 MA/AG/PA/AV sur un
 *    double — ignore ici, advancement = skill seulement.
 *  - Pool S/A/P/M (strength, agility, passing, mutation). Pour le MVP
 *    on tape uniquement le pool General. Lot futur : restreindre aux
 *    skills accessibles a la `position` du joueur.
 *  - Coach choice : en BB IRL, le coach choisit le skill ; ici tout
 *    est aleatoire deterministe (cohereent avec la simulation auto).
 */

import { prisma } from "../prisma";

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

export type LevelUpSkipReason =
  | "level_up_to_date"
  | "inactive_roster"
  | "no_skill_available";

export interface ApplyLevelUpsResult {
  readonly rosterId: string;
  readonly skipped: boolean;
  readonly skipReason: LevelUpSkipReason | null;
  readonly oldLevel: number;
  readonly newLevel: number;
  readonly advancements: readonly string[];
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
  const advancements: string[] = [];
  let currentLevel = oldLevel;
  for (let l = oldLevel + 1; l <= targetLevel; l += 1) {
    // Variation par level pour eviter qu'un meme rosterId pioche
    // plusieurs fois le meme skill quand on grimpe de plusieurs
    // niveaux d'un coup.
    const seed = (baseSeed ^ (l * 0x9e3779b9)) >>> 0;
    const skill = pickAdvancement([...skills, ...advancements], seed);
    if (!skill) break;
    advancements.push(skill);
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

  const newSkills = [...skills, ...advancements];
  await prisma.proTeamRoster.update({
    where: { id: rosterId },
    data: {
      level: currentLevel,
      skills: newSkills,
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
