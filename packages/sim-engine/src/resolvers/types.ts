/**
 * Shared types for the BB action resolvers (sprint Pro League 0.A.5).
 *
 * The resolvers operate on a drive-level slice of the match — NOT on the
 * heavy `GameState` from `@bb/game-engine` (which carries dugout zones,
 * pre-match phases, kickoff events, etc. that are out of scope for the
 * sim-engine driver in 0.A.2).
 *
 * Why a local state type
 * ----------------------
 * - Each resolver is a pure function `(state, input, rng) -> result`.
 * - `newState` is always a *fresh* object (immutability rule from common
 *   coding-style).
 * - The driver (0.A.2) maps its internal drive state to/from this slice
 *   per action ; the broadcaster (1.B) never sees `ResolverState`,
 *   only the emitted `MatchEvent[]`.
 */

import type { MatchEvent } from '@bb/shared-types';

import type { Rng } from '../rng/seeded';

/** Side relative to the kickoff. Mirrors `SimTeamInput.side`. */
export type ResolverSide = 'home' | 'away';

/** Minimal set of player states the resolvers care about. The driver
 *  expands this when needed (e.g. `ko` / `casualty` for benching).
 *  `sent_off` : foul expulsion par l'arbitre (BB2020 doubles on armor or
 *  injury). Distinct de `casualty` car le joueur n'est PAS blessé et
 *  ne peut pas être ramené par un apothecary — il sort définitivement
 *  pour la mi-temps en cours. */
export type ResolverPlayerState = 'standing' | 'prone' | 'stunned' | 'ko' | 'casualty' | 'sent_off';

export type ResolverWeather =
  | 'nice'
  | 'sweltering'
  | 'very_sunny'
  | 'pouring_rain'
  | 'blizzard';

export interface ResolverPosition {
  x: number;
  y: number;
}

export interface ResolverPlayer {
  id: string;
  team: ResolverSide;
  /** Strength stat (BB2020 / BB3 — typically 2..6+). */
  st: number;
  /** Agility stat — used as `7 - ag` target on a d6 (BB3 stat scale). */
  ag: number;
  /** Movement Allowance — used by GFI (no roll under MA), passing range. */
  ma: number;
  /** Armour Value — used by armour rolls on foul / KD. */
  av: number;
  /** BB skill string keys (e.g. `'block'`, `'dodge'`, `'sure_hands'`). */
  skills: readonly string[];
  position: ResolverPosition;
  state: ResolverPlayerState;
  hasBall?: boolean;
  /** Used at most once per turn per player (BB rule). */
  rerollAvailable?: boolean;
}

export interface ResolverState {
  players: readonly ResolverPlayer[];
  ballAt?: ResolverPosition;
  /** Team currently activating players. */
  activeTeam: ResolverSide;
  weather: ResolverWeather;
  width: number;
  height: number;
  /** 1-indexed turn count (BB has 8 turns / half). */
  turn: number;
  /** Engine version stamped on every emitted event. */
  engineVer: string;
}

/**
 * Universal output contract for every resolver. The sprint table mandates
 * `{success, newState, events[]}` ; we add a typed `meta` to surface dice
 * rolls and chosen rerolls (audit + Gazette LLM).
 */
export interface ResolverResult {
  /** `true` if the action succeeded (no turnover from this resolver). */
  success: boolean;
  /** Whether the action triggered a turnover (subject to driver follow-up). */
  turnover: boolean;
  /** Immutable copy of the state with the action's effects applied. */
  newState: ResolverState;
  /** Wire-level events emitted by this resolver, in display order. */
  events: readonly MatchEvent[];
}

/** Helper used everywhere — never mutates inputs. */
export function updatePlayer(
  state: ResolverState,
  playerId: string,
  patch: Partial<ResolverPlayer>
): ResolverState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
  };
}

export function findPlayer(
  state: ResolverState,
  playerId: string
): ResolverPlayer | undefined {
  return state.players.find((p) => p.id === playerId);
}

export function requirePlayer(state: ResolverState, playerId: string): ResolverPlayer {
  const p = findPlayer(state, playerId);
  if (!p) {
    throw new Error(`Resolver: player '${playerId}' not found in state`);
  }
  return p;
}

export function isAdjacent(a: ResolverPosition, b: ResolverPosition): boolean {
  return Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && !(a.x === b.x && a.y === b.y);
}

export function distance(a: ResolverPosition, b: ResolverPosition): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function adjacentOpponents(
  state: ResolverState,
  pos: ResolverPosition,
  team: ResolverSide
): readonly ResolverPlayer[] {
  return state.players.filter(
    (p) =>
      p.team !== team &&
      p.state === 'standing' &&
      isAdjacent(pos, p.position) &&
      // Players adjacent to a tackle-zone-suppressing player (e.g. opponent
      // is `prone`) don't apply TZ. We already filter on standing only.
      true
  );
}

export function hasSkill(player: ResolverPlayer, skill: string): boolean {
  return player.skills.includes(skill);
}

/** Used by every resolver — the same shared `Rng` is forked per resolver
 *  so block rolls don't perturb dodge rolls (replay independence). */
export type ResolverRng = Pick<Rng, 'next'>;
