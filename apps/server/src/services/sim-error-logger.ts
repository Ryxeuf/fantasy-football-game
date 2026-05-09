/**
 * Sim error / slow-sim structured logger (Lot 4.A.1 + 4.A.2).
 *
 * Phase 4.A — production hardening : on enrichit les logs sim-engine
 * avec des labels structurés Loki-friendly pour permettre des queries
 * du type :
 *
 *   {service="bb-server", event="sim_error", driver="full"} | json |
 *     errType=~"EngineVersionMismatch.*" | line_format "..."
 *
 * et des alertes Grafana ciblees par `errType`, `engineVer`, `race`
 * sans avoir a parser les messages.
 *
 * Architecture
 * ------------
 *  - `buildSimErrorLog(err, ctx)` : pure, retourne un objet
 *    pino-serialisable avec les bons labels. Le caller appelle
 *    `serverLog.error("sim failed", payload)` (pino merge).
 *  - `buildSlowSimLog({ durationSec, thresholdSec, ... })` : pure,
 *    retourne `null` si sous le seuil, sinon un payload `event=sim_slow`.
 *  - `truncateStack(stack, maxLen)` : pure, evite les logs de plusieurs
 *    Mo si une stack trace devient pathologique (cas d'un sim qui
 *    crash en cascade dans game-engine).
 *
 * Pure — aucun `serverLog.*` ici. Le caller decide du niveau (`.error`
 * pour sim_error, `.warn` pour sim_slow). Permet d'eviter les
 * mocks pino dans les tests et de garder ce fichier 100% testable.
 */

/** Seuil par defaut au-dela duquel un sim est considere "slow" (5s). */
export const DEFAULT_SLOW_SIM_THRESHOLD_SEC = 5;

/** Limite de chars du stack trace conserves dans le log structure. */
export const DEFAULT_STACK_TRACE_LIMIT = 2000;

export type SimDriver = "hybrid" | "full";

export interface SimErrorContext {
  readonly matchId: string;
  readonly engineVer: string;
  readonly driver: SimDriver;
  readonly seasonId: string;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly homeRace?: string;
  readonly awayRace?: string;
}

export interface SimErrorLog {
  readonly event: "sim_error";
  readonly errType: string;
  readonly errMessage: string;
  readonly stackTrace?: string;
  readonly matchId: string;
  readonly engineVer: string;
  readonly driver: SimDriver;
  readonly seasonId: string;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly homeRace?: string;
  readonly awayRace?: string;
}

export interface SlowSimLogInput extends SimErrorContext {
  readonly durationSec: number;
  readonly thresholdSec: number;
}

export interface SlowSimLog {
  readonly event: "sim_slow";
  readonly matchId: string;
  readonly durationSec: number;
  readonly thresholdSec: number;
  readonly engineVer: string;
  readonly driver: SimDriver;
  readonly seasonId: string;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly homeRace?: string;
  readonly awayRace?: string;
}

/**
 * Tronque un stack trace a `maxLen` chars en preservant le suffixe
 * `[truncated N chars]`. Retourne undefined sur stack vide / null.
 */
export function truncateStack(
  stack: string | undefined,
  maxLen: number,
): string | undefined {
  if (!stack || stack.length === 0) return undefined;
  if (stack.length <= maxLen) return stack;
  const dropped = stack.length - maxLen;
  return stack.slice(0, maxLen) + ` [truncated ${dropped} chars]`;
}

/**
 * Construit le payload pino-friendly pour un sim_error. Le caller
 * appelle :
 *
 *   serverLog.error("Sim failed", buildSimErrorLog(err, ctx))
 *
 * Pino merge les champs de l'objet dans le record final, qui est
 * ensuite ingere par Loki pour les queries structurees.
 */
export function buildSimErrorLog(
  err: unknown,
  ctx: SimErrorContext,
): SimErrorLog {
  const isError = err instanceof Error;
  const errType = isError ? err.name || "Error" : "Unknown";
  const errMessage = isError
    ? err.message
    : typeof err === "string"
      ? err
      : "unknown";
  const stackTrace = isError
    ? truncateStack(err.stack, DEFAULT_STACK_TRACE_LIMIT)
    : undefined;
  return {
    event: "sim_error",
    errType,
    errMessage,
    ...(stackTrace ? { stackTrace } : {}),
    matchId: ctx.matchId,
    engineVer: ctx.engineVer,
    driver: ctx.driver,
    seasonId: ctx.seasonId,
    homeTeamId: ctx.homeTeamId,
    awayTeamId: ctx.awayTeamId,
    ...(ctx.homeRace ? { homeRace: ctx.homeRace } : {}),
    ...(ctx.awayRace ? { awayRace: ctx.awayRace } : {}),
  };
}

/**
 * Construit le payload pour un sim_slow si la duree depasse strict le
 * seuil. Sinon retourne `null` (no-op cote caller).
 *
 * Strict > permet aux tests deterministes de fixer des seuils a
 * exactement 5s sans tomber sur la frontiere.
 */
export function buildSlowSimLog(input: SlowSimLogInput): SlowSimLog | null {
  if (!Number.isFinite(input.durationSec) || !Number.isFinite(input.thresholdSec)) {
    return null;
  }
  if (input.durationSec <= input.thresholdSec) return null;
  return {
    event: "sim_slow",
    matchId: input.matchId,
    durationSec: input.durationSec,
    thresholdSec: input.thresholdSec,
    engineVer: input.engineVer,
    driver: input.driver,
    seasonId: input.seasonId,
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    ...(input.homeRace ? { homeRace: input.homeRace } : {}),
    ...(input.awayRace ? { awayRace: input.awayRace } : {}),
  };
}
