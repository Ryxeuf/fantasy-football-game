/**
 * Public types for @bb/sim-engine.
 *
 * Sprint Pro League — task 0.A.1 (workspace + public interface).
 * The wire-level `MatchEvent` enum + `displayAtMs` channel was promoted
 * to `@bb/shared-types` in task 0.A.3 so that the broadcaster (lot 1.B)
 * and the spectate UI can consume it without pulling the whole engine.
 */

import type { CasualtyOutcome, TeamId } from '@bb/game-engine';
import type { MatchEvent } from '@bb/shared-types';

/** Identifies the package version that produced a SimResult. Used for replay
 *  freezing and bench regression baselines (cf. lots 0.D / 1.A.5). */
export const ENGINE_VER = '0.1.0';
export type EngineVersion = string;

/** Match outcome at score level. */
export type MatchOutcome = 'home' | 'away' | 'draw';

export interface MatchScore {
  home: number;
  away: number;
}

/**
 * Minimal description of a team passed to the simulator. Tactical profile
 * (lot 0.B) is intentionally optional here so 0.A.1 does not force its
 * shape — task 0.B.2 will introduce the validated `TacticalProfile`.
 */
export interface SimTeamInput {
  id: string;
  name: string;
  side: 'home' | 'away';
  /** Roster id list — actual roster lookup is consumer-side for now. */
  rosterIds?: readonly string[];
  /** Free-form tactical profile, refined in lot 0.B. */
  tactics?: Readonly<Record<string, unknown>>;
}

export interface SimInput {
  /** Stable seed for the PRNG (xoroshiro injection arrives in 0.A.4). */
  seed: number;
  home: SimTeamInput;
  away: SimTeamInput;
  /** Optional weather hint ; resolved by game-engine pre-match in 0.A.5. */
  weather?: string;
  /** Free metadata propagated to the result for traceability. */
  meta?: Readonly<Record<string, unknown>>;
}

/** Re-export the wire-level event type so existing consumers keep working
 *  through `@bb/sim-engine`. New code should import from `@bb/shared-types`
 *  directly to break the runtime dependency on the engine bundle. */
export type { MatchEvent, EventType } from '@bb/shared-types';

/**
 * Casualty record persisted post-match (lot 1.E.4 expands it with niggling
 * stacking + stat reductions that survive across seasons).
 */
export interface Casualty {
  playerId: string;
  team: TeamId;
  outcome: CasualtyOutcome;
  causedById?: string;
}

/** High-level match summary. Detailed stats arrive with the bench harness
 *  (lot 0.D.3). */
export interface MatchSummary {
  outcome: MatchOutcome;
  score: MatchScore;
  turnoverCount: number;
  touchdownCount: number;
  durationMs: number;
}

/**
 * Output contract of `simulateMatch`. Order of fields kept stable to make
 * downstream consumers (broadcaster 1.B, replay storage 1.A.2, bench 0.D)
 * version-tolerant.
 */
export interface SimResult {
  result: MatchOutcome;
  events: readonly MatchEvent[];
  summary: MatchSummary;
  casualties: readonly Casualty[];
  engineVer: EngineVersion;
}
