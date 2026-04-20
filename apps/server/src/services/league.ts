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
  initialElo?: number;
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
    include: { league: { select: { maxParticipants: true } } },
  });
  if (!season) {
    throw new Error(`Saison introuvable: ${input.seasonId}`);
  }
  if (season.status !== "draft" && season.status !== "scheduled") {
    throw new Error(
      `Saison fermee aux inscriptions (status=${season.status}) — saison en cours ou terminee`,
    );
  }

  const team = await prisma.team.findUnique({ where: { id: input.teamId } });
  if (!team) {
    throw new Error(`Equipe introuvable: ${input.teamId}`);
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

  return prisma.leagueParticipant.create({
    data: {
      seasonId: input.seasonId,
      teamId: input.teamId,
      seasonElo: input.initialElo ?? DEFAULT_INITIAL_ELO,
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
