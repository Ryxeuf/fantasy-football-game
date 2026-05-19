/**
 * Pro League badges — sprint Pro League lot 1.D.9.
 *
 * Catalogue static (en code) + évaluation des criteria + persistance
 * des badges débloqués dans `ProUserBadge`.
 *
 * Criteria MVP (cf. sprint table 1.D.9) :
 *  - `oracle_of_nuffle` : 10 paris settled gagnants consécutifs
 *  - `blood_reader` : ≥10 bets `CAS_COUNT` settled, accuracy ≥ 90%
 *  - `underdog_whisperer` : 5 bets won avec oddsAtPlace ≥ 5.0
 *  - `first_kickoff` : 1er pari placé (toutes périodes)
 *  - `loyal_fan` : suivre une équipe depuis ≥ 30 jours
 *
 * `profit_king` (top 1% saison) est différé — nécessite une logique
 * cross-user qui peut être ajoutée en sweep séparé.
 */

import { prisma } from "../prisma";

export interface BadgeDefinition {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly emoji: string;
}

export const BADGE_CATALOGUE: readonly BadgeDefinition[] = Object.freeze([
  {
    code: "first_kickoff",
    name: "First Kickoff",
    description: "Premier pari placé — bienvenue dans l'arène.",
    emoji: "🥇",
  },
  {
    code: "oracle_of_nuffle",
    name: "Oracle of Nuffle",
    description: "10 paris gagnants consécutifs.",
    emoji: "🔮",
  },
  {
    code: "blood_reader",
    name: "Blood Reader",
    description: "90%+ d'accuracy sur les paris violents (≥10 paris).",
    emoji: "🩸",
  },
  {
    code: "underdog_whisperer",
    name: "Underdog Whisperer",
    description: "5 paris gagnés à cote ≥ 5.0.",
    emoji: "🐺",
  },
  {
    code: "loyal_fan",
    name: "Loyal Fan",
    description: "Suivre une équipe depuis 30 jours ou plus.",
    emoji: "🎽",
  },
] as const);

const BADGE_BY_CODE: Map<string, BadgeDefinition> = new Map(
  BADGE_CATALOGUE.map((b) => [b.code, b]),
);

const STREAK_THRESHOLD = 10;
const BLOOD_READER_MIN_BETS = 10;
const BLOOD_READER_MIN_ACCURACY = 0.9;
const UNDERDOG_MIN_WINS = 5;
const UNDERDOG_MIN_ODDS = 5.0;
const LOYAL_FAN_MIN_DAYS = 30;
const LOYAL_FAN_MIN_MS = LOYAL_FAN_MIN_DAYS * 24 * 60 * 60 * 1000;

export interface UserBadgeEntry {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly emoji: string;
  readonly earnedAt: string;
}

/**
 * Charge les badges déjà débloqués par un user.
 */
