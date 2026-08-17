/**
 * Service du logo d'équipe : enregistrement d'un binaire uploadé par le
 * coach propriétaire, et retrait du logo (retour au logo programmatique
 * dérivé du roster côté UI).
 *
 * Les règles de sécurité (type réel par magic bytes, nom de fichier généré
 * côté serveur) sont celles de l'upload d'images du blog, réutilisées ici.
 */

import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../prisma";
import { detectImageType, generateImageFilename } from "../utils/blog-upload";
import {
  buildTeamLogoUrl,
  getTeamLogoUploadDir,
  teamLogoFilenameFromUrl,
} from "../utils/team-logo-upload";
import { serverLog } from "../utils/server-log";

export class TeamLogoError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "EMPTY" | "UNSUPPORTED_TYPE",
    message: string,
  ) {
    super(message);
    this.name = "TeamLogoError";
  }
}

export interface TeamLogoResult {
  readonly logoUrl: string | null;
}

/**
 * Supprime du disque le fichier d'un ancien logo, si (et seulement si) il
 * s'agit bien d'un fichier servi par ce serveur. Best-effort : une erreur
 * ici ne doit jamais faire échouer la mise à jour du logo.
 */
async function removeStoredLogo(url: string | null): Promise<void> {
  const filename = teamLogoFilenameFromUrl(url);
  if (!filename) return;
  try {
    await unlink(path.join(getTeamLogoUploadDir(), filename));
  } catch (e: unknown) {
    // ENOENT est normal (fichier déjà supprimé, volume recréé…).
    const code = (e as { code?: string }).code;
    if (code !== "ENOENT") {
      serverLog.error("[team-logo] suppression de l'ancien logo echouee", e);
    }
  }
}

/**
 * Enregistre le logo d'une équipe. Réservé au propriétaire : la requête
 * échoue en NOT_FOUND si l'équipe n'existe pas ou ne lui appartient pas
 * (on ne distingue pas les deux cas, pas d'énumération d'équipes).
 */
export async function setTeamLogo(params: {
  teamId: string;
  ownerId: string;
  body: Buffer;
}): Promise<TeamLogoResult> {
  const { teamId, ownerId, body } = params;

  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId, deletedAt: null },
    select: { id: true, name: true, logoUrl: true },
  });
  if (!team) throw new TeamLogoError("NOT_FOUND", "Équipe introuvable");

  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw new TeamLogoError("EMPTY", "Aucune donnée binaire reçue");
  }
  const detected = detectImageType(body);
  if (!detected) {
    throw new TeamLogoError(
      "UNSUPPORTED_TYPE",
      "Format non supporté (PNG, JPEG, GIF ou WEBP attendu)",
    );
  }

  const filename = generateImageFilename(team.name, detected.ext);
  const uploadDir = getTeamLogoUploadDir();
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), body);

  const logoUrl = buildTeamLogoUrl(filename);
  await prisma.team.update({ where: { id: teamId }, data: { logoUrl } });

  // Le nouveau logo est en base : l'ancien fichier n'est plus référencé.
  await removeStoredLogo(team.logoUrl);

  return { logoUrl };
}

/** Retire le logo d'une équipe (retour au logo dérivé du roster). */
export async function clearTeamLogo(params: {
  teamId: string;
  ownerId: string;
}): Promise<TeamLogoResult> {
  const { teamId, ownerId } = params;
  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId, deletedAt: null },
    select: { id: true, logoUrl: true },
  });
  if (!team) throw new TeamLogoError("NOT_FOUND", "Équipe introuvable");

  if (team.logoUrl) {
    await prisma.team.update({
      where: { id: teamId },
      data: { logoUrl: null },
    });
    await removeStoredLogo(team.logoUrl);
  }
  return { logoUrl: null };
}
