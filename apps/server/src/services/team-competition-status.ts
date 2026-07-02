/**
 * Statut d'engagement d'une équipe en compétition.
 *
 * Règle produit : une équipe ne peut être engagée que dans **une seule**
 * compétition active à la fois (coupe OU saison de ligue). Une équipe déjà
 * engagée est indisponible pour toute autre inscription.
 *
 * « Active » = coupe au statut `ouverte`/`en_cours`, ou participation de ligue
 * `active` dans une saison non terminée. Une coupe terminée/archivée ou une
 * saison close libère l'équipe ; un retrait (`withdrawn`) aussi.
 */

import { prisma } from '../prisma';

const ACTIVE_CUP_STATUSES = ['ouverte', 'en_cours'];
const FINISHED_SEASON_STATUSES = ['completed', 'ended'];

export interface TeamEngagement {
  readonly engaged: boolean;
  readonly kind?: 'cup' | 'league';
  /** Nom lisible de la compétition (pour le message d'erreur). */
  readonly name?: string;
}

/**
 * Retourne l'engagement actif d'une équipe, le cas échéant. `opts` permet
 * d'exclure la compétition courante (ex: re-vérification lors d'une inscription
 * à cette même coupe/saison).
 */
export async function getTeamEngagement(
  teamId: string,
  opts?: { excludeCupId?: string; excludeSeasonId?: string },
): Promise<TeamEngagement> {
  const cupParticipation = await prisma.cupParticipant.findFirst({
    where: {
      teamId,
      ...(opts?.excludeCupId ? { cupId: { not: opts.excludeCupId } } : {}),
      cup: { status: { in: ACTIVE_CUP_STATUSES } },
    },
    select: { cup: { select: { name: true } } },
  });
  if (cupParticipation) {
    return { engaged: true, kind: 'cup', name: cupParticipation.cup.name };
  }

  const leagueParticipation = await prisma.leagueParticipant.findFirst({
    where: {
      teamId,
      status: 'active',
      ...(opts?.excludeSeasonId ? { seasonId: { not: opts.excludeSeasonId } } : {}),
      season: { status: { notIn: FINISHED_SEASON_STATUSES } },
    },
    select: {
      season: { select: { name: true, league: { select: { name: true } } } },
    },
  });
  if (leagueParticipation) {
    return {
      engaged: true,
      kind: 'league',
      name: `${leagueParticipation.season.league.name} — ${leagueParticipation.season.name}`,
    };
  }

  return { engaged: false };
}

/** Engagement (coupe/ligue) d'une équipe, pour l'affichage en liste. */
export interface TeamEngagementLabel {
  readonly kind: 'cup' | 'league';
  readonly name: string;
}

/**
 * Version batchée pour un ensemble d'équipes (évite le N+1 en liste). Renvoie
 * une map teamId → engagement actif. La coupe prime sur la ligue si les deux
 * existaient (ne devrait pas arriver vu la garde d'inscription).
 */
export async function getTeamsEngagement(
  teamIds: readonly string[],
): Promise<Map<string, TeamEngagementLabel>> {
  const map = new Map<string, TeamEngagementLabel>();
  if (teamIds.length === 0) return map;

  const cups = await prisma.cupParticipant.findMany({
    where: { teamId: { in: [...teamIds] }, cup: { status: { in: ACTIVE_CUP_STATUSES } } },
    select: { teamId: true, cup: { select: { name: true } } },
  });
  for (const c of cups) {
    if (!map.has(c.teamId)) map.set(c.teamId, { kind: 'cup', name: c.cup.name });
  }

  const leagues = await prisma.leagueParticipant.findMany({
    where: {
      teamId: { in: [...teamIds] },
      status: 'active',
      season: { status: { notIn: FINISHED_SEASON_STATUSES } },
    },
    select: {
      teamId: true,
      season: { select: { name: true, league: { select: { name: true } } } },
    },
  });
  for (const l of leagues) {
    if (!map.has(l.teamId)) {
      map.set(l.teamId, {
        kind: 'league',
        name: `${l.season.league.name} — ${l.season.name}`,
      });
    }
  }

  return map;
}
