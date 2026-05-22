/**
 * Service NFL Fantasy Player Value V3 — cote dynamique MPG-style.
 *
 * Chaque joueur a une cote courante mise a jour apres chaque settle
 * week. La cote est calculee a partir d'une moyenne ponderee :
 *
 *   60 % SPP saison complete (long terme, evite la volatilite extreme)
 *   40 % SPP des 4 dernieres weeks (court terme, recompense la forme)
 *
 * Multiplie par 5 pour avoir une echelle TV comparable a V2, puis
 * clampe [50, 3000]. Cap plus haut que V2 (3000) car la spéculation
 * peut faire grimper une étoile montante.
 *
 * Pas d'ownership pondere en V3.0 (couteux a calculer cross-leagues,
 * faible utilite tant que peu de leagues actives). A reintroduire en
 * V3.1 si besoin.
 *
 * Pur, deterministe, testable.
 */

import type { Prisma } from "@prisma/client";

import { prisma } from "../prisma";

// ────────────────────────────────────────────────────────────────────
// Erreurs typees
// ────────────────────────────────────────────────────────────────────

export type NflFantasyPlayerValueErrorCode =
  | "PLAYER_NOT_FOUND"
  | "PLAYER_NOT_ON_ROSTER"
  | "ENTRY_NOT_FOUND"
  | "INVALID_AMOUNT";

export class NflFantasyPlayerValueError extends Error {
  constructor(
    public readonly code: NflFantasyPlayerValueErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NflFantasyPlayerValueError";
  }
}

// ────────────────────────────────────────────────────────────────────
// Pure helpers (testables sans DB)
// ────────────────────────────────────────────────────────────────────

export interface ComputeDynamicValueInput {
  /** SPP cumules sur toute la saison de reference. */
  readonly seasonSpp: number;
  /** SPP des N=4 dernieres weeks (recents). */
  readonly recentSpp: number;
  /** Nombre de weeks deja jouees (pour normaliser recentSpp). */
  readonly weeksPlayed: number;
}

/**
 * Calcule la cote dynamique d'un joueur.
 *
 * Formule :
 *   weightedSpp = 0.6 * seasonAvg * weeksPlayed + 0.4 * recentSpp * factor
 *
 * Ou :
 *   seasonAvg = seasonSpp / max(1, weeksPlayed) (moyenne par week)
 *   factor = adapte la fenetre recente a 4 weeks (extrapolation si <4 jouees)
 *
 * Pour les rookies (weeksPlayed=0), retourne le plancher 50.
 *
 * Pur, deterministe.
 */
export function computeDynamicValue(opts: ComputeDynamicValueInput): number {
  if (opts.weeksPlayed <= 0) return 50;
  const seasonAvg = opts.seasonSpp / opts.weeksPlayed;
  const recentAvgWindowed =
    opts.recentSpp / Math.min(4, Math.max(1, opts.weeksPlayed));
  // Projete sur une saison entiere de 17 weeks pour avoir une echelle
  // stable, peu importe ou on est dans la saison.
  const projectedSeasonSpp =
    0.6 * seasonAvg * 17 + 0.4 * recentAvgWindowed * 17;
  const raw = Math.round(projectedSeasonSpp * 5);
  return Math.min(3000, Math.max(50, raw));
}

export interface PlayerValueDelta {
  readonly playerId: string;
  readonly previousValue: number;
  readonly newValue: number;
  readonly delta: number;
  readonly deltaPct: number;
}

export function computeValueDelta(
  previousValue: number,
  newValue: number,
): { delta: number; deltaPct: number } {
  const delta = newValue - previousValue;
  const deltaPct =
    previousValue > 0 ? Math.round((delta / previousValue) * 1000) / 10 : 0;
  return { delta, deltaPct };
}

// ────────────────────────────────────────────────────────────────────
// Services DB
// ────────────────────────────────────────────────────────────────────

const RECENT_WINDOW_WEEKS = 4;

/**
 * Recalcule la cote courante de TOUS les joueurs avec des stats sur
 * `seasonId`. Pour chaque joueur :
 *   - lit son seasonSpp + recentSpp (4 dernieres weeks ≤ weekId)
 *   - calcule la nouvelle cote
 *   - persiste : currentValue/previousValue swappes + snapshot weekId
 *
 * Idempotent (re-run apres meme weekId = no-op, l'unique
 * constraint sur (playerId, weekId) garantit l'absence de duplicate).
 *
 * Retourne le nombre de joueurs mis a jour + les deltas significatifs
 * (variation >= 50 TV) pour audit.
 */
