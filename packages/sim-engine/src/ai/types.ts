/**
 * Behavior tree shared types — sprint Pro League 0.B.1.
 *
 * 3-pass loop documented in the sprint :
 *   Pass 1 - `evaluateSituation` : DriveState → DriveContext
 *   Pass 2 - `chooseStrategy`    : (context, profile) → StrategyId
 *   Pass 3 - `executePattern`    : (strategy, profile) → KeyMomentKind
 *
 * Cette decomposition garantit la coherence narrative des drives :
 * une fois la strategie choisie, les patterns associes biaisent les
 * key moments du tour vers une famille d'actions coherente (par
 * exemple cage-build → block + dodge prioritaires, breakaway → dodge
 * + pass + GFI).
 */

import type { TacticalProfile } from '../tactics/tactical-profile';

/** Kinds the driver can request — must stay in sync with the driver. */
export type KeyMomentKind = 'block' | 'pass' | 'dodge' | 'pickup' | 'gfi' | 'foul';

export type StrategyId =
  | 'cage-build'
  | 'breakaway'
  | 'defensive-screen'
  | 'blitz-train'
  | 'stall'
  | 'foul-fest';

export type PatternId =
  | 'cage-formation'
  | 'line-grind'
  | 'pass-route-deep'
  | 'wedge'
  | 'screen';

/** Normalised game-context flags read by `chooseStrategy`. */
export interface DriveContext {
  /** True when the active team has the ball. */
  hasPossession: boolean;
  /** True when the ball is within 4 yards of the opposing TD zone. */
  inRedZone: boolean;
  /** True when the active drive is roughly past midfield. */
  pastMidfield: boolean;
  /** True for late-game situations (turn 6+ of the half). */
  lateInHalf: boolean;
  /** True when the active team is leading on score. */
  leading: boolean;
  /** True when the active team is trailing. */
  trailing: boolean;
}

/** Strategy descriptor — how strongly does this strategy fit the
 *  current context+profile, and which patterns does it unlock. */
export interface Strategy {
  id: StrategyId;
  /** Patterns this strategy can execute (non-empty). */
  patterns: readonly PatternId[];
  /** Score in [0, 1+] — higher = better fit. Plugged into softmax. */
  score(context: DriveContext, profile: TacticalProfile): number;
}

/** Pattern descriptor — bias for each key-moment kind. Multiplied by
 *  the profile-derived score in the driver's softmax. */
export interface Pattern {
  id: PatternId;
  weights: Readonly<Partial<Record<KeyMomentKind, number>>>;
}
