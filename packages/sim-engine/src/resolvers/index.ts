/**
 * Resolvers for BB actions consumed by the hybrid driver (lot 0.A.2).
 * Each resolver is a pure `(state, input, rng) -> result` function with the
 * `{success, turnover, newState, events, trace}` contract.
 */

export { resolveBlock, type BlockInput, type BlockResult, type BlockDieFace } from './block';
export { resolveDodge, type DodgeInput, type DodgeResult } from './dodge';
export { resolvePass, type PassInput, type PassResult } from './pass';
export { resolvePickup, type PickupInput, type PickupResult, calculatePickupModifier } from './pickup';
export { resolveGfi, type GfiInput, type GfiResult, gfiTargetForWeather } from './gfi';
export { resolveFoul, type FoulInput, type FoulResult, type FoulInjuryOutcome } from './foul';

export {
  type ResolverPlayer,
  type ResolverPlayerState,
  type ResolverPosition,
  type ResolverResult,
  type ResolverRng,
  type ResolverSide,
  type ResolverState,
  type ResolverWeather,
  adjacentOpponents,
  distance,
  findPlayer,
  hasSkill,
  isAdjacent,
  requirePlayer,
  updatePlayer,
} from './types';
