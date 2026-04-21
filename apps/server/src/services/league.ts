/**
 * L.1 — Service de ligue : League, LeagueSeason, LeagueParticipant,
 * LeagueRound.
 *
 * Fournit les operations de base utilisees par les routes API (L.3)
 * et le generateur de calendrier round-robin (L.4).
 *
 * Les regles metier validees ici :
 * - Un nom de ligue ne peut etre vide.
 * - `maxParticipants` doit etre >= 2 (un tournoi a besoin de >= 2 equipes).
 * - Le numero de saison est attribue automatiquement (1, 2, 3...).
 * - Les participants ne peuvent s'inscrire que sur une saison en status
 *   "draft" ou "scheduled", jamais sur une saison en cours ou terminee.
 * - Une equipe ne peut s'inscrire deux fois sur la meme saison.
 * - Les journees (rounds) sont numerotees a partir de 1.
 */

import { prisma } from "../prisma";
import { deriveSeasonEloFromGlobal } from "./season-elo";

export type LeagueStatus =
  | "draft"
  | "open"
  | "in_progress"
  | "completed"
  | "archived";

export type LeagueSeasonStatus =
  | "draft"
  | "scheduled"
  | "in_progress"
  | "completed";

export type LeagueRoundStatus = "pending" | "in_progress" | "completed";

export type LeagueParticipantStatus = "active" | "withdrawn";

export interface CreateLeagueInput {
  creatorId: string;
  name: string;
  description?: string | null;
  ruleset?: "season_2" | "season_3";
  isPublic?: boolean;
  maxParticipants?: number;
  allowedRosters?: string[] | null;
  winPoints?: number;
  drawPoints?: number;
  lossPoints?: number;
  forfeitPoints?: number;
}

export interface CreateSeasonInput {
  leagueId: string;
  name: string;
  seasonNumber?: number;
  startDate?: Date | null;
  endDate?: Date | null;
}

export interface AddParticipantInput {
  seasonId: string;
  teamId: string;
  /**
   * L.8 — valeur initiale explicite. Prioritaire sur le soft-reset.
   */
  initialElo?: number;
  /**
   * L.8 — si true, seed `seasonElo` en appliquant un soft-reset depuis
   * `User.eloRating` du proprietaire de l'equipe (compression vers 1000).
   * Ignore si `initialElo` est fourni.
   */
  carryOverFromGlobal?: boolean;
}

export interface CreateRoundInput {
  seasonId: string;
  roundNumber: number;
  name?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
}

export interface ListLeaguesFilter {
  creatorId?: string;
  status?: LeagueStatus;
  publicOnly?: boolean;
}

const DEFAULT_INITIAL_ELO = 1000;

function ensureNonEmptyName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new Error("Le nom de la ligue est obligatoire");
  }
}

function ensureValidMaxParticipants(maxParticipants: number): void {
  if (!Number.isInteger(maxParticipants) || maxParticipants < 2) {
    throw new Error(
      "maxParticipants doit etre un entier >= 2 (au moins deux participants)",
    );
  }
}

export async function createLeague(input: CreateLeagueInput) {
  ensureNonEmptyName(input.name);
  const maxParticipants = input.maxParticipants ?? 16;
  ensureValidMaxParticipants(maxParticipants);

  const allowedRosters =
    input.allowedRosters && input.allowedRosters.length > 0
      ? JSON.stringify(input.allowedRosters)
      : null;

  return prisma.league.create({
    data: {
      creatorId: input.creatorId,
      name: input.name.trim(),
      description: input.description ?? null,
      ruleset: input.ruleset ?? "season_3",
      isPublic: input.isPublic ?? true,
      maxParticipants,
      allowedRosters,
      winPoints: input.winPoints ?? 3,
      drawPoints: input.drawPoints ?? 1,
      lossPoints: input.lossPoints ?? 0,
      forfeitPoints: input.forfeitPoints ?? -1,
    },
  });
}

