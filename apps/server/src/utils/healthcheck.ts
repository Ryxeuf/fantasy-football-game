/**
 * Healthcheck profond (tâche S25.1 — Sprint 25).
 *
 * Sépare le `liveness` (le process Node tourne ?) du `readiness` (les
 * dépendances critiques répondent ?). Les orchestrateurs (k8s, Docker
 * Swarm, Traefik) consomment habituellement deux endpoints distincts :
 * liveness pour décider de redémarrer le conteneur, readiness pour
 * décider de router le trafic vers lui.
 */

import type { Request, Response } from "express";

import { serverLog } from "./server-log";

export type DbPing = () => Promise<unknown>;

export interface ReadinessOptions {
  /** Fonction qui interroge la DB (ex: `() => prisma.$queryRaw\`SELECT 1\``). */
  dbPing: DbPing;
  /**
   * Plafond d'attente pour le ping DB. Au-delà on considère la DB
   * indisponible plutôt que de bloquer la probe orchestrateur.
   */
  timeoutMs?: number;
}

/** Liveness : 200 tant que le process est en vie. */
export async function liveness(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ ok: true, status: "live" });
}

/**
 * Readiness : ping la DB, retourne 503 si elle est indisponible ou si le
 * ping dépasse `timeoutMs`. Le détail d'erreur n'est pas exposé dans la
 * réponse pour éviter de leaker des infos d'infra.
 */
export function readiness(options: ReadinessOptions) {
  const timeoutMs = options.timeoutMs ?? 1000;

  return async (_req: Request, res: Response): Promise<void> => {
    const result = await pingWithTimeout(options.dbPing, timeoutMs);

    if (result.status === "up") {
      res.status(200).json({
        ok: true,
        status: "ready",
        checks: { db: "up" },
      });
      return;
    }

    const reason = result.status === "down" ? `: ${result.reason}` : "";
    serverLog.warn(`[health/ready] db ${result.status}${reason}`);
    res.status(503).json({
      ok: false,
      status: "not_ready",
      checks: { db: result.status },
    });
  };
}

type PingResult =
  | { status: "up" }
  | { status: "down"; reason: string }
  | { status: "timeout" };

async function pingWithTimeout(
  fn: DbPing,
  timeoutMs: number,
): Promise<PingResult> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<PingResult>((resolve) => {
    timer = setTimeout(() => resolve({ status: "timeout" }), timeoutMs);
  });

  const fnPromise: Promise<PingResult> = fn()
    .then(() => ({ status: "up" as const }))
    .catch((err: unknown) => ({
      status: "down" as const,
      reason: err instanceof Error ? err.message : String(err),
    }));

  try {
    return await Promise.race([fnPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
