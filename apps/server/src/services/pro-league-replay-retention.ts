/**
 * Lot 5 « exploitation » — RÉTENTION des replays.
 *
 * Un replay v2 pèse ~15 Ko (journal), mais un replay v1 (snapshots) en pesait
 * 2 Mo, et une saison en produit 120 : sans purge, la table `Replay` ne fait
 * que grossir. Règle : les replays des matchs `completed` depuis plus de
 * `PRO_LEAGUE_REPLAY_RETENTION_DAYS` jours (défaut 365, `0` = jamais) sont
 * supprimés, sauf ceux d'une saison encore `in_progress`. La ligne de match
 * reste (score, compteurs, résumé) ; seul `replayId` repasse à `null`, ce
 * que la fiche de match sait déjà afficher (« replay indisponible »).
 *
 * Les matchs de test ne sont pas concernés (le bac à sable a sa propre purge).
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

export const DEFAULT_REPLAY_RETENTION_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BATCH = 200;

/** Pur : durée de rétention d'après l'environnement (0 = jamais purger). */
export function resolveReplayRetentionDays(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = env.PRO_LEAGUE_REPLAY_RETENTION_DAYS;
  if (raw === undefined || raw === "") return DEFAULT_REPLAY_RETENTION_DAYS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_REPLAY_RETENTION_DAYS;
}

/** Pur : date avant laquelle un match terminé a un replay périmé. */
export function replayRetentionCutoff(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() - retentionDays * DAY_MS);
}

export interface PruneReplaysInput {
  readonly now?: Date;
  readonly retentionDays?: number;
  readonly batch?: number;
}

export interface PruneReplaysResult {
  readonly inspected: number;
  readonly pruned: number;
  readonly skipped: boolean;
}

export async function pruneExpiredReplays(input: PruneReplaysInput = {}): Promise<PruneReplaysResult> {
  const retentionDays = input.retentionDays ?? resolveReplayRetentionDays();
  if (retentionDays <= 0) return { inspected: 0, pruned: 0, skipped: true };
  const now = input.now ?? new Date();
  const cutoff = replayRetentionCutoff(now, retentionDays);
  const rows = (await prisma.proLeagueMatch.findMany({
    where: {
      status: "completed",
      isTest: false,
      replayId: { not: null },
      completedAt: { lt: cutoff },
      season: { status: { not: "in_progress" } },
    },
    select: { id: true },
    orderBy: { completedAt: "asc" },
    take: input.batch ?? DEFAULT_BATCH,
  })) as ReadonlyArray<{ id: string }>;
  if (rows.length === 0) return { inspected: 0, pruned: 0, skipped: false };

  const ids = rows.map((r) => r.id);
  const [deleted] = (await prisma.$transaction([
    prisma.replay.deleteMany({ where: { matchId: { in: ids } } }),
    prisma.proLeagueMatch.updateMany({ where: { id: { in: ids } }, data: { replayId: null } }),
  ])) as [{ count: number }, { count: number }];
  serverLog.info(
    `[pro-league-replay-retention] ${deleted.count} replay(s) purgés (terminés avant ${cutoff.toISOString()})`,
  );
  return { inspected: rows.length, pruned: deleted.count, skipped: false };
}
