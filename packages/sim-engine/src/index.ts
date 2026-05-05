/**
 * @bb/sim-engine — Pro League match simulator.
 *
 * Public API documented in `docs/roadmap/sprints/SPRINT-pro-league.md`
 * (sprint Pro League, lot 0.A). This file is the single import point for
 * downstream consumers (apps/server scheduler, broadcaster, bench harness).
 */

export { simulateMatch } from './simulate-match';
export {
  ENGINE_VER,
  type Casualty,
  type EngineVersion,
  type MatchEvent,
  type MatchOutcome,
  type MatchScore,
  type MatchSummary,
  type SimInput,
  type SimResult,
  type SimTeamInput,
} from './types';
export {
  createRng,
  rollD3,
  rollD6,
  rollD8,
  rollDie,
  type Rng,
  type RngSnapshot,
} from './rng/seeded';

export {
  resolveBlock,
  resolveDodge,
  resolveFoul,
  resolveGfi,
  resolvePass,
  resolvePickup,
  type BlockDieFace,
  type BlockInput,
  type BlockResult,
  type DodgeInput,
  type DodgeResult,
  type FoulInjuryOutcome,
  type FoulInput,
  type FoulResult,
  type GfiInput,
  type GfiResult,
  type PassInput,
  type PassResult,
  type PickupInput,
  type PickupResult,
  type ResolverPlayer,
  type ResolverPlayerState,
  type ResolverPosition,
  type ResolverResult,
  type ResolverSide,
  type ResolverState,
  type ResolverWeather,
} from './resolvers';
