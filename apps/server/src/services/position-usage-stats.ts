/**
 * Statistiques d'usage par position de roster, agrégées depuis les équipes
 * réelles des coachs (`TeamPlayer`).
 *
 * Honnêteté des données : il n'existe pas de lien propre entre les
 * événements de match et le slug de position (cf. exploration B.3), donc on
 * ne calcule **pas** de win-rate. On expose ce qui est fiable et directement
 * agrégeable : le nombre de joueurs créés à chaque poste et leurs **moyennes
 * carrière** (SPP, TD, sorties/casualties, MVP) issues des compteurs cumulés
 * de `TeamPlayer`, plus ce qu'y ajoutent les feuilles validées (coupe, matchs
 * de ligue joués sans évènement — cf. `player-career-stats`). Agrégats sans
 * N+1 ni scan de replays → mémoïsable, pas de table snapshot.
 *
 * Les stats sont indexées par `displayName` (la chaîne stockée sur
 * `TeamPlayer.position`), que l'appelant relie à un slug de position.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import { loadCompetitionCareerAdjustments } from "./player-career-loader";
import type { CompetitionCareerAdjustment } from "./player-career-stats";

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

/** Apport des feuilles (coupe, matchs de ligue sans évènement) par poste. */
export interface PositionCareerExtra {
  matchesPlayed: number;
  touchdowns: number;
  casualties: number;
  mvpAwards: number;
}

/**
 * Regroupe par poste ce que les feuilles validées ajoutent aux compteurs de
 * `TeamPlayer` (cf. `player-career-stats`) : sans lui, les moyennes d'un
 * poste joué surtout en coupe restaient à zéro. PUR.
 */
export function foldCareerExtrasByPosition(
  adjustments: ReadonlyMap<string, CompetitionCareerAdjustment>,
  positionByPlayerId: ReadonlyMap<string, string>,
): Map<string, PositionCareerExtra> {
  const out = new Map<string, PositionCareerExtra>();
  for (const [playerId, adj] of adjustments) {
    const position = positionByPlayerId.get(playerId);
    if (!position) continue;
    const extra = out.get(position) ?? {
      matchesPlayed: 0,
      touchdowns: 0,
      casualties: 0,
      mvpAwards: 0,
    };
    extra.matchesPlayed += adj.leagueMatchesNotPersisted + adj.cup.matchesPlayed;
    extra.touchdowns += adj.cup.touchdowns;
    extra.casualties += adj.cup.casualties;
    extra.mvpAwards += adj.cup.mvpAwards;
    out.set(position, extra);
  }
  return out;
}

/**
 * Apport des feuilles pour toutes les équipes du roster. Best-effort : en
 * cas d'échec, les moyennes se servent sur les seuls compteurs.
 */
async function loadPositionCareerExtras(
  rosterSlug: string,
  ruleset: string,
): Promise<Map<string, PositionCareerExtra>> {
  try {
    const teams = (await prisma.team.findMany({
      where: { roster: rosterSlug, ruleset },
      select: { id: true },
    })) as Array<{ id: string }>;
    const adjustments = await loadCompetitionCareerAdjustments(
      teams.map((t) => t.id),
    );
    if (adjustments.size === 0) return new Map();
    const players = (await prisma.teamPlayer.findMany({
      where: { id: { in: [...adjustments.keys()] } },
      select: { id: true, position: true },
    })) as Array<{ id: string; position: string }>;
    return foldCareerExtrasByPosition(
      adjustments,
      new Map(players.map((p) => [p.id, p.position])),
    );
  } catch (e: unknown) {
    serverLog.error(`[position-usage-stats] carriere des feuilles (${rosterSlug})`, e);
    return new Map();
  }
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

  // Coupe + matchs de ligue sans évènement : absents des compteurs.
  const extras =
    groups.length > 0
      ? await loadPositionCareerExtras(rosterSlug, ruleset)
      : new Map<string, PositionCareerExtra>();

  const byPosition: Record<string, PositionUsage> = {};
  let totalPlayers = 0;
  for (const g of groups) {
    const count = g._count._all;
    const extra = extras.get(g.position);
    totalPlayers += count;
    byPosition[g.position] = {
      count,
      matchesPlayed: (g._sum.matchesPlayed ?? 0) + (extra?.matchesPlayed ?? 0),
      avgSpp: avgPerPlayer(g._sum.spp, count),
      avgTouchdowns: avgPerPlayer(
        (g._sum.totalTouchdowns ?? 0) + (extra?.touchdowns ?? 0),
        count,
      ),
      avgCasualties: avgPerPlayer(
        (g._sum.totalCasualties ?? 0) + (extra?.casualties ?? 0),
        count,
      ),
      avgMvp: avgPerPlayer(
        (g._sum.totalMvpAwards ?? 0) + (extra?.mvpAwards ?? 0),
        count,
      ),
    };
  }
  return { byPosition, totalPlayers };
}