export async function listUserBadges(
  userId: string,
): Promise<UserBadgeEntry[]> {
  const rows = await prisma.proUserBadge.findMany({
    where: { userId },
    orderBy: { earnedAt: "desc" },
    select: { badgeCode: true, earnedAt: true },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows
    .map((r: any) => {
      const def = BADGE_BY_CODE.get(r.badgeCode as string);
      if (!def) return null; // catalogue désynchro — ignore
      return {
        code: def.code,
        name: def.name,
        description: def.description,
        emoji: def.emoji,
        earnedAt: (r.earnedAt as Date).toISOString(),
      } satisfies UserBadgeEntry;
    })
    .filter((x: UserBadgeEntry | null): x is UserBadgeEntry => x !== null);
}

/**
 * Évalue tous les criteria pour un user et débloque les nouveaux
 * badges (idempotent via `@@unique([userId, badgeCode])`).
 *
 * Renvoie la liste des codes débloqués dans cet appel (vide si rien).
 */
export async function evaluateBadgesForUser(
  userId: string,
  now: Date = new Date(),
): Promise<string[]> {
  const existing = await prisma.proUserBadge.findMany({
    where: { userId },
    select: { badgeCode: true },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const earned = new Set<string>(
    existing.map((e: any) => e.badgeCode as string),
  );

  const newlyEarned: string[] = [];

  // BUG fix audit round 8 (HIGH/DoS) : avant, `findMany` sans `take`.
  // Un high-volume bettor avec des dizaines de milliers de bets
  // declenchait `evaluateBadgesForUser` sur chaque write post-
  // settlement → memoire lineaire + DoS surface. Cap a 5000 bets
  // (largement plus que ce qu'un user normal accumule). Les criteria
  // de streaks / count utilisent les `bets` plus recents, donc cap
  // au plus recent. Documented limit ; criteria-specifique pourrait
  // overrider si necessaire.
  const BADGE_EVAL_BET_LIMIT = 5000;
  const bets = await prisma.proBet.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: BADGE_EVAL_BET_LIMIT,
    select: {
      id: true,
      stake: true,
      payoutAmount: true,
      oddsAtPlace: true,
      status: true,
      createdAt: true,
      market: { select: { type: true } },
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safeBets = bets as Array<{
    id: string;
    stake: number;
    payoutAmount: number | null;
    oddsAtPlace: number;
    status: string;
    createdAt: Date;
    market: { type: string };
  }>;

  // first_kickoff : ≥1 pari.
  if (!earned.has("first_kickoff") && safeBets.length >= 1) {
    newlyEarned.push("first_kickoff");
  }

  // oracle_of_nuffle : streak ≥ 10 wins consécutifs sur settled.
  if (!earned.has("oracle_of_nuffle")) {
    let current = 0;
    let max = 0;
    for (const b of safeBets) {
      if (b.status === "won") {
        current += 1;
        if (current > max) max = current;
      } else if (b.status === "lost") {
        current = 0;
      }
    }
    if (max >= STREAK_THRESHOLD) newlyEarned.push("oracle_of_nuffle");
  }

  // blood_reader : ≥10 bets CAS_COUNT settled, accuracy ≥ 90%.
  if (!earned.has("blood_reader")) {
    let won = 0;
    let lost = 0;
    for (const b of safeBets) {
      if (b.market.type !== "CAS_COUNT") continue;
      if (b.status === "won") won += 1;
      else if (b.status === "lost") lost += 1;
    }
    const settled = won + lost;
    if (
      settled >= BLOOD_READER_MIN_BETS &&
      won / settled >= BLOOD_READER_MIN_ACCURACY
    ) {
      newlyEarned.push("blood_reader");
    }
  }

  // underdog_whisperer : 5 bets won avec oddsAtPlace ≥ 5.0.
  if (!earned.has("underdog_whisperer")) {
    let count = 0;
    for (const b of safeBets) {
      if (b.status === "won" && b.oddsAtPlace >= UNDERDOG_MIN_ODDS) {
        count += 1;
      }
    }
    if (count >= UNDERDOG_MIN_WINS) newlyEarned.push("underdog_whisperer");
  }

  // loyal_fan : suivre une équipe depuis ≥ 30 jours.
  if (!earned.has("loyal_fan")) {
    const oldestFollow = await prisma.proSpectatorFollow.findFirst({
      where: { userId },
      orderBy: { since: "asc" },
      select: { since: true },
    });
    if (oldestFollow) {
      const since = oldestFollow.since as Date;
      if (now.getTime() - since.getTime() >= LOYAL_FAN_MIN_MS) {
        newlyEarned.push("loyal_fan");
      }
    }
  }

  if (newlyEarned.length === 0) return [];

  // Persiste atomique. Si une row existe déjà (race condition entre 2
  // évaluations concurrentes), on `createMany skipDuplicates: true`.
  await prisma.proUserBadge.createMany({
    data: newlyEarned.map((code) => ({ userId, badgeCode: code })),
    skipDuplicates: true,
  });

  return newlyEarned;
}

/**
 * Renvoie tous les badges du catalogue + statut earned/not.
 */
export interface BadgeStatus {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly emoji: string;
  readonly earned: boolean;
  readonly earnedAt: string | null;
}

export async function getCatalogueWithStatus(
  userId: string,
): Promise<BadgeStatus[]> {
  const rows = await prisma.proUserBadge.findMany({
    where: { userId },
    select: { badgeCode: true, earnedAt: true },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const earnedMap = new Map<string, Date>(
    rows.map((r: any) => [r.badgeCode as string, r.earnedAt as Date]),
  );
  return BADGE_CATALOGUE.map((def) => {
    const at = earnedMap.get(def.code);
    return {
      code: def.code,
      name: def.name,
      description: def.description,
      emoji: def.emoji,
      earned: at !== undefined,
      earnedAt: at ? at.toISOString() : null,
    } satisfies BadgeStatus;
  });
}
