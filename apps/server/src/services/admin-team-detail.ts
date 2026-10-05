/**
 * Détail d'équipe pour la console admin (`GET /admin/teams/:id`).
 *
 * La fiche admin doit afficher la MÊME chose que la fiche coach : positions
 * lisibles (et non le slug brut), compétences résolues, Star Players nommés.
 * Les slugs seuls ne suffisent pas — le rendu web a besoin, en plus des
 * `TeamPlayer`, des Star Players enrichis par le catalogue et de la liste des
 * autres équipes du même propriétaire (navigation latérale).
 *
 * L'enrichissement Star Player réutilise `getStarPlayerBySlugDb`, la même
 * source que `GET /team/:id` : un edit admin sur `StarPlayer` se répercute
 * ici sans resync.
 */

import type { Ruleset } from "@bb/game-engine";

import { prisma } from "../prisma";
import { getStarPlayerBySlugDb } from "../utils/star-player-repository";

/** Équipe voisine (même propriétaire), pour le sélecteur de la fiche admin. */
export interface AdminOwnerTeamSummary {
  readonly id: string;
  readonly name: string;
  readonly roster: string;
  readonly ruleset: string;
  readonly teamValue: number;
  readonly currentValue: number;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;
  readonly playerCount: number;
}

/**
 * Les autres équipes d'un coach, la plus récente d'abord. Les équipes
 * soft-deletées SONT incluses (l'admin doit pouvoir les inspecter) mais
 * portent `deletedAt` pour que l'UI les distingue.
 */
export async function listOwnerTeams(
  ownerId: string,
): Promise<AdminOwnerTeamSummary[]> {
  const teams = await prisma.team.findMany({
    where: { ownerId },
    select: {
      id: true,
      name: true,
      roster: true,
      ruleset: true,
      teamValue: true,
      currentValue: true,
      createdAt: true,
      deletedAt: true,
      _count: { select: { players: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  interface OwnerTeamRow {
    id: string;
    name: string;
    roster: string;
    ruleset: unknown;
    teamValue: number;
    currentValue: number;
    createdAt: Date;
    deletedAt: Date | null;
    _count: { players: number };
  }
  return (teams as OwnerTeamRow[]).map((team) => ({
    id: team.id,
    name: team.name,
    roster: team.roster,
    ruleset: String(team.ruleset),
    teamValue: team.teamValue,
    currentValue: team.currentValue,
    createdAt: team.createdAt,
    deletedAt: team.deletedAt,
    playerCount: team._count.players,
  }));
}

/** Ligne `TeamStarPlayer` telle que lue en base (sous-ensemble utilisé). */
export interface TeamStarPlayerRow {
  readonly id: string;
  readonly starPlayerSlug: string;
  readonly cost: number;
  readonly hiredAt: Date;
}

/**
 * Star Players d'une équipe, enrichis du catalogue (nom affichable, carac,
 * compétences, mots-clés). Le catalogue peut être absent (schéma SQLite
 * réduit) ou la ligne inconnue : on retombe alors sur le slug + coût, jamais
 * sur une erreur.
 */
export async function enrichTeamStarPlayers(
  starPlayers: readonly TeamStarPlayerRow[],
  ruleset: Ruleset,
): Promise<Array<Record<string, unknown>>> {
  return Promise.all(
    starPlayers.map(async (sp) => {
      const definition = await getStarPlayerBySlugDb(
        sp.starPlayerSlug,
        ruleset,
      ).catch(() => null);
      return {
        id: sp.id,
        slug: sp.starPlayerSlug,
        cost: sp.cost,
        hiredAt: sp.hiredAt,
        ...(definition ?? {}),
      };
    }),
  );
}

export interface AdminTeamLeagueEntry {
  leagueId: string;
  leagueName: string;
  leagueStatus: string;
  isPublic: boolean;
  seasonId: string;
  seasonName: string;
  seasonNumber: number;
  seasonStatus: string;
  /** Statut de l'inscription (`active`, `withdrawn`…). */
  participantStatus: string;
}

export interface AdminTeamCupEntry {
  cupId: string;
  cupName: string;
  cupStatus: string;
  isPublic: boolean;
}

export interface AdminTeamCompetitions {
  leagues: AdminTeamLeagueEntry[];
  cups: AdminTeamCupEntry[];
}

/**
 * Compétitions auxquelles une équipe est inscrite : une entrée par SAISON de
 * ligue (une équipe peut enchaîner plusieurs saisons d'une même ligue) et
 * une par coupe. Sert les liens de la fiche admin vers les fiches admin des
 * compétitions. Archivées et privées comprises : c'est une vue admin.
 */
export async function listTeamCompetitions(
  teamId: string,
): Promise<AdminTeamCompetitions> {
  const [leagueRows, cupRows] = await Promise.all([
    prisma.leagueParticipant.findMany({
      where: { teamId },
      orderBy: { joinedAt: "desc" },
      select: {
        status: true,
        season: {
          select: {
            id: true,
            name: true,
            seasonNumber: true,
            status: true,
            league: {
              select: { id: true, name: true, status: true, isPublic: true },
            },
          },
        },
      },
    }),
    prisma.cupParticipant.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      select: {
        cup: {
          select: { id: true, name: true, status: true, isPublic: true },
        },
      },
    }),
  ]);
  interface LeagueRow {
    status: string;
    season: {
      id: string;
      name: string;
      seasonNumber: number;
      status: string;
      league: { id: string; name: string; status: string; isPublic: boolean };
    };
  }
  interface CupRow {
    cup: { id: string; name: string; status: string; isPublic: boolean };
  }
  return {
    leagues: (leagueRows as LeagueRow[]).map((r) => ({
      leagueId: r.season.league.id,
      leagueName: r.season.league.name,
      leagueStatus: r.season.league.status,
      isPublic: r.season.league.isPublic,
      seasonId: r.season.id,
      seasonName: r.season.name,
      seasonNumber: r.season.seasonNumber,
      seasonStatus: r.season.status,
      participantStatus: r.status,
    })),
    cups: (cupRows as CupRow[]).map((r) => ({
      cupId: r.cup.id,
      cupName: r.cup.name,
      cupStatus: r.cup.status,
      isPublic: r.cup.isPublic,
    })),
  };
}
