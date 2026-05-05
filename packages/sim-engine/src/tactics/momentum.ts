/**
 * Per-player momentum tracker — sprint Pro League 0.B.4.
 *
 * BB rule (sprint table) :
 * - `hot` après 2+ TDs ou 3+ blocks réussis (+1 confiance temporaire,
 *   utilisée par la tuning loop 0.E pour incliner les choix de l'IA)
 * - `cold` après échecs en chaîne (3 échecs consécutifs)
 * - état décay sur 1 notch par appel à `applyDecay` (utilisé par 0.C.4
 *   pour persister la forme inter-match avec un decay sur 3 matchs)
 *
 * Public read API (`snapshot()`) alimente la Nuffle Gazette LLM (lot 1.E)
 * et le calcul des cotes (lot 1.D.3 odds-calculator).
 *
 * Implementation note
 * -------------------
 * Le tracker est mutable interne mais expose seulement des snapshots
 * immuables, conformément à la règle d'immutabilité du repo. Les
 * fonctions `recordTouchdown` / `recordBlock` / `recordFailure` sont
 * volontairement procédurales (mutation locale du tracker) parce que
 * le driver hybride en émet des dizaines par match — l'allocation
 * d'un nouvel objet par event coûterait cher dans le bench (lot 0.D).
 */

export type MomentumState = 'hot' | 'normal' | 'cold';

export interface PlayerMomentum {
  playerId: string;
  state: MomentumState;
  /** Touchdowns scored this match (resets on `applyDecay`). */
  touchdowns: number;
  /** Successful blocks this match. */
  successfulBlocks: number;
  /** Number of consecutive failed actions (resets on any success / TD). */
  failureStreak: number;
}

export interface BlockOutcome {
  success: boolean;
}

interface MutableMomentum {
  state: MomentumState;
  touchdowns: number;
  successfulBlocks: number;
  failureStreak: number;
}

export interface MomentumTracker {
  /** Returns an immutable snapshot for one player (creates one if absent). */
  get(playerId: string): PlayerMomentum;
  /** Returns a snapshot of every tracked player (Gazette / odds API). */
  snapshot(): readonly PlayerMomentum[];
  /** Internal — exposed for the record* helpers. Do not call directly. */
  _ensure(playerId: string): MutableMomentum;
  _entries(): IterableIterator<[string, MutableMomentum]>;
}

const HOT_TD_THRESHOLD = 2;
const HOT_BLOCK_THRESHOLD = 3;
const COLD_FAILURE_THRESHOLD = 3;

function freshEntry(): MutableMomentum {
  return {
    state: 'normal',
    touchdowns: 0,
    successfulBlocks: 0,
    failureStreak: 0,
  };
}

function snapshotEntry(playerId: string, e: MutableMomentum): PlayerMomentum {
  return {
    playerId,
    state: e.state,
    touchdowns: e.touchdowns,
    successfulBlocks: e.successfulBlocks,
    failureStreak: e.failureStreak,
  };
}

export function createMomentumTracker(): MomentumTracker {
  const entries = new Map<string, MutableMomentum>();
  return {
    get(playerId) {
      let e = entries.get(playerId);
      if (!e) {
        e = freshEntry();
        entries.set(playerId, e);
      }
      return snapshotEntry(playerId, e);
    },
    snapshot() {
      return Array.from(entries.entries(), ([id, e]) => snapshotEntry(id, e));
    },
    _ensure(playerId) {
      let e = entries.get(playerId);
      if (!e) {
        e = freshEntry();
        entries.set(playerId, e);
      }
      return e;
    },
    _entries() {
      return entries.entries();
    },
  };
}

function refreshState(e: MutableMomentum): void {
  if (e.failureStreak >= COLD_FAILURE_THRESHOLD) {
    e.state = 'cold';
    return;
  }
  if (e.touchdowns >= HOT_TD_THRESHOLD || e.successfulBlocks >= HOT_BLOCK_THRESHOLD) {
    e.state = 'hot';
    return;
  }
  // Stays normal once neither threshold is met. Note: a previously hot
  // player who has accumulated 3 failures will fall through to the cold
  // branch on the next failure.
  if (e.state === 'cold' && e.failureStreak < COLD_FAILURE_THRESHOLD) {
    e.state = 'normal';
  }
}

export function recordTouchdown(tracker: MomentumTracker, playerId: string): void {
  const e = tracker._ensure(playerId);
  e.touchdowns += 1;
  e.failureStreak = 0;
  refreshState(e);
}

export function recordBlock(
  tracker: MomentumTracker,
  playerId: string,
  outcome: BlockOutcome
): void {
  const e = tracker._ensure(playerId);
  if (outcome.success) {
    e.successfulBlocks += 1;
    e.failureStreak = 0;
  } else {
    e.failureStreak += 1;
  }
  refreshState(e);
}

export function recordFailure(tracker: MomentumTracker, playerId: string): void {
  const e = tracker._ensure(playerId);
  e.failureStreak += 1;
  refreshState(e);
}

/**
 * Confidence delta used by the tuning loop (lot 0.E.1) to nudge the
 * softmax sampler temperature on the next decision involving this player.
 */
export function confidenceBoostFor(state: MomentumState): -1 | 0 | 1 {
  if (state === 'hot') return 1;
  if (state === 'cold') return -1;
  return 0;
}

/**
 * Cross-match decay — moves every tracked player one notch toward
 * `normal`. The sprint specifies "decay sur 3 matchs" (lot 0.C.4) ; the
 * server-side cross-match orchestrator is expected to call this once
 * per match boundary on the persisted `PlayerForm` snapshot.
 *
 * Counters are NOT reset (they represent the within-match cumulative
 * activity) — only the qualitative state moves toward normal.
 */
export function applyDecay(tracker: MomentumTracker): void {
  for (const [, e] of tracker._entries()) {
    if (e.state === 'hot') {
      e.state = 'normal';
    } else if (e.state === 'cold') {
      e.state = 'normal';
    }
    // Drop counters by 1 on each decay tick so the in-match thresholds
    // are not "sticky" forever.
    e.touchdowns = Math.max(0, e.touchdowns - 1);
    e.successfulBlocks = Math.max(0, e.successfulBlocks - 1);
    e.failureStreak = Math.max(0, e.failureStreak - 1);
  }
}
