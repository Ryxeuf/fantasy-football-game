/**
 * Global analytics dashboard (O.10 — analytics global).
 *
 * Pure aggregation : caller (server) loads platform-wide matches from
 * Prisma and maps them into {@link GlobalMatchRecord}; this module
 * computes the global dashboard summary deterministically.
 *
 * Conventions :
 *   - touchdown / casualty totals only sum completed matches
 *   - rosterPopularity counts both sides ; in-progress matches are
 *     ignored entirely (no roster pick, no win-rate)
 *   - winRate per roster weights draws as 0.5 (same convention as
 *     personal-dashboard / career-stats)
 */

export interface GlobalMatchRecord {
  matchId: string;
  status: string;
  finishedAt: Date | null;
  scoreA: number;
  scoreB: number;
  rosterA: string | undefined;
  rosterB: string | undefined;
  totalCasualties: number;
  totalTurns: number;
}

export interface RosterPopularityStat {
  roster: string;
  pickCount: number;
  /** Win-rate (draws weighted 0.5) over completed matches with this roster. */
  winRate: number;
}

export interface GlobalDashboard {
  totalMatches: number;
  completedMatches: number;
  inProgressMatches: number;
  totalTouchdowns: number;
  totalCasualties: number;
  averageTouchdownsPerMatch: number;
  averageCasualtiesPerMatch: number;
  averageTurnsPerMatch: number;
  /** All known rosters sorted by pickCount desc then name asc. */
  rosterPopularity: RosterPopularityStat[];
  /** Most-picked roster slug; null if none observed. */
  topRoster: string | null;
}

interface RosterAcc {
  pickCount: number;
  w: number;
  l: number;
  d: number;
}

export function buildGlobalDashboard(
  records: ReadonlyArray<GlobalMatchRecord>,
): GlobalDashboard {
  let completedMatches = 0;
  let inProgressMatches = 0;
  let totalTouchdowns = 0;
  let totalCasualties = 0;
  let totalTurns = 0;

  const rosterAcc = new Map<string, RosterAcc>();

  for (const r of records) {
    if (r.status === 'in_progress') inProgressMatches += 1;
    if (r.status !== 'completed') continue;

    completedMatches += 1;
    totalTouchdowns += Math.max(0, r.scoreA) + Math.max(0, r.scoreB);
    totalCasualties += Math.max(0, r.totalCasualties);
    totalTurns += Math.max(0, r.totalTurns);

    const outcomeA = matchOutcome(r.scoreA, r.scoreB);
    const outcomeB = matchOutcome(r.scoreB, r.scoreA);

    if (r.rosterA) bumpRoster(rosterAcc, r.rosterA, outcomeA);
    if (r.rosterB) bumpRoster(rosterAcc, r.rosterB, outcomeB);
  }

  const totalMatches = records.length;
  const averageTouchdownsPerMatch =
    completedMatches === 0 ? 0 : totalTouchdowns / completedMatches;
  const averageCasualtiesPerMatch =
    completedMatches === 0 ? 0 : totalCasualties / completedMatches;
  const averageTurnsPerMatch =
    completedMatches === 0 ? 0 : totalTurns / completedMatches;

  const rosterPopularity: RosterPopularityStat[] = Array.from(rosterAcc.entries())
    .map(([roster, s]) => ({
      roster,
      pickCount: s.pickCount,
      winRate: s.pickCount === 0 ? 0 : (s.w + s.d * 0.5) / s.pickCount,
    }))
    .sort((a, b) => {
      if (b.pickCount !== a.pickCount) return b.pickCount - a.pickCount;
      return a.roster.localeCompare(b.roster);
    });

  const topRoster = rosterPopularity.length > 0 ? rosterPopularity[0].roster : null;

  return {
    totalMatches,
    completedMatches,
    inProgressMatches,
    totalTouchdowns,
    totalCasualties,
    averageTouchdownsPerMatch,
    averageCasualtiesPerMatch,
    averageTurnsPerMatch,
    rosterPopularity,
    topRoster,
  };
}

function bumpRoster(
  acc: Map<string, RosterAcc>,
  roster: string,
  outcome: 'W' | 'L' | 'D',
): void {
  const slot = acc.get(roster) ?? { pickCount: 0, w: 0, l: 0, d: 0 };
  slot.pickCount += 1;
  if (outcome === 'W') slot.w += 1;
  else if (outcome === 'L') slot.l += 1;
  else slot.d += 1;
  acc.set(roster, slot);
}

function matchOutcome(myScore: number, oppScore: number): 'W' | 'L' | 'D' {
  if (myScore > oppScore) return 'W';
  if (myScore < oppScore) return 'L';
  return 'D';
}
