/**
 * Admin Pro League — actions destructives sur rosters.
 *
 * Ce module est explicitement separe de `pro-roster-generator.ts` car
 * il contient des actions destructives (wipe + re-seed) qui ne doivent
 * etre invoquees que depuis l'admin (jamais depuis un cron ou un
 * service applicatif).
 *
 * Toute mutation est tracee via l'audit log au niveau de la route.
 */

import { prisma } from "../prisma";
import { seedTeamRoster } from "./pro-roster-generator";

export type RosterAdminErrorCode =
  | "TEAM_NOT_FOUND"
  | "ROSTER_NOT_FOUND"
  | "INVALID_INPUT"
  | "ROSTER_HAS_HISTORY";

export class RosterAdminError extends Error {
  constructor(
    public readonly code: RosterAdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RosterAdminError";
  }
}

export interface RegenerateRosterInput {
  readonly teamId: string;
  readonly count: number;
}

export interface RegenerateRosterResult {
  readonly teamId: string;
  readonly deleted: number;
  readonly created: number;
}

/**
 * Wipe complet du roster de l'equipe puis re-seed `count` rookies.
 *
 * Action destructive : tous les joueurs sont supprimes (peu importe
 * leur status). Les match events historiques referencant ces joueurs
 * conservent l'id mais le joueur n'existera plus en DB.
 *
 * Refuse si `count` < 1 ou > 30 (pour eviter les erreurs).
 */
export async function regenerateRoster(
  input: RegenerateRosterInput,
): Promise<RegenerateRosterResult> {
  if (input.count < 1 || input.count > 30) {
    throw new RosterAdminError(
      "INVALID_INPUT",
      "count doit etre entre 1 et 30",
    );
  }

  const team = await prisma.proTeam.findUnique({
    where: { id: input.teamId },
    select: { id: true },
  });
  if (!team) {
    throw new RosterAdminError(
      "TEAM_NOT_FOUND",
      `ProTeam '${input.teamId}' introuvable`,
    );
  }

  const deleteResult = await prisma.proTeamRoster.deleteMany({
    where: { teamId: input.teamId },
  });

  // seedTeamRoster est idempotent et no-op si des joueurs existent ;
  // apres le deleteMany on est garanti a 0, donc le seed va se faire.
  const seedResult = await seedTeamRoster(input.teamId, input.count);

  return {
    teamId: input.teamId,
    deleted: deleteResult.count,
    created: seedResult.created,
  };
}

export interface RetirePlayerResult {
  readonly playerId: string;
  readonly previousStatus: string;
}

/**
 * Set le status d'un joueur a "retired". Action non destructive (le
 * joueur reste en DB pour conserver l'historique career stats), mais
 * le joueur sera exclu des prochains matches.
 *
 * Idempotent : retirer un joueur deja retired no-op.
 */
export async function retirePlayer(
  playerId: string,
): Promise<RetirePlayerResult> {
  const player = await prisma.proTeamRoster.findUnique({
    where: { id: playerId },
    select: { id: true, status: true },
  });
  if (!player) {
    throw new RosterAdminError(
      "ROSTER_NOT_FOUND",
      `ProTeamRoster '${playerId}' introuvable`,
    );
  }

  if (player.status === "retired") {
    return { playerId, previousStatus: "retired" };
  }

  await prisma.proTeamRoster.update({
    where: { id: playerId },
    data: { status: "retired" },
  });

  return { playerId, previousStatus: player.status as string };
}
