/**
 * Adaptateur pino pour `serverLog` (tâche S25.1 — Sprint 25).
 *
 * Construit un `ServerLogImpl` qui émet des lignes JSON structurées via
 * pino tout en restant compatible avec la signature variadique style
 * `console.*` utilisée dans tout le code serveur (heritée de S24.8).
 *
 * Le branchement effectif via `setServerLogImpl(pinoServerLogImpl)` est
 * fait dans `index.ts` au démarrage du serveur, sauf en test/SQLite où
 * l'on conserve la délégation `console.*` par défaut pour ne pas casser
 * les spies existants.
 */

import pino, { type Logger } from "pino";

import type { LogArg, ServerLogImpl } from "./server-log";

/**
 * Convertit une liste d'arguments style `console.*` en un couple
 * `{ obj, msg }` compatible pino :
 *   - une `Error` est extraite dans `obj.err` (pino-friendly)
 *   - un objet plain est mergé dans `obj`
 *   - les autres valeurs sont concaténées en `msg`
 */
export function formatLogArgs(args: ReadonlyArray<LogArg>): {
  msg: string;
  obj: Record<string, unknown>;
} {
  const obj: Record<string, unknown> = {};
  const msgParts: string[] = [];

  for (const arg of args) {
    if (arg instanceof Error) {
      obj.err = arg;
      continue;
    }
    if (
      arg !== null &&
      typeof arg === "object" &&
      !Array.isArray(arg)
    ) {
      Object.assign(obj, arg as Record<string, unknown>);
      continue;
    }
    msgParts.push(typeof arg === "string" ? arg : String(arg));
  }

  return { obj, msg: msgParts.join(" ") };
}

type LevelMethod = (
  obj: Record<string, unknown>,
  msg: string,
) => void;

interface PinoLike {
  trace: LevelMethod;
  debug: LevelMethod;
  info: LevelMethod;
  warn: LevelMethod;
  error: LevelMethod;
}

/**
 * Construit un `ServerLogImpl` qui délègue à un logger pino (ou compatible).
 * Exposé pour les tests : on injecte un fake et on vérifie le routage des
 * niveaux. En production c'est `defaultPinoLogger` qui est passé.
 */
export function buildPinoServerLogImpl(logger: PinoLike): ServerLogImpl {
  const route = (level: keyof PinoLike) =>
    (...args: LogArg[]) => {
      const { obj, msg } = formatLogArgs(args);
      logger[level](obj, msg);
    };

  return {
    log: route("info"),
    info: route("info"),
    warn: route("warn"),
    error: route("error"),
    debug: route("debug"),
  };
}

/**
 * Logger pino par défaut. Niveau pilotable via `LOG_LEVEL`
 * (`debug`/`info`/`warn`/`error`). En prod on garde `info` pour limiter
 * la verbosité Loki ; en dev on peut passer `LOG_LEVEL=debug`.
 *
 * `base: { service }` ajoute le nom du service à chaque ligne, indispensable
 * quand plusieurs services écrivent dans la même destination Loki.
 */
export const defaultPinoLogger: Logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "@bb/server" },
  // Format ISO-8601 plus lisible que l'epoch ms par défaut quand on lit
  // les logs en raw stdout (avant que Loki ne les parse).
  timestamp: pino.stdTimeFunctions.isoTime,
});

/** Adaptateur prêt à brancher via `setServerLogImpl(pinoServerLogImpl)`. */
export const pinoServerLogImpl: ServerLogImpl = buildPinoServerLogImpl(
  defaultPinoLogger,
);
