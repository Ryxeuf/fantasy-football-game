/**
 * Contexte d'un appel au blog d'une compétition : la compétition VISIBLE du
 * lecteur (sinon 404, cf. `competition-access`) et ses droits effectifs
 * (`competition-blog-rules`). Tout point d'entrée du blog commence ici.
 *
 * Résolution de la participation du lecteur : `buildViewerRoles` tel quel —
 * édition courante = saison de plus grand numéro (ligue) ou la coupe
 * elle-même, inscription retirée exclue.
 */

import { prisma } from "../prisma";
import {
  competitionNotFoundMessage,
  findVisibleCompetition,
  type CompetitionKind,
  type CompetitionViewer,
  type VisibleCompetition,
} from "./competition-access";
import {
  buildViewerRoles,
  type ViewerParticipation,
} from "./competition-membership";
import {
  blogPermissions,
  type BlogPermissions,
} from "./competition-blog-rules";

export type CompetitionBlogErrorCode =
  | "not_found"
  | "forbidden"
  | "archived"
  | "invalid"
  | "rate_limited";

export class CompetitionBlogError extends Error {
  constructor(
    public readonly code: CompetitionBlogErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CompetitionBlogError";
  }
}

export const BLOG_ERROR_STATUS: Readonly<Record<CompetitionBlogErrorCode, number>> = {
  not_found: 404,
  forbidden: 403,
  archived: 409,
  invalid: 400,
  rate_limited: 429,
};

export interface BlogContext {
  readonly competition: VisibleCompetition;
  readonly viewer: CompetitionViewer;
  readonly perms: BlogPermissions;
  /** Saison la plus récente (ligue) : repère posé sur un article publié. */
  readonly currentSeasonId: string | null;
}

interface CurrentSeason {
  readonly id: string;
  readonly seasonNumber: number;
}

async function currentLeagueSeason(leagueId: string): Promise<CurrentSeason | null> {
  return (await prisma.leagueSeason.findFirst({
    where: { leagueId },
    orderBy: { seasonNumber: "desc" },
    select: { id: true, seasonNumber: true },
  })) as CurrentSeason | null;
}

async function viewerParticipation(
  competition: VisibleCompetition,
  userId: string,
  season: CurrentSeason | null,
): Promise<ViewerParticipation> {
  if (competition.kind === "league") {
    const rows = (await prisma.leagueParticipant.findMany({
      where: { season: { leagueId: competition.id }, team: { ownerId: userId } },
      select: {
        status: true,
        team: { select: { id: true, name: true } },
        season: { select: { seasonNumber: true } },
      },
    })) as Array<{
      status: string;
      team: { id: string; name: string };
      season: { seasonNumber: number };
    }>;
    return buildViewerRoles({
      viewerId: userId,
      creatorId: competition.creatorId,
      currentEdition: season?.seasonNumber ?? null,
      participations: rows.map((r) => ({
        edition: r.season.seasonNumber,
        status: r.status,
        team: r.team,
      })),
    }).participant;
  }
  const rows = (await prisma.cupParticipant.findMany({
    where: { cupId: competition.id, team: { ownerId: userId } },
    select: { team: { select: { id: true, name: true } } },
  })) as Array<{ team: { id: string; name: string } }>;
  return buildViewerRoles({
    viewerId: userId,
    creatorId: competition.creatorId,
    currentEdition: 1,
    participations: rows.map((r) => ({ edition: 1, status: "active", team: r.team })),
  }).participant;
}

/**
 * Compétition visible + droits du lecteur. Lève `not_found` (404) si la
 * compétition n'existe pas ou est cachée au lecteur.
 */
export async function resolveBlogContext(
  kind: CompetitionKind,
  competitionId: string,
  viewer: CompetitionViewer,
): Promise<BlogContext> {
  const competition = await findVisibleCompetition(kind, competitionId, viewer);
  if (!competition) {
    throw new CompetitionBlogError("not_found", competitionNotFoundMessage(kind));
  }
  const season = kind === "league" ? await currentLeagueSeason(competition.id) : null;
  const participant = viewer.userId
    ? await viewerParticipation(competition, viewer.userId, season)
    : null;
  const perms = blogPermissions({
    userId: viewer.userId,
    isAdmin: !!viewer.isAdmin,
    isCommissioner: !!viewer.userId && viewer.userId === competition.creatorId,
    participant,
    archived: competition.archived,
  });
  return { competition, viewer, perms, currentSeasonId: season?.id ?? null };
}

/** Lève `archived` (409) ou `forbidden` (403) selon le droit demandé. */
export function assertAllowed(ctx: BlogContext, allowed: boolean, what: string): void {
  if (allowed) return;
  if (ctx.competition.archived && (ctx.perms.isMember || ctx.viewer.isAdmin)) {
    throw new CompetitionBlogError(
      "archived",
      "Competition archivee : le blog est en lecture seule",
    );
  }
  throw new CompetitionBlogError(
    "forbidden",
    `Reserve aux membres de la competition (${what})`,
  );
}

/**
 * Membres à notifier : commissaire + propriétaires d'une équipe engagée dans
 * l'édition courante (inscription retirée exclue).
 */
export async function listBlogMemberIds(competition: VisibleCompetition): Promise<string[]> {
  const ids = new Set<string>([competition.creatorId]);
  if (competition.kind === "league") {
    const season = await currentLeagueSeason(competition.id);
    if (season) {
      const rows = (await prisma.leagueParticipant.findMany({
        where: { seasonId: season.id, status: { not: "withdrawn" } },
        select: { team: { select: { ownerId: true } } },
      })) as Array<{ team: { ownerId: string } }>;
      for (const r of rows) ids.add(r.team.ownerId);
    }
  } else {
    const rows = (await prisma.cupParticipant.findMany({
      where: { cupId: competition.id },
      select: { team: { select: { ownerId: true } } },
    })) as Array<{ team: { ownerId: string } }>;
    for (const r of rows) ids.add(r.team.ownerId);
  }
  return [...ids];
}

/** Clé de FK d'un article selon la famille de compétition. */
export function competitionFk(competition: Pick<VisibleCompetition, "kind" | "id">) {
  return competition.kind === "league"
    ? { leagueId: competition.id }
    : { cupId: competition.id };
}

/** Adresse web d'un article (notifications, liens). */
export function blogPostPath(kind: CompetitionKind, competitionId: string, postId: string): string {
  return `${kind === "league" ? "/leagues" : "/cups"}/${competitionId}/blog/${postId}`;
}
