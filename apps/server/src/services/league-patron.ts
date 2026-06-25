/**
 * L2.B.5 — "Coup de mecene" : bonus tresorerie ponctuel pour une
 * equipe pendant une saison ligue (max 1 fois par saison).
 *
 * Regle adoptee :
 *   - Bonus fixe de 100k po credit en treasury (param `MECENE_BONUS`).
 *   - Une fois par equipe par saison ligue (`LeagueParticipant.mecenePlayed`).
 *   - Bloque hors saison `in_progress` ou si l'equipe est `withdrawn`.
 *   - Bloque pendant un match en cours pour eviter les conflits avec
 *     les inducements / pre-match flow.
 *
 * Service pur (pas de fetch session / pas de res). Les routes appellent
 * `playMecene` et formattent la reponse.
 */

import type { PrismaClient } from "@prisma/client";

export const MECENE_BONUS = 100_000;

export class LeaguePatronError extends Error {
  constructor(
    public readonly code:
      | "season_not_found"
      | "team_not_found"
      | "team_not_in_season"
      | "season_not_active"
      | "mecene_disabled"
      | "withdrawn"
      | "already_played"
      | "match_in_progress",
    message: string,
  ) {
    super(message);
    this.name = "LeaguePatronError";
  }
}

export interface PlayMeceneInput {
  prisma: PrismaClient;
  seasonId: string;
  teamId: string;
}

export interface PlayMeceneResult {
  participantId: string;
  bonus: number;
  newTreasury: number;
  playedAt: Date;
}

export async function playMecene(
  input: PlayMeceneInput,
): Promise<PlayMeceneResult> {
  const { prisma, seasonId, teamId } = input;

  const season = await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, status: true, meceneEnabled: true },
  });
  if (!season) {
    throw new LeaguePatronError(
      "season_not_found",
      "Saison ligue introuvable",
    );
  }
  if (season.status !== "in_progress") {
    throw new LeaguePatronError(
      "season_not_active",
      "Le coup de mecene n'est disponible que pendant une saison en cours",
    );
  }
  // L2.B.5 — le coup de mecene n'est plus dispo par defaut : le
  // commissaire doit l'activer explicitement sur la saison.
  if (!season.meceneEnabled) {
    throw new LeaguePatronError(
      "mecene_disabled",
      "Le coup de mecene n'est pas active pour cette saison",
    );
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, treasury: true },
  });
  if (!team) {
    throw new LeaguePatronError("team_not_found", "Equipe introuvable");
  }

  const participant = await prisma.leagueParticipant.findUnique({
    where: { seasonId_teamId: { seasonId, teamId } },
    select: {
      id: true,
      status: true,
      mecenePlayed: true,
    },
  });
  if (!participant) {
    throw new LeaguePatronError(
      "team_not_in_season",
      "L'equipe n'est pas inscrite dans cette saison",
    );
  }
  if (participant.status !== "active") {
    throw new LeaguePatronError(
      "withdrawn",
      "L'equipe a quitte cette saison",
    );
  }
  if (participant.mecenePlayed) {
    throw new LeaguePatronError(
      "already_played",
      "Le coup de mecene a deja ete utilise pour cette saison",
    );
  }

  const activeSelection = await prisma.teamSelection.findFirst({
    where: {
      teamId,
      match: { status: { in: ["pending", "active"] } },
    },
    select: { id: true },
  });
  if (activeSelection) {
    throw new LeaguePatronError(
      "match_in_progress",
      "Impossible d'utiliser le coup de mecene pendant un match en cours",
    );
  }

  const playedAt = new Date();
  const newTreasury = team.treasury + MECENE_BONUS;

  await prisma.$transaction([
    prisma.team.update({
      where: { id: teamId },
      data: { treasury: newTreasury },
    }),
    prisma.leagueParticipant.update({
      where: { id: participant.id },
      data: {
        mecenePlayed: true,
        mecenePlayedAt: playedAt,
      },
    }),
  ]);

  return {
    participantId: participant.id,
    bonus: MECENE_BONUS,
    newTreasury,
    playedAt,
  };
}
