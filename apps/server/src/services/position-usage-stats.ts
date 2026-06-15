/**
 * Statistiques d'usage par position de roster, agrégées depuis les équipes
 * réelles des coachs (`TeamPlayer`).
 *
 * Honnêteté des données : il n'existe pas de lien propre entre les
 * événements de match et le slug de position (cf. exploration B.3), donc on
 * ne calcule **pas** de win-rate. On expose ce qui est fiable et directement
 * agrégeable : le nombre de joueurs créés à chaque poste et leurs **moyennes
 * carrière** (SPP, TD, sorties/casualties, MVP) issues des compteurs cumulés
 * de `TeamPlayer`. Agrégat en un seul `groupBy` (pas de N+1, pas de scan de
 * replays) → mémoïsable, pas de table snapshot.
 *
 * Les stats sont indexées par `displayName` (la chaîne stockée sur
 * `TeamPlayer.position`), que l'appelant relie à un slug de position.
 */

import { prisma } from "../prisma";

export interface PositionUsage {
  /** Nombre de joueurs créés à ce poste (toutes équipes de coachs confondues). */
  count: number;
  /** Total de matchs joués par ces joueurs (contexte des moyennes). */
  matchesPlayed: number;
  /** Moyennes carrière par joueur (1 décimale). */
  avgSpp: number;
  avgTouchdowns: number;
  avgCasualties: number;
  avgMvp: number;
}

export interface RosterPositionStats {
  /** Indexé par `displayName` de position. */
  byPosition: Record<string, PositionUsage>;
  /** Total de joueurs créés pour ce roster (dénominateur de part d'usage). */
  totalPlayers: number;
}

interface GroupRow {
  position: string;
  _count: { _all: number };
  _sum: {
    spp: number | null;
    totalTouchdowns: number | null;
    totalCasualties: number | null;
    totalMvpAwards: number | null;
    matchesPlayed: number | null;
  };
}

/** Moyenne arrondie à une décimale, sûre face à une division par zéro. */
function avgPerPlayer(sum: number | null | undefined, count: number): number {
  if (count <= 0) return 0;
  return Math.round(((sum ?? 0) / count) * 10) / 10;
}

export async function getRosterPositionStats(
  rosterSlug: string,
  ruleset: string,
): Promise<RosterPositionStats> {
  const groups = (await prisma.teamPlayer.groupBy({
    by: ["position"],
    where: { team: { roster: rosterSlug, ruleset } },
    _count: { _all: true },
    _sum: {
      spp: true,
      totalTouchdowns: true,
      totalCasualties: true,
      totalMvpAwards: true,
      matchesPlayed: true,
    },
  })) as GroupRow[];

  const byPosition: Record<string, PositionUsage> = {};
  let totalPlayers = 0;
  for (const g of groups) {
    const count = g._count._all;
    totalPlayers += count;
    byPosition[g.position] = {
      count,
      matchesPlayed: g._sum.matchesPlayed ?? 0,
      avgSpp: avgPerPlayer(g._sum.spp, count),
      avgTouchdowns: avgPerPlayer(g._sum.totalTouchdowns, count),
      avgCasualties: avgPerPlayer(g._sum.totalCasualties, count),
      avgMvp: avgPerPlayer(g._sum.totalMvpAwards, count),
    };
  }
  return { byPosition, totalPlayers };
}
