/**
 * Service de l'image d'un joueur d'équipe : enregistrement d'un binaire
 * uploadé par le coach propriétaire, et retrait (retour aux initiales
 * programmatiques côté UI).
 *
 * Miroir du logo d'équipe (`services/team-logo.ts`) avec deux différences :
 *  - l'ownership est vérifié à DEUX niveaux (le joueur doit appartenir à
 *    l'équipe, l'équipe au coach) ;
 *  - formats restreints à PNG/JPEG : la pleine résolution alimente
 *    l'export de la carte joueur (`/api/player-card`, rendu satori) qui ne
 *    décode pas le WEBP — on refuse à l'upload plutôt que de casser
 *    l'export plus tard.
 */

import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../prisma";
import { detectImageType, generateImageFilename } from "../utils/blog-upload";
import {
  buildPlayerImageUrl,
  getPlayerImageUploadDir,
  playerImageFilenameFromUrl,
} from "../utils/player-image-upload";
import { serverLog } from "../utils/server-log";

export class PlayerImageError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "EMPTY" | "UNSUPPORTED_TYPE",
    message: string,
  ) {
    super(message);
    this.name = "PlayerImageError";
  }
}

export interface PlayerImageResult {
  readonly imageUrl: string | null;
}

/**
 * Supprime du disque le fichier d'une ancienne image, si (et seulement si)
 * il s'agit bien d'un fichier servi par ce serveur. Best-effort : une
 * erreur ici ne doit jamais faire échouer la mise à jour.
 */
async function removeStoredImage(url: string | null): Promise<void> {
  const filename = playerImageFilenameFromUrl(url);
  if (!filename) return;
  try {
    await unlink(path.join(getPlayerImageUploadDir(), filename));
  } catch (e: unknown) {
    // ENOENT est normal (fichier déjà supprimé, volume recréé…).
    const code = (e as { code?: string }).code;
    if (code !== "ENOENT") {
      serverLog.error(
        "[player-image] suppression de l'ancienne image echouee",
        e,
      );
    }
  }
}

/**
 * Charge le joueur en vérifiant l'ownership à deux niveaux : le joueur
 * appartient à l'équipe demandée ET l'équipe au coach. NOT_FOUND sans
 * distinguer les cas (pas d'énumération).
 */
async function loadOwnedPlayer(params: {
  teamId: string;
  playerId: string;
  ownerId: string;
}): Promise<{ id: string; name: string; imageUrl: string | null }> {
  const player = (await prisma.teamPlayer.findFirst({
    where: {
      id: params.playerId,
      teamId: params.teamId,
      team: { ownerId: params.ownerId, deletedAt: null },
    },
    select: { id: true, name: true, imageUrl: true },
  })) as { id: string; name: string; imageUrl: string | null } | null;
  if (!player) throw new PlayerImageError("NOT_FOUND", "Joueur introuvable");
  return player;
}

/**
 * Enregistre l'image d'un joueur. Réservée au coach propriétaire de
 * l'équipe. PNG/JPEG uniquement (cf. en-tête).
 */
export async function setPlayerImage(params: {
  teamId: string;
  playerId: string;
  ownerId: string;
  body: Buffer;
}): Promise<PlayerImageResult> {
  const player = await loadOwnedPlayer(params);

  if (!Buffer.isBuffer(params.body) || params.body.length === 0) {
    throw new PlayerImageError("EMPTY", "Aucune donnée binaire reçue");
  }
  const detected = detectImageType(params.body);
  if (!detected || (detected.ext !== "png" && detected.ext !== "jpg")) {
    throw new PlayerImageError(
      "UNSUPPORTED_TYPE",
      "Format non supporté (PNG ou JPEG attendu — l'export de carte ne lit pas le WEBP/GIF)",
    );
  }

  const filename = generateImageFilename(player.name, detected.ext);
  const uploadDir = getPlayerImageUploadDir();
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), params.body);

  const imageUrl = buildPlayerImageUrl(filename);
  await prisma.teamPlayer.update({
    where: { id: player.id },
    data: { imageUrl },
  });

  // La nouvelle image est en base : l'ancien fichier n'est plus référencé.
  await removeStoredImage(player.imageUrl);

  return { imageUrl };
}

/** Retire l'image d'un joueur (retour aux initiales côté UI). */
export async function clearPlayerImage(params: {
  teamId: string;
  playerId: string;
  ownerId: string;
}): Promise<PlayerImageResult> {
  const player = await loadOwnedPlayer(params);

  if (player.imageUrl) {
    await prisma.teamPlayer.update({
      where: { id: player.id },
      data: { imageUrl: null },
    });
    await removeStoredImage(player.imageUrl);
  }
  return { imageUrl: null };
}