export async function recomputeAllPlayerValues(opts: {
  weekId: string;
  seasonId: string;
}): Promise<{
  updated: number;
  topGainers: PlayerValueDelta[];
  topLosers: PlayerValueDelta[];
}> {
  // 1. Trouve la week + les 4 dernieres weeks de la saison (ordre desc).
  const recentWeeks = await prisma.nflWeek.findMany({
    where: {
      seasonId: opts.seasonId,
      weekNumber: { lte: await getWeekNumber(opts.weekId) },
    },
    orderBy: { weekNumber: "desc" },
    take: RECENT_WINDOW_WEEKS,
    select: { id: true },
  });
  type WeekRow = (typeof recentWeeks)[number];
  const recentWeekIds = (recentWeeks as WeekRow[]).map((w) => w.id);

  if (recentWeekIds.length === 0) {
    return { updated: 0, topGainers: [], topLosers: [] };
  }

  // 2. Aggrege SPP saison par joueur.
  const seasonStats = await prisma.nflGameStat.groupBy({
    by: ["playerId"],
    where: { game: { seasonId: opts.seasonId } },
    _sum: { computedSpp: true },
    _count: { _all: true },
  });
  type SeasonStat = (typeof seasonStats)[number];
  const seasonByPlayer = new Map<
    string,
    { total: number; weeksPlayed: number }
  >();
  for (const s of seasonStats as SeasonStat[]) {
    seasonByPlayer.set(s.playerId, {
      total: s._sum.computedSpp ?? 0,
      weeksPlayed: s._count._all,
    });
  }

  // 3. Aggrege SPP recents (4 dernieres weeks) par joueur.
  const recentStats = await prisma.nflGameStat.groupBy({
    by: ["playerId"],
    where: { game: { weekId: { in: recentWeekIds } } },
    _sum: { computedSpp: true },
  });
  type RecentStat = (typeof recentStats)[number];
  const recentByPlayer = new Map<string, number>();
  for (const s of recentStats as RecentStat[]) {
    recentByPlayer.set(s.playerId, s._sum.computedSpp ?? 0);
  }

  // 4. Charge la cote actuelle de tous les joueurs concernes.
  const playerIds = Array.from(seasonByPlayer.keys());
  if (playerIds.length === 0) {
    return { updated: 0, topGainers: [], topLosers: [] };
  }
  const players = await prisma.nflPlayer.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, currentValue: true },
  });
  type PlayerRow = (typeof players)[number];
  const currentByPlayer = new Map<string, number>();
  for (const p of players as PlayerRow[]) {
    currentByPlayer.set(p.id, p.currentValue);
  }

  // 5. Compute + apply.
  const now = new Date();
  const deltas: PlayerValueDelta[] = [];
  const updates: Prisma.PrismaPromise<unknown>[] = [];
  for (const [playerId, season] of seasonByPlayer) {
    const newValue = computeDynamicValue({
      seasonSpp: season.total,
      recentSpp: recentByPlayer.get(playerId) ?? 0,
      weeksPlayed: season.weeksPlayed,
    });
    const previousValue = currentByPlayer.get(playerId) ?? 50;
    if (newValue === previousValue) continue; // skip no-op

    const { delta, deltaPct } = computeValueDelta(previousValue, newValue);
    deltas.push({ playerId, previousValue, newValue, delta, deltaPct });

    updates.push(
      prisma.nflPlayer.update({
        where: { id: playerId },
        data: {
          previousValue,
          currentValue: newValue,
          valueRecomputedAt: now,
        },
      }),
    );
    updates.push(
      prisma.nflPlayerValueSnapshot.upsert({
        where: { playerId_weekId: { playerId, weekId: opts.weekId } },
        create: {
          playerId,
          weekId: opts.weekId,
          seasonId: opts.seasonId,
          value: newValue,
          sppAtSnapshot: season.total,
        },
        update: { value: newValue, sppAtSnapshot: season.total },
      }),
    );
  }

  // Chunk les updates pour eviter de bloquer la DB sur un gros batch.
  const CHUNK_SIZE = 100;
  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    await prisma.$transaction(updates.slice(i, i + CHUNK_SIZE));
  }

  // Top movers (>= 50 TV de delta) pour log/audit.
  const sorted = [...deltas].sort((a, b) => b.delta - a.delta);
  const topGainers = sorted.filter((d) => d.delta >= 50).slice(0, 10);
  const topLosers = sorted
    .filter((d) => d.delta <= -50)
    .slice(-10)
    .reverse();

  return { updated: deltas.length, topGainers, topLosers };
}

