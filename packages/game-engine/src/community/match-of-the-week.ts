/**
 * Match of the Week (O.9 community features).
 *
 * Pure ranking algorithm — given a list of completed match summaries,
 * picks the most engaging one of the recent window. Stays totally
 * decoupled from Prisma / HTTP : the caller is responsible for
 * fetching match summaries (server) or stubbing them (tests).
 *
 * Engagement scoring favors:
 *   - high total touchdowns (entertaining offense)
 *   - high casualty count (memorable mayhem)
 *   - close score gap (suspense > blowouts at equal TD count)
 *   - comeback flag (narrative bonus)
 *
 * Matches that are not completed receive score 0 and are filtered out
 * by `pickMatchOfTheWeek`.
 */

export interface MatchSummary {
  /** Stable match identifier (DB id, slug, …). */
  matchId: string;
  /** Match status; only "completed" matches are eligible for ranking. */
  status: string;
  /** When the match ended. Null/undefined matches are excluded from window filtering. */
  finishedAt: Date | null;
  teamAName: string;
  teamBName: string;
  /** Optional roster slugs — used downstream to colour Discord embeds, etc. */
  teamARoster?: string;
  teamBRoster?: string;
  scoreA: number;
  scoreB: number;
  /** Total number of half-turns played across both teams. */
  totalTurns: number;
  /** Total casualties inflicted (any side). */
  totalCasualties: number;
  /** True if the eventual winner trailed by 2+ TDs at some point. */
  hasComeback: boolean;
}

export interface PickMatchOptions {
  /** Reference "now" used to compute the recency window. Defaults to `new Date()`. */
  now?: Date;
  /** Window size in days. Defaults to 7. */
  windowDays?: number;
}

export interface MatchOfTheWeek {
  match: MatchSummary;
  /** Computed engagement score (>= 0). Useful for UI explanations / debug. */
  score: number;
}

const TD_WEIGHT = 3;
const CASUALTY_WEIGHT = 2;
const COMEBACK_BONUS = 5;
/**
 * Bonus for tight games. We add `CLOSE_BONUS_BASE / (1 + abs(diff))` so:
 *  - diff = 0 → +6 (e.g. 3-3)
 *  - diff = 1 → +3 (e.g. 2-1)
 *  - diff = 2 → +2
 *  - diff = 6 → +0.85 (blowout)
 */
const CLOSE_BONUS_BASE = 6;

const DEFAULT_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Compute the engagement score for a single match. Pure, deterministic.
 *
 * Returns 0 for any non-completed match — callers can also rely on
 * {@link pickMatchOfTheWeek} which filters those out anyway.
 */
export function scoreMatchEngagement(match: MatchSummary): number {
  if (match.status !== 'completed') return 0;

  const totalTd = Math.max(0, match.scoreA) + Math.max(0, match.scoreB);
  const cas = Math.max(0, match.totalCasualties);
  const diff = Math.abs(match.scoreA - match.scoreB);

  const tdScore = totalTd * TD_WEIGHT;
  const casScore = cas * CASUALTY_WEIGHT;
  const closeBonus = CLOSE_BONUS_BASE / (1 + diff);
  const comebackBonus = match.hasComeback ? COMEBACK_BONUS : 0;

  return tdScore + casScore + closeBonus + comebackBonus;
}

/**
 * Select the most engaging match in the recent window.
 *
 * Selection rules:
 *   1. Match must have status === "completed".
 *   2. Match must have `finishedAt` within the last `windowDays` (default 7).
 *   3. Highest engagement score wins.
 *   4. Tie-breaker: most recent `finishedAt`.
 *
 * Returns `null` if no candidate remains.
 */
export function pickMatchOfTheWeek(
  matches: ReadonlyArray<MatchSummary>,
  options: PickMatchOptions = {},
): MatchOfTheWeek | null {
  const now = options.now ?? new Date();
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const windowMs = windowDays * MS_PER_DAY;
  const minTimestamp = now.getTime() - windowMs;

  let best: MatchOfTheWeek | null = null;

  for (const match of matches) {
    if (match.status !== 'completed') continue;
    if (!match.finishedAt) continue;
    const finishedTs = match.finishedAt.getTime();
    if (finishedTs < minTimestamp) continue;
    if (finishedTs > now.getTime()) continue; // future-dated — ignore

    const score = scoreMatchEngagement(match);
    if (!best) {
      best = { match, score };
      continue;
    }
    if (score > best.score) {
      best = { match, score };
    } else if (score === best.score) {
      // Tie-breaker: most recent.
      const bestTs = best.match.finishedAt?.getTime() ?? 0;
      if (finishedTs > bestTs) {
        best = { match, score };
      }
    }
  }

  return best;
}
