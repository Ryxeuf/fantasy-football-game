/**
 * Audit round 7 (HIGH) — helper d'overlap guard pour les cron ticks.
 *
 * Probleme : `setInterval(() => void tick(), tickMs)` fires sans verifier
 * si la tick precedente est encore en cours. Si `sweepUnsettledMarkets`,
 * `sweepMatchSpp`, etc. depassent leur intervalle (DB lente, Prisma
 * hang), les ticks s'empilent et re-processent les memes matchs en
 * concurrent. Le sweep idempotency aide mais reste best-effort.
 *
 * `runOnceAtATime(fn)` wrap une `Promise<void>` async tick et garantit
 * qu'une seule execution est in-flight a tout moment. Si une tick est
 * deja en cours quand l'intervalle re-fire, le skip est silencieux
 * (log debug si serverLog passe en arg).
 *
 * Note : ce guard est in-process uniquement. Multi-pod deploy doit
 * utiliser un DB-level advisory lock (Postgres pg_try_advisory_lock)
 * en plus. Hors scope round 7 — flag pour PR ulterieur.
 */

import { serverLog } from "./server-log";

export type CronTickFn = () => Promise<void>;

/**
 * Cree un wrapper d'overlap guard. Le wrapper retourne une fonction
 * idempotente : si une tick est deja in-flight, la nouvelle invocation
 * est skipped (logged debug).
 *
 * @param label Nom du tick pour les logs (e.g. "pro-bet-settle").
 * @param fn La tick a executer.
 * @returns Fonction wrappee a passer a `setInterval(() => void
 *   wrapped(), tickMs)`.
 */
export function runOnceAtATime(label: string, fn: CronTickFn): CronTickFn {
  let running = false;
  return async function guardedTick(): Promise<void> {
    if (running) {
      serverLog.debug(
        `[cron-overlap-guard] skip tick '${label}' (precedente toujours en cours)`,
      );
      return;
    }
    running = true;
    try {
      await fn();
    } finally {
      running = false;
    }
  };
}
