/**
 * Lot 5 « exploitation » — la transition `ready → completed`.
 *
 * Un match pré-simulé reste `ready` : le web le considère EN DIRECT dès que
 * `scheduledAt` est passé (`isLiveValid`) et le broadcaster rejoue les
 * évènements sur l'horloge murale depuis le coup d'envoi. Mais AUCUN code ne
 * le passait ensuite à `completed` (exploration, lot 5) : les matchs de
 * production restaient « en direct » pour toujours, le replay inaccessible,
 * le healthcheck `simRunner` dégradé et les classements en attente.
 *
 * Règle, pure (`shouldComplete`) : un match `ready` ou `in_progress` est
 * terminé quand `scheduledAt + durationMs` (durée du replay) est passé.
 * `completedAt` reçoit cette échéance — l'heure réelle du coup de sifflet
 * final, pas l'heure du balayage. Sans replay (ne devrait pas arriver pour
 * un match `ready`), une durée de repli de 90 minutes s'applique.
 *
 * Les matchs de test (bac à sable admin) passent `completed` dès la
 * simulation et ne sont pas concernés.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

export const LIVE_STATUSES: readonly string[] = ["ready", "in_progress"];
export const FALLBACK_MATCH_DURATION_MS = 90 * 60 * 1000;
const DEFAULT_BATCH = 50;

export interface CompletionCandidate {
  readonly id: string;
  readonly status: string;
  readonly scheduledAt: Date;
  /** Durée du replay (ms), `null` si aucun replay. */
  readonly durationMs: number | null;
}

/** Échéance du coup de sifflet final. */
export function completionDeadline(scheduledAt: Date, durationMs: number | null): Date {
  const duration =
    durationMs !== null && Number.isFinite(durationMs) && durationMs > 0
      ? durationMs
      : FALLBACK_MATCH_DURATION_MS;
  return new Date(scheduledAt.getTime() + duration);
}

/** Pur : le match doit-il passer `completed` à l'instant `now` ? */
export function shouldComplete(candidate: CompletionCandidate, now: Date): boolean {
  if (!LIVE_STATUSES.includes(candidate.status)) return false;
  return now.getTime() >= completionDeadline(candidate.scheduledAt, candidate.durationMs).getTime();
}

export interface CompleteBroadcastInput {
  readonly now?: Date;
  readonly batch?: number;
}

export interface CompleteBroadcastResult {
  readonly inspected: number;
  readonly completed: number;
  readonly pending: number;
}

/**
 * Balaye les matchs en direct dont le coup de sifflet final est passé et
 * les passe `completed`. Idempotent : un match déjà `completed` n'est pas
 * relu, et l'UPDATE est conditionné au statut courant.
 */
export async function completeBroadcastMatches(
  input: CompleteBroadcastInput = {},
): Promise<CompleteBroadcastResult> {
  const now = input.now ?? new Date();
  const batch = input.batch ?? DEFAULT_BATCH;
  const rows = (await prisma.proLeagueMatch.findMany({
    where: {
      status: { in: [...LIVE_STATUSES] },
      isTest: false,
      scheduledAt: { lte: now },
    },
    select: { id: true, status: true, scheduledAt: true },
    orderBy: { scheduledAt: "asc" },
    take: batch,
  })) as ReadonlyArray<{ id: string; status: string; scheduledAt: Date }>;
  if (rows.length === 0) return { inspected: 0, completed: 0, pending: 0 };

  const replays = (await prisma.replay.findMany({
    where: { matchId: { in: rows.map((r) => r.id) } },
    select: { matchId: true, durationMs: true },
  })) as ReadonlyArray<{ matchId: string; durationMs: number }>;
  const durationById = new Map(replays.map((r) => [r.matchId, r.durationMs] as const));

  let completed = 0;
  for (const row of rows) {
    const candidate: CompletionCandidate = {
      id: row.id,
      status: row.status,
      scheduledAt: row.scheduledAt,
      durationMs: durationById.get(row.id) ?? null,
    };
    if (!shouldComplete(candidate, now)) continue;
    const completedAt = completionDeadline(candidate.scheduledAt, candidate.durationMs);
    const updated = (await prisma.proLeagueMatch.updateMany({
      where: { id: row.id, status: { in: [...LIVE_STATUSES] } },
      data: { status: "completed", completedAt },
    })) as { count: number };
    if (updated.count === 1) {
      completed += 1;
      serverLog.info(`[pro-league-completion] match ${row.id} → completed (${completedAt.toISOString()})`);
    }
  }
  return { inspected: rows.length, completed, pending: rows.length - completed };
}

/** Matchs en direct dont l'échéance est dépassée depuis plus de `staleMs` (healthcheck). */
export async function countStaleLiveMatches(now: Date, staleMs: number): Promise<number> {
  const rows = (await prisma.proLeagueMatch.findMany({
    where: {
      status: { in: [...LIVE_STATUSES] },
      isTest: false,
      scheduledAt: { lte: new Date(now.getTime() - staleMs) },
    },
    select: { id: true, status: true, scheduledAt: true },
    take: DEFAULT_BATCH,
  })) as ReadonlyArray<{ id: string; status: string; scheduledAt: Date }>;
  if (rows.length === 0) return 0;
  const replays = (await prisma.replay.findMany({
    where: { matchId: { in: rows.map((r) => r.id) } },
    select: { matchId: true, durationMs: true },
  })) as ReadonlyArray<{ matchId: string; durationMs: number }>;
  const durationById = new Map(replays.map((r) => [r.matchId, r.durationMs] as const));
  const threshold = new Date(now.getTime() - staleMs);
  return rows.filter((r) =>
    shouldComplete({ ...r, durationMs: durationById.get(r.id) ?? null }, threshold),
  ).length;
}
