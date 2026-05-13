/**
 * Pro League bet leaderboard — sprint Pro League lot 1.D.8.
 *
 * Calcule un classement de parieurs sur 3 périodes :
 *  - `weekly`   : 7 derniers jours (rolling)
 *  - `season`   : depuis le début de la saison courante (in_progress
 *                 ou la plus récente completed)
 *  - `all-time` : tous les paris jamais placés
 *
 * Métriques par user :
 *  - profit (Crowns) : Σ(payoutAmount - stake) sur les bets settled
 *  - accuracy (%) : won / settled (où settled = won OR lost, void exclus)
 *  - longestStreak : plus longue série de wins consécutifs
 *  - biggestWin : max(payoutAmount - stake) parmi les bets won
 *  - betsCount : nombre total de bets sur la période
 *
 * Implémentation : on agrège côté JS (pas Prisma raw SQL) car
 * `longestStreak` exige un parcours ordonné. Pour des volumes de
 * dizaines de milliers de bets ça reste sub-seconde ; au-delà il
 * faudra matérialiser une table de stats (lot 1.F.x optimisation).
 *
 * Le coachName est exposé comme display name (déjà public via
 * `/coach/:slug`).
 */

import { prisma } from "../prisma";

export type LeaderboardPeriod = "weekly" | "season" | "all-time";

const ALLOWED_PERIODS: ReadonlySet<LeaderboardPeriod> = new Set([
  "weekly",
  "season",
  "all-time",
]);

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class LeaderboardError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "LeaderboardError";
  }
}

export interface LeaderboardEntry {
  /** Rang 1-based dans le classement renvoyé. */
  readonly rank: number;
  readonly userId: string;
  readonly coachName: string;
  readonly betsCount: number;
  readonly settledCount: number;
  readonly wonCount: number;
  /** Pourcentage 0-100, arrondi à l'entier. */
  readonly accuracy: number;
  readonly profit: number;
  readonly longestStreak: number;
  /** Plus gros gain net = max(payoutAmount - stake) sur les won. */
  readonly biggestWin: number;
}

export interface LeaderboardResult {
  readonly period: LeaderboardPeriod;
  /** Date début de la fenêtre (ISO). null pour all-time. */
  readonly fromAt: string | null;
  readonly entries: readonly LeaderboardEntry[];
  readonly limit: number;
  readonly offset: number;
}

interface BetRow {
  id: string;
  userId: string;
  stake: number;
  payoutAmount: number | null;
  status: string;
  createdAt: Date;
}

interface UserAggregate {
  userId: string;
  bets: BetRow[]; // ordered by createdAt asc
}

/**
 * Renvoie le timestamp de début de fenêtre pour la période choisie.
 * Pour `season` : startsAt de la saison courante (in_progress > la
 * plus récente completed). Pour `all-time` : null.
 */
async function resolveFromDate(
  period: LeaderboardPeriod,
  now: Date,
): Promise<Date | null> {
  if (period === "weekly") {
    return new Date(now.getTime() - WEEK_MS);
  }
  if (period === "season") {
    // Exclut les test seasons (isTest=true) — le leaderboard de paris
    // doit refleter la prod uniquement.
    const inProgress = await prisma.proLeagueSeason.findFirst({
      where: { status: "in_progress", isTest: false },
      orderBy: { year: "asc" },
      select: { startsAt: true, createdAt: true },
    });
    const season =
      inProgress ??
      (await prisma.proLeagueSeason.findFirst({
        where: { isTest: false },
        orderBy: { year: "desc" },
        select: { startsAt: true, createdAt: true },
      }));
    if (!season) return null;
    return ((season.startsAt as Date | null) ??
      (season.createdAt as Date)) as Date;
  }
  return null; // all-time
}

function computeStreakAndBiggestWin(bets: BetRow[]): {
  longestStreak: number;
  biggestWin: number;
} {
  let longest = 0;
  let current = 0;
  let biggest = 0;
  for (const b of bets) {
    if (b.status === "won") {
      current += 1;
      if (current > longest) longest = current;
      const stake = b.stake;
      const payout = b.payoutAmount ?? 0;
      const net = payout - stake;
      if (net > biggest) biggest = net;
    } else if (b.status === "lost") {
      current = 0;
    }
    // pending / void : ne reset pas le streak (le pari n'a pas
    // d'issue tranchée encore).
  }
  return { longestStreak: longest, biggestWin: biggest };
}

