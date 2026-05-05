export {
  STRATEGIES,
  STRATEGY_BY_ID,
} from './strategy/strategies';
export {
  PATTERNS,
  PATTERN_BY_ID,
} from './tactics/patterns';
export {
  aiPlay,
  chooseStrategy,
  choosePattern,
  evaluateSituation,
  executePattern,
  type DriveSnapshot,
} from './play';
export type {
  DriveContext,
  KeyMomentKind,
  Pattern,
  PatternId,
  Strategy,
  StrategyId,
} from './types';
