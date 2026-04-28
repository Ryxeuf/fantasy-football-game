/**
 * Wrapper de logging serveur (tâche S24.8 — Sprint 24).
 *
 * Indirection minimale au-dessus de `console.*` pour permettre, en S25,
 * un swap vers une implémentation structurée (pino) sans devoir toucher
 * chaque call site.
 *
 * Utilisation :
 *   import { serverLog } from "./utils/server-log";
 *   serverLog.error("[scope] context", err);
 *
 * Migration depuis `console.*` :
 *   console.error → serverLog.error
 *   console.warn  → serverLog.warn
 *   console.log   → serverLog.log
 *   console.info  → serverLog.info
 *   console.debug → serverLog.debug
 *
 * En S25, `setServerLogImpl(pinoAdapter)` au boot du serveur basculera
 * tout l'écosystème vers pino sans diff sur les call sites.
 */

export type LogArg = unknown;

export interface ServerLogImpl {
  log: (...args: LogArg[]) => void;
  info: (...args: LogArg[]) => void;
  warn: (...args: LogArg[]) => void;
  error: (...args: LogArg[]) => void;
  debug: (...args: LogArg[]) => void;
}

/**
 * Implémentation par défaut : déléguer à `console.*`.
 * On référence dynamiquement `console` au moment de l'appel pour ne pas
 * figer la référence (utile pour les tests qui spy sur console).
 */
const defaultImpl: ServerLogImpl = {
  log: (...args) => {
    console.log(...args);
  },
  info: (...args) => {
    console.info(...args);
  },
  warn: (...args) => {
    console.warn(...args);
  },
  error: (...args) => {
    console.error(...args);
  },
  debug: (...args) => {
    console.debug(...args);
  },
};

let activeImpl: ServerLogImpl = defaultImpl;

/** Remplace l'implémentation active (utile pour tests et migration pino). */
export function setServerLogImpl(impl: ServerLogImpl): void {
  activeImpl = impl;
}

/** Restaure le delegation `console.*` par défaut. */
export function resetServerLogImpl(): void {
  activeImpl = defaultImpl;
}

/**
 * Façade publique gelée : les call sites importent `serverLog` et ne
 * peuvent pas écraser ses méthodes accidentellement. Le swap se fait
 * uniquement via `setServerLogImpl`.
 */
export const serverLog: ServerLogImpl = Object.freeze({
  log: (...args: LogArg[]) => activeImpl.log(...args),
  info: (...args: LogArg[]) => activeImpl.info(...args),
  warn: (...args: LogArg[]) => activeImpl.warn(...args),
  error: (...args: LogArg[]) => activeImpl.error(...args),
  debug: (...args: LogArg[]) => activeImpl.debug(...args),
});