export async function createSeason(input: CreateSeasonInput) {
  const league = await prisma.league.findUnique({
    where: { id: input.leagueId },
  });
  if (!league) {
    throw new Error(`Ligue introuvable: ${input.leagueId}`);
  }

  ensureNonEmptyName(input.name);

  let seasonNumber: number;
  if (input.seasonNumber === undefined) {
    const latest = await prisma.leagueSeason.findFirst({
      where: { leagueId: input.leagueId },
      orderBy: { seasonNumber: "desc" },
      select: { seasonNumber: true },
    });
    seasonNumber = (latest?.seasonNumber ?? 0) + 1;
  } else {
    seasonNumber = input.seasonNumber;
  }

  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) {
    throw new Error("seasonNumber doit etre un entier >= 1");
  }

  return prisma.leagueSeason.create({
    data: {
      leagueId: input.leagueId,
      seasonNumber,
      name: input.name.trim(),
      status: "draft",
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    },
  });
}

export async function addParticipant(input: AddParticipantInput) {
  const season = await prisma.leagueSeason.findUnique({
    where: { id: input.seasonId },
    include: {
      league: { select: { maxParticipants: true, allowedRosters: true } },
    },
  });
  if (!season) {
    throw new Error(`Saison introuvable: ${input.seasonId}`);
  }
  if (season.status !== "draft" && season.status !== "scheduled") {
    throw new Error(
      `Saison fermee aux inscriptions (status=${season.status}) — saison en cours ou terminee`,
    );
  }

  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    include: { owner: { select: { eloRating: true } } },
  });
  if (!team) {
    throw new Error(`Equipe introuvable: ${input.teamId}`);
  }

  // L.9 — invariant metier de la ligue "Open 5 Teams" : une saison peut
  // restreindre les rosters autorises. On enforce la restriction ici
  // (source de verite) pour que les seeders, scripts admin et le handler
  // HTTP beneficient tous de la meme garantie.
  const allowed = parseAllowedRosters(
    (season as { league: { allowedRosters: string | null } }).league
      .allowedRosters ?? null,
  );
  const teamRoster = (team as { roster?: string }).roster;
  if (allowed && teamRoster && !allowed.includes(teamRoster)) {
    throw new Error(
      `Roster ${teamRoster} non autorise sur cette saison (autorises: ${allowed.join(", ")})`,
    );
  }

  const existing = await prisma.leagueParticipant.findUnique({
    where: {
      seasonId_teamId: { seasonId: input.seasonId, teamId: input.teamId },
    },
  });
  if (existing) {
    throw new Error("Cette equipe est deja inscrite sur la saison");
  }

  const currentCount = await prisma.leagueParticipant.count({
    where: { seasonId: input.seasonId },
  });
  const maxParticipants = season.league?.maxParticipants ?? 16;
  if (currentCount >= maxParticipants) {
    throw new Error(
      `La saison est complete (${currentCount}/${maxParticipants} participants)`,
    );
  }

  // L.8 — determination du seasonElo de depart. Priorite :
  //   1. initialElo (valeur explicite d'admin/test)
  //   2. soft-reset depuis l'ELO global si demande
  //   3. DEFAULT_INITIAL_ELO (1000) — reset dur, identique a aujourd'hui.
  let seasonElo = DEFAULT_INITIAL_ELO;
  if (typeof input.initialElo === "number") {
    seasonElo = input.initialElo;
  } else if (input.carryOverFromGlobal) {
    const ownerElo = (team as { owner?: { eloRating?: number } | null }).owner
      ?.eloRating;
    if (typeof ownerElo === "number") {
      seasonElo = deriveSeasonEloFromGlobal(ownerElo);
    }
  }

  return prisma.leagueParticipant.create({
    data: {
      seasonId: input.seasonId,
      teamId: input.teamId,
      seasonElo,
      status: "active",
    },
  });
}

export async function createRound(input: CreateRoundInput) {
  if (!Number.isInteger(input.roundNumber) || input.roundNumber < 1) {
    throw new Error("Le numero de round (journee) doit etre un entier positif");
  }

  const season = await prisma.leagueSeason.findUnique({
    where: { id: input.seasonId },
  });
  if (!season) {
    throw new Error(`Saison introuvable: ${input.seasonId}`);
  }

  return prisma.leagueRound.create({
    data: {
      seasonId: input.seasonId,
      roundNumber: input.roundNumber,
      name: input.name ?? null,
      status: "pending",
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    },
  });
}

