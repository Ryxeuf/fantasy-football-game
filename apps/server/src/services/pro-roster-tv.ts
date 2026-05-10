/**
 * Service Team Value individuelle (Lot 3.C.5).
 *
 * Calcule le `tvCached` d'un `ProTeamRoster` a partir de :
 *   - sa position (cost de base via la table `BASE_POSITION_COST`)
 *   - le nombre de skills accumules (chacun ajoute `SKILL_COST`)
 *
 * Limitations MVP
 * ---------------
 * - Pas de distinction primary / secondary skill (BB-rules: 20k vs 30k).
 *   On applique 20k a tous (pool General du level-up applier).
 * - Pas de stat increases (BB6 doubles : +1 MA/AG/PA/AV = 30-50k).
 *   Out of scope tant que le level-up applier ne distribue que des
 *   skills.
 * - Pas de niggling injuries malus (BB applique -10k par niggling).
 *   Out of scope MVP.
 *
 * Architecture
 * ------------
 * - `computePlayerTv(position, skillCount)` : pure, formule simple.
 * - `recomputePlayerTv(rosterId)` : I/O, recompute + UPDATE
 *   transactionnel idempotent.
 * - `sweepRecomputeTvs()` : cron, status='active', limit 200.
 *
 * Wire-up
 * -------
 * Le level-up applier (Lot 3.C.4) inline le `tvCached` dans son
 * UPDATE pour eviter une 2eme query DB par level-up. Ce service est
 * pour les operations one-shot (backfill apres migration, recompute
 * manuel via admin route).
 */

import { prisma } from "../prisma";

/**
 * Costs canoniques BB rookies (gold pieces). Sources : Blood Bowl
 * Season 2/3 starter rosters. Toutes les positions courantes du
 * pro-roster-generator + queqlues forward-compat (Catcher, Blitzer,
 * Thrower) pour l'arrivee de rosters non-Lineman uniformes.
 */
export const BASE_POSITION_COST: Record<string, number> = {
  // Linemen-equivalents (humains, orcs, etc.)
  Lineman: 50_000,
  Linewoman: 50_000,
  // Undead specifics
  Zombie: 40_000,
  Skeleton: 40_000,
  // Lizardmen specifics
  Skink: 60_000,
  Saurus: 80_000,
  // Big Guys (Troll, Ogre, Minotaur, Treeman, Mummy, etc.)
  "Big Guy": 140_000,
  // Forward-compat positions standard
  Blitzer: 90_000,
  Thrower: 70_000,
  Catcher: 60_000,
  Runner: 80_000,
  Blocker: 80_000,
};

/** Cost par defaut pour une position non listee (Lineman generique). */
export const DEFAULT_POSITION_COST = 50_000;

/**
 * Cost d'un skill General (BB rules : 20k pour primary, 30k pour
 * secondary). Le level-up applier de 3.C.4 ne distribue que General,
 * donc 20k flat est correct ici.
 */
export const SKILL_COST = 20_000;

/**
 * Lot 4.D.1 — costs BB officiels par +1 stat increase.
 * Source : Blood Bowl Season 2/3 advancements table.
 */
export const STAT_INCREASE_COSTS = {
  ma: 30_000,
  ag: 40_000,
  pa: 20_000,
  av: 30_000,
  st: 80_000,
} as const;

/** Bonus stats accumules via doubles roll au level-up. */
export interface StatBonuses {
  readonly ma?: number;
  readonly ag?: number;
  readonly pa?: number;
  readonly av?: number;
  readonly st?: number;
}

function safeBonus(n: number | undefined): number {
  return Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0;
}

/** Cost total des stat bonuses appliques sur un roster. */
export function computeStatBonusCost(bonuses: StatBonuses): number {
  return (
    safeBonus(bonuses.ma) * STAT_INCREASE_COSTS.ma +
    safeBonus(bonuses.ag) * STAT_INCREASE_COSTS.ag +
    safeBonus(bonuses.pa) * STAT_INCREASE_COSTS.pa +
    safeBonus(bonuses.av) * STAT_INCREASE_COSTS.av +
    safeBonus(bonuses.st) * STAT_INCREASE_COSTS.st
  );
}

/**
 * Lot 4.D.3 — malus par niggling injury (BB rules : -10k TV par
 * niggling pour le matchmaking). Le joueur reste actif mais "fragile"
 * et compte moins dans le TV total. Le casualty applier (Lot 3.C.1)
 * incremente `ProTeamRoster.niggling` lors d'une injury "niggling"
 * post-match ; `recomputePlayerTv` doit lire ce compteur pour
 * reconciler la TV.
 */
export const NIGGLING_MALUS = 10_000;

