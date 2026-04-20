/**
 * L.2 — Seeder de ligues par defaut (Sprint 17).
 *
 * Amorce la base avec la ligue "Open 5 Teams" decrite dans le backlog
 * (L.9) : un tournoi pret a lancer restreint aux 5 rosters prioritaires
 * (Skaven, Gnome, Lizardmen, Dwarf, Imperial Nobility).
 *
 * Contrats :
 * - Idempotent : relancer `pnpm db:seed` ne duplique ni la ligue, ni la
 *   saison, ni les rounds, ni les inscriptions deja presentes.
 * - Ne touche pas aux ligues/saisons existantes crees par les
 *   utilisateurs.
 * - Si aucune equipe n'existe pour un roster (seed partiel), on ignore
 *   silencieusement l'inscription plutot que de creer une inscription
 *   invalide.
 */

import { prisma } from "../prisma";

export const DEFAULT_LEAGUE_NAME = "Open 5 Teams";

/**
 * Rosters prioritaires du MVP. L'ordre est volontairement stable : il est
 * utilise pour generer les inscriptions deterministes (et donc les tests).
 */
export const PRIORITY_ROSTERS = [
  "skaven",
  "gnome",
  "lizardmen",
  "dwarf",
  "imperial_nobility",
] as const;

const DEFAULT_INITIAL_ELO = 1000;

export interface SeedDefaultLeaguesInput {
  creatorId: string;
}

export async function seedDefaultLeagues(
  input: SeedDefaultLeaguesInput,
): Promise<void> {
  const league = await ensureOpenFiveTeamsLeague(input.creatorId);
  const season = await ensureInitialSeason(league.id);
  await ensureRoundRobinRounds(season.id, PRIORITY_ROSTERS.length);
  await enrollPriorityTeams(season.id);
}

async function ensureOpenFiveTeamsLeague(creatorId: string) {
  const existing = await prisma.league.findFirst({
    where: { name: DEFAULT_LEAGUE_NAME },
  });
  if (existing) {
    return existing;
  }

  const allowedRostersJson = JSON.stringify([...PRIORITY_ROSTERS]);
  return prisma.league.create({
    data: {
      name: DEFAULT_LEAGUE_NAME,
      description:
        "Ligue ouverte restreinte aux 5 rosters prioritaires : Skaven, Gnome, Lizardmen, Dwarf, Imperial Nobility. Calendrier round-robin pret a etre lance par un admin.",
      creatorId,
      ruleset: "season_3",
      status: "draft",
      isPublic: true,
      maxParticipants: Math.max(16, PRIORITY_ROSTERS.length),
      allowedRosters: allowedRostersJson,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      forfeitPoints: -1,
    },
  });
}

async function ensureInitialSeason(leagueId: string) {
  const existing = await prisma.leagueSeason.findFirst({
    where: { leagueId, seasonNumber: 1 },
  });
  if (existing) {
    return existing;
  }
  return prisma.leagueSeason.create({
    data: {
      leagueId,
      seasonNumber: 1,
      name: "Saison 1",
      status: "draft",
    },
  });
}

async function ensureRoundRobinRounds(
  seasonId: string,
  participantCount: number,
): Promise<void> {
  const roundCount = Math.max(participantCount, 1);
  const existing = await prisma.leagueRound.findMany({
    where: { seasonId },
    select: { roundNumber: true },
  });
  const present = new Set(
    existing.map((r: { roundNumber: number }) => r.roundNumber),
  );
  const toCreate: Array<{
    seasonId: string;
    roundNumber: number;
    name: string;
    status: string;
  }> = [];
  for (let n = 1; n <= roundCount; n += 1) {
    if (present.has(n)) continue;
    toCreate.push({
      seasonId,
      roundNumber: n,
      name: `Journee ${n}`,
      status: "pending",
    });
  }
  if (toCreate.length === 0) {
    return;
  }
  await prisma.leagueRound.createMany({ data: toCreate });
}

async function enrollPriorityTeams(seasonId: string): Promise<void> {
  for (const roster of PRIORITY_ROSTERS) {
    const team = await prisma.team.findFirst({
      where: { roster },
      orderBy: { createdAt: "asc" },
    });
    if (!team) continue;
    const existing = await prisma.leagueParticipant.findUnique({
      where: { seasonId_teamId: { seasonId, teamId: team.id } },
    });
    if (existing) continue;
    await prisma.leagueParticipant.create({
      data: {
        seasonId,
        teamId: team.id,
        seasonElo: DEFAULT_INITIAL_ELO,
        status: "active",
      },
    });
  }
}
