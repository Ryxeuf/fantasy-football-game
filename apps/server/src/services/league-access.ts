/**
 * Visibilité d'une ligue — LA résolution « qui peut lire cette ligue ? ».
 *
 * `League.isPublic = false` veut dire PRIVÉE, pas « non listée mais lisible
 * par lien » : la ligue n'existe que pour son commissaire (créateur), les
 * administrateurs, les coachs inscrits (une équipe dans au moins une saison,
 * cf. `isLeagueParticipant`) et les coachs invités (invitation `pending`).
 * Pour tout autre lecteur, connecté ou non, la ligue est INTROUVABLE (404) :
 * un 403 confirmerait son existence à qui devine un id.
 *
 * Toute lecture d'une ligue par id (détail, saison, classement, calendrier,
 * poules, classements individuels, récap, bracket, feuille de match, rosters,
 * documents officiels) passe par ce module — la règle serait sinon réécrite
 * à chaque endpoint, et divergerait au premier oublié. Les listings
 * (`listLeagues`, `listThemedSeasons`) appliquent la même règle sous forme de
 * filtre `where`.
 */

import { prisma } from "../prisma";
import { isLeagueParticipant } from "./league";

/** Lecteur courant : `userId` null = visiteur anonyme (`optionalAuthUser`). */
export interface LeagueViewer {
  readonly userId: string | null;
  /** Rôle `admin`, vérifié en amont par la route (`hasRole`). */
  readonly isAdmin?: boolean;
}

/** Les trois colonnes qui suffisent à trancher la visibilité. */
export interface LeagueVisibilityRow {
  readonly id: string;
  readonly creatorId: string;
  readonly isPublic: boolean;
}

/** Appartenance du lecteur à la ligue, résolue en base et injectée ici. */
export interface LeagueMembership {
  readonly isParticipant: boolean;
  readonly hasPendingInvitation: boolean;
}

/** `select` Prisma minimal pour charger une `LeagueVisibilityRow`. */
export const LEAGUE_VISIBILITY_SELECT = {
  id: true,
  creatorId: true,
  isPublic: true,
} as const;

const NO_MEMBERSHIP: LeagueMembership = {
  isParticipant: false,
  hasPendingInvitation: false,
};

/**
 * Règle PURE : une ligue publique est lisible de tous ; une ligue privée
 * seulement de son commissaire, d'un admin, d'un coach inscrit ou d'un coach
 * invité en attente. Un visiteur anonyme ne voit jamais une ligue privée.
 */
export function isLeagueVisibleTo(
  league: Pick<LeagueVisibilityRow, "creatorId" | "isPublic">,
  viewer: LeagueViewer,
  membership: LeagueMembership,
): boolean {
  if (league.isPublic) return true;
  if (viewer.isAdmin) return true;
  if (!viewer.userId) return false;
  if (viewer.userId === league.creatorId) return true;
  return membership.isParticipant || membership.hasPendingInvitation;
}

/**
 * Invitation en attente adressée nommément au coach (`inviteeUserId`). Même
 * critère que le listing `listLeagues` : le statut seul, l'expiration étant
 * matérialisée par le balayage qui passe les invitations à `expired`.
 */
export async function hasPendingLeagueInvitation(
  userId: string,
  leagueId: string,
): Promise<boolean> {
  const count = await prisma.leagueInvitation.count({
    where: { leagueId, inviteeUserId: userId, status: "pending" },
  });
  return count > 0;
}

/**
 * Tranche la visibilité d'une ligue DÉJÀ chargée. Les requêtes
 * d'appartenance ne partent que si la règle en a besoin : ligue privée, lecteur
 * connecté qui n'en est ni le commissaire ni un admin.
 */
export async function canViewLeagueRow(
  league: LeagueVisibilityRow,
  viewer: LeagueViewer,
): Promise<boolean> {
  if (isLeagueVisibleTo(league, viewer, NO_MEMBERSHIP)) return true;
  if (!viewer.userId) return false;
  if (await isLeagueParticipant(viewer.userId, league.id)) return true;
  return hasPendingLeagueInvitation(viewer.userId, league.id);
}

/**
 * Charge la ligue ; `null` si elle n'existe pas OU si `viewer` ne doit pas la
 * voir — les deux cas se répondent par le même 404.
 */
export async function findVisibleLeague(
  leagueId: string,
  viewer: LeagueViewer,
): Promise<LeagueVisibilityRow | null> {
  const league = (await prisma.league.findUnique({
    where: { id: leagueId },
    select: LEAGUE_VISIBILITY_SELECT,
  })) as LeagueVisibilityRow | null;
  if (!league) return null;
  return (await canViewLeagueRow(league, viewer)) ? league : null;
}

/** Forme la plus simple : `userId` peut-il lire la ligue `leagueId` ? */
export async function canViewLeague(
  userId: string | null,
  leagueId: string,
  opts: { readonly isAdmin?: boolean } = {},
): Promise<boolean> {
  const league = await findVisibleLeague(leagueId, {
    userId,
    isAdmin: opts.isAdmin,
  });
  return league !== null;
}

/**
 * Même résolution depuis une SAISON : calendrier, classement, poules,
 * classements individuels, récap et bracket sont adressés par `seasonId`.
 */
export async function findVisibleSeasonLeague(
  seasonId: string,
  viewer: LeagueViewer,
): Promise<{ seasonId: string; league: LeagueVisibilityRow } | null> {
  const season = (await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, league: { select: LEAGUE_VISIBILITY_SELECT } },
  })) as { id: string; league: LeagueVisibilityRow } | null;
  if (!season) return null;
  const visible = await canViewLeagueRow(season.league, viewer);
  return visible ? { seasonId: season.id, league: season.league } : null;
}

/**
 * Feuille de match : la rencontre est POLYMORPHE (ligue XOR coupe, cf.
 * `resolveCompetitionPairing`). Vrai seulement quand c'est une rencontre de
 * LIGUE dont la ligue est cachée au lecteur ; une rencontre de coupe ou un id
 * inconnu sont laissés au service, qui a ses propres 404 / 403.
 */
export async function isLeaguePairingHiddenFrom(
  pairingId: string,
  viewer: LeagueViewer,
): Promise<boolean> {
  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: pairingId },
    select: {
      round: {
        select: {
          season: { select: { league: { select: LEAGUE_VISIBILITY_SELECT } } },
        },
      },
    },
  })) as { round: { season: { league: LeagueVisibilityRow } } } | null;
  if (!pairing) return false;
  return !(await canViewLeagueRow(pairing.round.season.league, viewer));
}
