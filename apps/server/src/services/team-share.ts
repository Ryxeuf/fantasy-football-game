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
import { ACTIVE_PLAYER_WHERE } from "./player-status";

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

/**
 * Aperçu minimal d'une équipe partagée, résolu par son **id** et non par
 * son token.
 *
 * Sert la metadata de la fiche `/me/teams/:id` : quand un coach colle ce
 * lien dans un salon, le scraper n'a que l'id sous la main. On ne réutilise
 * pas `getPublicTeamByToken` (mauvaise clé) et on n'ouvre pas la lecture
 * complète par id : l'aperçu n'a besoin ni de la trésorerie, ni du détail
 * des joueurs, ni de leurs compétences, donc la route ne les rend pas.
 *
 * Même porte que le partage : `isPublic` est obligatoire. Une équipe
 * privée est un `null`, indiscernable d'une équipe inexistante — le
 * partage reste opt-in.
 */
export interface PublicTeamPreview {
  readonly id: string;
  readonly name: string;
  readonly roster: string;
  readonly ruleset: string;
  readonly teamValue: number;
  readonly playerCount: number;
  readonly starPlayerNames: readonly string[];
  readonly logoUrl: string | null;
  readonly description: string | null;
  /** Permet de pointer l'aperçu vers la page réellement consultable. */
  readonly shareToken: string | null;
}

export async function getPublicTeamPreviewById(
  teamId: string,
): Promise<PublicTeamPreview | null> {
  if (!teamId) return null;
  const team = await prisma.team.findFirst({
    where: { id: teamId, isPublic: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      roster: true,
      ruleset: true,
      teamValue: true,
      logoUrl: true,
      description: true,
      shareToken: true,
      // Aucun joueur n'est exposé un par un : seul l'effectif encore AU
      // ROSTER compte pour l'aperçu, d'où le filtre canonique (morts ET
      // licenciés) plutôt qu'un `dead: false` qui laisserait un licencié
      // gonfler le compte.
      players: { where: ACTIVE_PLAYER_WHERE, select: { id: true } },
      starPlayers: { select: { starPlayerSlug: true } },
    },
  });
  if (!team) return null;

  return {
    id: team.id,
    name: team.name,
    roster: team.roster,
    ruleset: String(team.ruleset),
    teamValue: team.teamValue,
    playerCount: team.players.length,
    starPlayerNames: team.starPlayers.map(
      (sp: { starPlayerSlug: string }) => sp.starPlayerSlug,
    ),
    logoUrl: team.logoUrl ?? null,
    description: team.description ?? null,
    shareToken: team.shareToken ?? null,
  };
}