async function getWeekNumber(weekId: string): Promise<number> {
  const w = await prisma.nflWeek.findUnique({
    where: { id: weekId },
    select: { weekNumber: true },
  });
  return w?.weekNumber ?? 0;
}

// ────────────────────────────────────────────────────────────────────
// Mercato vente (MPG-style plus-value)
// ────────────────────────────────────────────────────────────────────

/**
 * Vend un joueur du roster d'une entry. Contrairement a
 * removePlayerFromRoster (qui rend juste le tvCost initial), sellPlayer
 * credit le budget de la **currentValue actuelle** : si le joueur a
 * pris de la valeur, c'est un gain net pour le coach.
 *
 * - Si currentValue > tvCost initial : plus-value (gain net)
 * - Si currentValue < tvCost initial : moins-value (perte sèche)
 *
 * Idempotent en cas de double-click via NflFantasyRosterError 404.
 */
export async function sellPlayer(opts: {
  entryId: string;
  playerId: string;
}): Promise<{
  refundAmount: number;
  initialCost: number;
  pnl: number;
}> {
  const roster = await prisma.nflFantasyRoster.findUnique({
    where: {
      entryId_playerId: { entryId: opts.entryId, playerId: opts.playerId },
    },
  });
  if (!roster) {
    throw new NflFantasyPlayerValueError(
      "PLAYER_NOT_ON_ROSTER",
      `Player ${opts.playerId} pas sur le roster de l'entry ${opts.entryId}`,
    );
  }

  const player = await prisma.nflPlayer.findUnique({
    where: { id: opts.playerId },
    select: { currentValue: true },
  });
  if (!player) {
    throw new NflFantasyPlayerValueError(
      "PLAYER_NOT_FOUND",
      `Player ${opts.playerId} introuvable`,
    );
  }

  const refundAmount = player.currentValue;
  const initialCost = roster.tvCost;
  const pnl = refundAmount - initialCost;

  await prisma.$transaction([
    prisma.nflFantasyRoster.delete({ where: { id: roster.id } }),
    prisma.nflFantasyEntry.update({
      where: { id: opts.entryId },
      data: {
        budgetRemaining: { increment: refundAmount },
        // totalTV decremente du cout initial (pas du refund) — il
        // represente le coup historique d'acquisition cumule.
        totalTV: { decrement: initialCost },
      },
    }),
  ]);

  return { refundAmount, initialCost, pnl };
}

// ────────────────────────────────────────────────────────────────────
// Read helpers
// ────────────────────────────────────────────────────────────────────

/**
 * Historique des cotes d'un joueur sur une saison. Trie par week
 * croissante pour faciliter le rendu graphique cote UI.
 */
export async function getPlayerValueHistory(opts: {
  playerId: string;
  seasonId: string;
}): Promise<
  Array<{
    weekId: string;
    weekNumber: number;
    value: number;
    sppAtSnapshot: number;
  }>
> {
  const snapshots = await prisma.nflPlayerValueSnapshot.findMany({
    where: { playerId: opts.playerId, seasonId: opts.seasonId },
    select: {
      weekId: true,
      value: true,
      sppAtSnapshot: true,
    },
  });
  type SnapshotRow = (typeof snapshots)[number];

  if (snapshots.length === 0) return [];

  // Joint les weekNumbers pour le tri + l'affichage.
  const weekIds = (snapshots as SnapshotRow[]).map((s) => s.weekId);
  const weeks = await prisma.nflWeek.findMany({
    where: { id: { in: weekIds } },
    select: { id: true, weekNumber: true },
  });
  type WeekRow = (typeof weeks)[number];
  const numByWeek = new Map(
    (weeks as WeekRow[]).map((w) => [w.id, w.weekNumber] as const),
  );

  return (snapshots as SnapshotRow[])
    .map((s) => ({
      weekId: s.weekId,
      weekNumber: numByWeek.get(s.weekId) ?? 0,
      value: s.value,
      sppAtSnapshot: s.sppAtSnapshot,
    }))
    .sort((a, b) => a.weekNumber - b.weekNumber);
}
