/**
 * Shared `MatchEvent` format for the Pro League sim engine.
 *
 * Sprint Pro League — task 0.A.3. This file is intentionally the only
 * source of truth for the event catalogue : the sim-engine produces it,
 * the broadcaster (lot 1.B) and the spectate UI (lot 1.B.3 / 1.B.4)
 * consume it, and the replay storage (lot 1.A.2) round-trips it.
 *
 * Why a separate `@bb/shared-types` package
 * -----------------------------------------
 * The web frontend MUST be able to consume these types without pulling in
 * the whole `@bb/sim-engine` (which depends on `@bb/game-engine` rules,
 * lot 0.A.5 resolvers, etc.). Keeping the wire format here lets us version
 * the broadcast contract independently from the engine implementation.
 *
 * Each event carries `engineVer` so old replays remain decodable after
 * sim-engine major bumps (cf. lot 1.A.5 freeze-on-engine-version policy).
 */

/** Catalogue declared by sprint Pro League — table 0.A.3. Order is the
 *  emission order during a typical drive (purely documentary). */
export const EVENT_TYPES = Object.freeze([
  'KICKOFF',
  'TURN_START',
  /**
   * Lot 3.A.3 — `PLAYER_ACTIVATION` marque le moment où un joueur entame
   * son action dans le tour (ex: "A3 Blitzer is now acting"). Émis quand
   * `state.selectedPlayerId` change vers une nouvelle valeur non-null.
   * Permet au narrator de structurer la timeline par joueur plutôt que
   * par action brute, et au frontend d'highlight le joueur actif.
   */
  'PLAYER_ACTIVATION',
  /**
   * Lot 3.A.3 — `BLITZ_DECLARED` annonce qu'un joueur déclare un blitz
   * (move + block dans le même tour). Émis avant le `BLOCK` qui en
   * résulte. Sert à distinguer un block stationnaire (réagi sur place)
   * d'un blitz (parcours puis charge), info utile au narrator BB.
   */
  'BLITZ_DECLARED',
  'BLOCK',
  /**
   * Lot 3.A.3 — `KNOCKDOWN` détaille le résultat d'un BLOCK quand le
   * défenseur tombe (state passe à `prone` ou `stunned`) mais sans
   * armor break. Pre-cursor des KO/CASUALTY (qui ne sont émis que si
   * l'armor casse). Améliore la granularité narrative.
   */
  'KNOCKDOWN',
  'DODGE',
  'PASS',
  /**
   * Generic ball-carrier advance not tied to a key moment (#4). The
   * sim-engine bulk yardage roll used to be invisible on the timeline
   * — only TURN_START's "(drive +N yds)" annotation hinted at it.
   * MOVE makes the play explicit : every yard the ball travels is
   * backed by a narrated event with a `kind` (positioning / run /
   * sweep / breakaway / halt / scoring_run).
   */
  'MOVE',
  'TD',
  'KO',
  'CASUALTY',
  'TURNOVER',
  'NUFFLE',
  'HALFTIME',
  'END',
] as const);

export type EventType = (typeof EVENT_TYPES)[number];

const EVENT_TYPE_SET: ReadonlySet<EventType> = new Set(EVENT_TYPES);

/**
 * Wire-level match event. Optional fields are NOT stripped server-side ;
 * unknown payload keys are preserved through the broadcaster so the UI
 * can degrade gracefully on schema bumps.
 */
export interface MatchEvent {
  /** Discriminant — see `EVENT_TYPES`. */
  type: EventType;
  /**
   * Wall-clock offset in milliseconds since `KICKOFF`. The broadcaster
   * dispatches each event when `Date.now() - kickoffStartedAt >= displayAtMs`
   * so a pre-simulated match reads "live" to spectators (lot 1.B.1).
   * Must be a non-negative integer.
   */
  displayAtMs: number;
  /** Sim-engine version that produced the event. Used by 1.A.5 to refuse
   *  replays produced by an incompatible engine. */
  engineVer: string;
  /** Optional event-scoped seed for deterministic resolver replay. */
  seed?: number;
  /** Free-form payload validated at the consumer (UI ticker, Gazette LLM,
   *  bench harness). Kept open so resolvers (0.A.5) can extend without a
   *  central type bump. */
  meta?: Readonly<Record<string, unknown>>;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Runtime guard. Use at any process boundary that ingests events
 * (broadcaster SSE, replay storage decode, bench parser).
 */
export function isMatchEvent(value: unknown): value is MatchEvent {
  if (!isPlainRecord(value)) return false;

  const { type, displayAtMs, engineVer, seed, meta } = value;

  if (typeof type !== 'string') return false;
  if (!EVENT_TYPE_SET.has(type as EventType)) return false;
  if (!isPositiveInteger(displayAtMs)) return false;
  if (typeof engineVer !== 'string' || engineVer.length === 0) return false;
  if (seed !== undefined && (typeof seed !== 'number' || !Number.isFinite(seed))) {
    return false;
  }
  if (meta !== undefined && !isPlainRecord(meta)) return false;

  return true;
}

/** Narrowing helper for switch-by-type consumers (broadcaster, ticker). */
export function isOfEventType<T extends EventType>(
  value: unknown,
  type: T
): value is MatchEvent & { type: T } {
  return isMatchEvent(value) && value.type === type;
}