export type RecomputeTvErrorCode = "ROSTER_NOT_FOUND";

export class RecomputeTvError extends Error {
  constructor(
    public readonly code: RecomputeTvErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RecomputeTvError";
  }
}

/**
 * Pure : calcule la TV individuelle a partir de la position, du nombre
 * de skills, du nombre de niggling injuries, et des stat bonuses.
 *
 * Formule : `base + skills * SKILL_COST + sum(statBonuses * STAT_COSTS)
 *           - niggling * NIGGLING_MALUS`.
 *
 * Tous les arguments numeriques negatifs sont traites comme 0
 * (defense-in-depth). Le total est clampe a 0 (un joueur ne peut
 * jamais avoir une TV negative).
 *
 * Lot 4.D.1 — stat bonuses ajoutes.
 * Lot 4.D.3 — niggling malus ajoute.
 */
export function computePlayerTv(
  position: string,
  skillCount: number,
  niggling: number = 0,
  statBonuses: StatBonuses = {},
): number {
  const base = BASE_POSITION_COST[position] ?? DEFAULT_POSITION_COST;
  const safeSkills =
    Number.isFinite(skillCount) && skillCount > 0 ? skillCount : 0;
  const safeNiggling =
    Number.isFinite(niggling) && niggling > 0 ? niggling : 0;
  const tv =
    base +
    safeSkills * SKILL_COST +
    computeStatBonusCost(statBonuses) -
    safeNiggling * NIGGLING_MALUS;
  return tv > 0 ? tv : 0;
}

/**
 * Lit `skills` JSON. Postgres expose le array natif ; SQLite le
 * mirror le serialise en string. Defense-in-depth : tout autre
 * format -> [].
 */
function parseSkillsJson(raw: unknown): readonly string[] {
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

export type RecomputeTvSkipReason = "up_to_date";

export interface RecomputePlayerTvResult {
  readonly rosterId: string;
  readonly skipped: boolean;
  readonly skipReason: RecomputeTvSkipReason | null;
  readonly oldTv: number;
  readonly newTv: number;
}

/**
 * I/O : recompute + UPDATE idempotent. Si `tvCached` deja a jour, no-op.
 */
export async function recomputePlayerTv(
  rosterId: string,
): Promise<RecomputePlayerTvResult> {
  const roster = await prisma.proTeamRoster.findUnique({
    where: { id: rosterId },
    select: {
      id: true,
      position: true,
      skills: true,
      tvCached: true,
      // Lot 4.D.1 — stat bonuses lus pour appliquer leur cost dans tvCached.
      maBonus: true,
      agBonus: true,
      paBonus: true,
      avBonus: true,
      stBonus: true,
      // Lot 4.D.3 — niggling lu pour appliquer le malus -10k/niggling.
      niggling: true,
    },
  });
  if (!roster) {
    throw new RecomputeTvError(
      "ROSTER_NOT_FOUND",
      `ProTeamRoster '${rosterId}' introuvable`,
    );
  }

  const skills = parseSkillsJson(roster.skills);
  const newTv = computePlayerTv(
    roster.position as string,
    skills.length,
    (roster.niggling as number) ?? 0,
    {
      ma: (roster.maBonus as number) ?? 0,
      ag: (roster.agBonus as number) ?? 0,
      pa: (roster.paBonus as number) ?? 0,
      av: (roster.avBonus as number) ?? 0,
      st: (roster.stBonus as number) ?? 0,
    },
  );
  const oldTv = (roster.tvCached as number) ?? 0;

  if (newTv === oldTv) {
    return {
      rosterId,
      skipped: true,
      skipReason: "up_to_date",
      oldTv,
      newTv,
    };
  }

  await prisma.proTeamRoster.update({
    where: { id: rosterId },
    data: { tvCached: newTv },
  });

  return {
    rosterId,
    skipped: false,
    skipReason: null,
    oldTv,
    newTv,
  };
}

/**
 * Cron sweep : recompute tous les rosters actifs. Limit 200, erreur
 * isolee. Sert au backfill apres la migration `20260511_add_roster_tv_cached`
 * et a corriger les drifts ulterieurs.
 */
export async function sweepRecomputeTvs(): Promise<{
  inspected: number;
  processed: number;
  failed: number;
}> {
  const candidates = await prisma.proTeamRoster.findMany({
    where: { status: "active" },
    select: { id: true },
    take: 200,
  });
  let processed = 0;
  let failed = 0;
  for (const { id } of candidates) {
    try {
      const out = await recomputePlayerTv(id as string);
      if (!out.skipped) processed += 1;
    } catch {
      failed += 1;
    }
  }
  return { inspected: candidates.length, processed, failed };
}