function aggregateUser(
  agg: UserAggregate,
  coachName: string,
): Omit<LeaderboardEntry, "rank"> {
  let betsCount = 0;
  let wonCount = 0;
  let lostCount = 0;
  let profit = 0;

  for (const b of agg.bets) {
    betsCount += 1;
    if (b.status === "won") {
      wonCount += 1;
      const payout = b.payoutAmount ?? 0;
      profit += payout - b.stake;
    } else if (b.status === "lost") {
      lostCount += 1;
      profit -= b.stake;
    }
  }
  const settledCount = wonCount + lostCount;
  const accuracy =
    settledCount > 0 ? Math.round((wonCount / settledCount) * 100) : 0;

  const { longestStreak, biggestWin } = computeStreakAndBiggestWin(agg.bets);

  return {
    userId: agg.userId,
    coachName,
    betsCount,
    settledCount,
    wonCount,
    accuracy,
    profit,
    longestStreak,
    biggestWin,
  };
}

export interface GetLeaderboardOptions {
  readonly period: LeaderboardPeriod;
  readonly limit?: number;
  readonly offset?: number;
  readonly now?: Date;
}

/**
 * Calcule + renvoie le leaderboard pour la période demandée.
 * Trié par profit desc, accuracy desc.
 */
export async function getBetLeaderboard(
  options: GetLeaderboardOptions,
): Promise<LeaderboardResult> {
  const { period } = options;
  if (!ALLOWED_PERIODS.has(period)) {
    throw new LeaderboardError(
      "INVALID_PERIOD",
      `period invalide : '${period}' (attendu : weekly / season / all-time)`,
    );
  }
  const limit = options.limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit <= 0 || limit > MAX_LIMIT) {
    throw new LeaderboardError(
      "INVALID_LIMIT",
      `limit doit être ∈ [1, ${MAX_LIMIT}] (reçu: ${limit})`,
    );
  }
  const offset = options.offset ?? 0;
  if (!Number.isInteger(offset) || offset < 0) {
    throw new LeaderboardError(
      "INVALID_OFFSET",
      `offset doit être entier ≥ 0 (reçu: ${offset})`,
    );
  }
  const now = options.now ?? new Date();
  const fromAt = await resolveFromDate(period, now);

  // Charge les bets de la période. On filtre `status` exclus de
  // 'void' (placeholder futur) — pour le MVP, void n'est pas émis.
  const bets = (await prisma.proBet.findMany({
    where: fromAt
      ? { createdAt: { gte: fromAt } }
      : {},
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      stake: true,
      payoutAmount: true,
      status: true,
      createdAt: true,
    },
  })) as BetRow[];

  if (bets.length === 0) {
    return {
      period,
      fromAt: fromAt ? fromAt.toISOString() : null,
      entries: [],
      limit,
      offset,
    };
  }

  // Group par user.
  const byUser = new Map<string, BetRow[]>();
  for (const b of bets) {
    const arr = byUser.get(b.userId) ?? [];
    arr.push(b);
    byUser.set(b.userId, arr);
  }

  // Lookup coachName (1 query batch).
  const userIds = Array.from(byUser.keys());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users = (await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, coachName: true },
  })) as { id: string; coachName: string }[];
  const coachByUser = new Map<string, string>(
    users.map((u) => [u.id, u.coachName]),
  );

  // Aggrège.
  const aggregates: Omit<LeaderboardEntry, "rank">[] = [];
  for (const [userId, userBets] of byUser.entries()) {
    const coachName = coachByUser.get(userId) ?? "Coach inconnu";
    aggregates.push(aggregateUser({ userId, bets: userBets }, coachName));
  }

  // Trie : profit desc, accuracy desc, betsCount desc (tiebreaker).
  aggregates.sort((a, b) => {
    if (b.profit !== a.profit) return b.profit - a.profit;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    return b.betsCount - a.betsCount;
  });

  // Paginate avec rang absolu (1-based depuis le début du tri global).
  const sliced = aggregates.slice(offset, offset + limit);
  const entries: LeaderboardEntry[] = sliced.map((a, i) => ({
    ...a,
    rank: offset + i + 1,
  }));

  return {
    period,
    fromAt: fromAt ? fromAt.toISOString() : null,
    entries,
    limit,
    offset,
  };
}
