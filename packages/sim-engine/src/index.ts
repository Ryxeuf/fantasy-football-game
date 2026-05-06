/**
 * @bb/sim-engine — Pro League match simulator.
 *
 * Public API documented in `docs/roadmap/sprints/SPRINT-pro-league.md`
 * (sprint Pro League, lot 0.A). This file is the single import point for
 * downstream consumers (apps/server scheduler, broadcaster, bench harness).
 */

export { simulateMatch } from './simulate-match';
export { runHybridDriver, type DriverOptions } from './driver/hybrid-driver';
export {
  DEFAULT_TACTICAL_PROFILE,
  TACTICAL_PROFILE_PARAMETERS,
  parseTacticalProfile,
  safeParseTacticalProfile,
  tacticalProfileSchema,
  type TacticalParameter,
  type TacticalProfile,
} from './tactics/tactical-profile';
export {
  PRO_LEAGUE_TEAMS,
  PRO_LEAGUE_TEAM_BY_ID,
  type ProTeamId,
  type ProTeamProfile,
} from './tactics/race-profiles';
export {
  riskAppetiteToTemperature,
  softmaxSample,
  type WeightedCandidate,
} from './tactics/temperature';
export {
  applyDecay,
  confidenceBoostFor,
  createMomentumTracker,
  recordBlock,
  recordFailure,
  recordTouchdown,
  type BlockOutcome,
  type MomentumState,
  type MomentumTracker,
  type PlayerMomentum,
} from './tactics/momentum';
export {
  UNDERDOG_BOOST_PROBABILITY,
  UNDERDOG_TV_GAP_THRESHOLD,
  computeUnderdog,
  type UnderdogContext,
} from './tactics/underdog';
export {
  FORM_DECAY_MATCHES,
  applyMatchToForms,
  decayForm,
  getPlayerForm,
  type FormState,
  type FormUpdateInput,
  type PlayerForm,
} from './tactics/player-form';
export {
  PATTERNS,
  PATTERN_BY_ID,
  STRATEGIES,
  STRATEGY_BY_ID,
  aiPlay,
  chooseStrategy,
  choosePattern,
  evaluateSituation,
  executePattern,
  type DriveContext,
  type DriveSnapshot,
  type KeyMomentKind,
  type Pattern,
  type PatternId,
  type Strategy,
  type StrategyId,
} from './ai';
export {
  NUFFLE_EVENTS,
  NUFFLE_EVENT_BY_ID,
  emitNuffleEvent,
  rollNuffleEvent,
  type NuffleEffect,
  type NuffleEmitOptions,
  type NuffleEvent,
  type NuffleEventKind,
} from './nuffle/events';
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