export async function listLeagues(filter: ListLeaguesFilter) {
  const where: Record<string, unknown> = {};
  if (filter.publicOnly !== false) {
    where.isPublic = true;
  }
  if (filter.creatorId) {
    where.creatorId = filter.creatorId;
  }
  if (filter.status) {
    where.status = filter.status;
  }
  return prisma.league.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Parse `allowedRosters` JSON back to a string[] (or null when unrestricted).
 * Kept here so routes and scoring code share a single source of truth.
 */
export function parseAllowedRosters(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      return parsed as string[];
    }
    return null;
  } catch {
    return null;
  }
}

export interface StandingRow {
  participantId: string;
  teamId: string;
  teamName: string;
  roster: string;
  ownerId: string;
  coachName: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  touchdownsFor: number;
  touchdownsAgainst: number;
  touchdownDifference: number;
  casualtiesFor: number;
  casualtiesAgainst: number;
  seasonElo: number;
  status: LeagueParticipantStatus;
}

/**
 * Classement d'une saison (L.3 standings). Trie selon :
 *   points DESC → diff TD DESC → TD pour DESC → ELO DESC → nom ASC.
 * Cette methode lit les compteurs materialises sur `LeagueParticipant`
 * (mis a jour par L.7 : integration match -> ligue).
 */
export async function computeSeasonStandings(
  seasonId: string,
): Promise<StandingRow[]> {
  const season = await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: { id: true },
  });
  if (!season) {
    throw new Error(`Saison introuvable: ${seasonId}`);
  }

  const participants = await prisma.leagueParticipant.findMany({
    where: { seasonId },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          roster: true,
          owner: { select: { id: true, coachName: true } },
        },
      },
    },
  });

  type ParticipantRow = (typeof participants)[number];
  const rows: StandingRow[] = participants.map((p: ParticipantRow) => ({
    participantId: p.id,
    teamId: p.teamId,
    teamName: p.team.name,
    roster: p.team.roster,
    ownerId: p.team.owner.id,
    coachName: p.team.owner.coachName ?? null,
    played: p.wins + p.draws + p.losses,
    wins: p.wins,
    draws: p.draws,
    losses: p.losses,
    points: p.points,
    touchdownsFor: p.touchdownsFor,
    touchdownsAgainst: p.touchdownsAgainst,
    touchdownDifference: p.touchdownsFor - p.touchdownsAgainst,
    casualtiesFor: p.casualtiesFor,
    casualtiesAgainst: p.casualtiesAgainst,
    seasonElo: p.seasonElo,
    status: p.status as LeagueParticipantStatus,
  }));

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.touchdownDifference !== a.touchdownDifference) {
      return b.touchdownDifference - a.touchdownDifference;
    }
    if (b.touchdownsFor !== a.touchdownsFor) {
      return b.touchdownsFor - a.touchdownsFor;
    }
    if (b.seasonElo !== a.seasonElo) return b.seasonElo - a.seasonElo;
    return a.teamName.localeCompare(b.teamName);
  });

  return rows;
}

export async function getLeagueById(leagueId: string) {
  return prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      creator: { select: { id: true, coachName: true, email: true } },
      seasons: { orderBy: { seasonNumber: "asc" } },
    },
  });
}

export async function getSeasonById(seasonId: string) {
  return prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    include: {
      league: true,
      rounds: { orderBy: { roundNumber: "asc" } },
      participants: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              roster: true,
              owner: { select: { id: true, coachName: true } },
            },
          },
        },
      },
    },
  });
}

/**
 * Withdraw une equipe d'une saison : refuse si la saison est terminee
 * ou si l'equipe n'est pas inscrite.
 */
export async function withdrawParticipant(input: {
  seasonId: string;
  teamId: string;
}) {
  const season = await prisma.leagueSeason.findUnique({
    where: { id: input.seasonId },
    select: { id: true, status: true },
  });
  if (!season) {
    throw new Error(`Saison introuvable: ${input.seasonId}`);
  }
  if (season.status === "completed") {
    throw new Error("Saison terminee : impossible de retirer une equipe");
  }

  const existing = await prisma.leagueParticipant.findUnique({
    where: {
      seasonId_teamId: { seasonId: input.seasonId, teamId: input.teamId },
    },
  });
  if (!existing) {
    throw new Error("Cette equipe n'est pas inscrite sur la saison");
  }

  return prisma.leagueParticipant.update({
    where: { id: existing.id },
    data: { status: "withdrawn" },
  });
}
