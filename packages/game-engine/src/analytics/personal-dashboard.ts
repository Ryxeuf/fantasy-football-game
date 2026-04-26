/**
 * Personal analytics dashboard (O.10 — analytics personnel).
 *
 * Pure aggregation : caller (server) loads the user's matches from
 * Prisma and maps them into {@link PersonalMatchRecord}; this module
 * computes the dashboard summary deterministically.
 *
 * Conventions :
 *   - W/L/D and per-roster stats only count matches with status === "completed".
 *   - "totalMatches" counts every record passed in (including in-progress
 *     and cancelled), so the UI can show "5 played, 2 in progress".
 *   - winRate weights draws as 0.5 (same convention as career-stats.ts).
 */

export interface PersonalMatchRecord {
  matchId: string;
  /** Status string from the server (e.g. "completed", "in_progress", "cancelled"). */
  status: string;
  /** When the match ended; null for live/cancelled matches. */
  finishedAt: Date | null;
  /** Touchdowns scored by the user. */
  myScore: number;
  /** Touchdowns scored by the opponent. */
  oppScore: number;
  /** Roster slug used by the user (undefined when unknown). */
  myRoster: string | undefined;
  /** Roster slug used by the opponent (undefined when unknown). */
  oppRoster: string | undefined;
  /** Casualties inflicted by the user during the match. */
  casualtiesInflicted: number;
  /** Casualties suffered by the user during the match. */
  casualtiesSuffered: number;
  /** Total turns played in the match (both halves combined). */
  totalTurns: number;
}

export interface RosterUsageStat {
  roster: string;
  count: number;
  /** Win-rate (draws weighted 0.5) over completed matches with this roster. */
  winRate: number;
}

export interface PersonalDashboard {
  totalMatches: number;
  completedMatches: number;
  wins: number;
  losses: number;
  draws: number;
  /** Win-rate over completed matches; 0 when no completed matches. */
  winRate: number;
  totalTouchdownsFor: number;
  totalTouchdownsAgainst: number;
  totalCasualtiesInflicted: number;
  totalCasualtiesSuffered: number;
  /** Average turns over completed matches; 0 when none. */
  averageTurnsPerMatch: number;
  /** Per-roster usage + win-rate, sorted by count desc then name asc. */
  rosterUsage: RosterUsageStat[];
  /** Last 5 completed matches' outcomes from most recent to oldest. */
  recentForm: Array<'W' | 'L' | 'D'>;
}

const FORM_LIMIT = 5;

export function buildPersonalDashboard(
  records: ReadonlyArray<PersonalMatchRecord>,
): PersonalDashboard {
  const completed = records.filter((r) => r.status === 'completed');

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let touchdownsFor = 0;
  let touchdownsAgainst = 0;
  let casualtiesInflicted = 0;
  let casualtiesSuffered = 0;
  let totalTurns = 0;

  const rosterAcc = new Map<
    string,
    { count: number; w: number; l: number; d: number }
  >();

  for (const r of completed) {
    touchdownsFor += r.myScore;
    touchdownsAgainst += r.oppScore;
    casualtiesInflicted += r.casualtiesInflicted;
    casualtiesSuffered += r.casualtiesSuffered;
    totalTurns += r.totalTurns;

    const outcome = matchOutcome(r.myScore, r.oppScore);
    if (outcome === 'W') wins += 1;
    else if (outcome === 'L') losses += 1;
    else draws += 1;

    if (r.myRoster) {
      const slot = rosterAcc.get(r.myRoster) ?? { count: 0, w: 0, l: 0, d: 0 };
      slot.count += 1;
      if (outcome === 'W') slot.w += 1;
      else if (outcome === 'L') slot.l += 1;
      else slot.d += 1;
      rosterAcc.set(r.myRoster, slot);
    }
  }

  const winRate =
    completed.length === 0 ? 0 : (wins + draws * 0.5) / completed.length;
  const averageTurnsPerMatch =
    completed.length === 0 ? 0 : totalTurns / completed.length;

  const rosterUsage: RosterUsageStat[] = Array.from(rosterAcc.entries())
    .map(([roster, s]) => ({
      roster,
      count: s.count,
      winRate: s.count === 0 ? 0 : (s.w + s.d * 0.5) / s.count,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.roster.localeCompare(b.roster);
    });

  const recentForm = [...completed]
    .sort((a, b) => {
      const ta = a.finishedAt?.getTime() ?? 0;
      const tb = b.finishedAt?.getTime() ?? 0;
      return tb - ta;
    })
    .slice(0, FORM_LIMIT)
    .map((r) => matchOutcome(r.myScore, r.oppScore));

  return {
    totalMatches: records.length,
    completedMatches: completed.length,
    wins,
    losses,
    draws,
    winRate,
    totalTouchdownsFor: touchdownsFor,
    totalTouchdownsAgainst: touchdownsAgainst,
    totalCasualtiesInflicted: casualtiesInflicted,
    totalCasualtiesSuffered: casualtiesSuffered,
    averageTurnsPerMatch,
    rosterUsage,
    recentForm,
  };
}

function matchOutcome(myScore: number, oppScore: number): 'W' | 'L' | 'D' {
  if (myScore > oppScore) return 'W';
  if (myScore < oppScore) return 'L';
  return 'D';
}
