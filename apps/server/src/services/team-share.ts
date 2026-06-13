/**
 * Service de partage public opt-in d'une équipe (boucle d'acquisition).
 *
 * Le coach active le partage de SON équipe : on génère (une fois) un
 * `shareToken` non-devinable et on passe `isPublic = true`. Le lien
 * public en lecture seule est alors résolu par `getPublicTeamByToken`.
 * Désactiver remet `isPublic = false` mais conserve le token : le même
 * lien refonctionnera à la réactivation.
 *
 * Conforme aux conventions du repo : on importe `prisma` directement
 * et les tests le remplacent via `vi.mock("../prisma", ...)`.
 */

import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

export class TeamShareError extends Error {
  constructor(
    public readonly code: "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "TeamShareError";
  }
}

export interface TeamShareResult {
  readonly isPublic: boolean;
  /** `null` quand le partage est désactivé (on n'expose pas le token). */
  readonly shareToken: string | null;
}

/** Équipe publique avec son roster (joueurs + Star Players). */
export type PublicTeam = Prisma.TeamGetPayload<{
  include: { players: true; starPlayers: true };
}>;

/** Token de partage non-devinable (128 bits). */
export function generateShareToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export async function setTeamShare(params: {
  teamId: string;
  ownerId: string;
  enabled: boolean;
}): Promise<TeamShareResult> {
  const { teamId, ownerId, enabled } = params;

  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId },
    select: { id: true, shareToken: true },
  });
  if (!team) {
    throw new TeamShareError("NOT_FOUND", "Équipe introuvable");
  }

  const shareToken = enabled
    ? (team.shareToken ?? generateShareToken())
    : team.shareToken;

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: { isPublic: enabled, shareToken },
    select: { isPublic: true, shareToken: true },
  });

  return {
    isPublic: updated.isPublic,
    shareToken: updated.isPublic ? updated.shareToken : null,
  };
}

export async function getPublicTeamByToken(
  token: string,
): Promise<PublicTeam | null> {
  if (!token) return null;
  const team = await prisma.team.findFirst({
    where: { shareToken: token, isPublic: true },
    include: { players: true, starPlayers: true },
  });
  return team;
}
