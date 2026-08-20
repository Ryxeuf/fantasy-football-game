/**
 * Handlers de l'image d'un joueur d'équipe.
 *
 * `POST /team/:id/players/:playerId/image` — corps = binaire brut de
 * l'image (pas de multipart), comme le logo d'équipe. Le type réel est
 * détecté par magic bytes et le nom de fichier régénéré côté serveur.
 * `DELETE /team/:id/players/:playerId/image` — retire l'image (retour aux
 * initiales programmatiques).
 *
 * Réservé au coach propriétaire de l'équipe (authUser + ownership à deux
 * niveaux dans le service) : pas de schéma Zod ici, le corps n'est pas du
 * JSON.
 */

import { raw } from "express";
import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authUser";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import {
  setPlayerImage,
  clearPlayerImage,
  PlayerImageError,
} from "../services/player-image";
import { MAX_PLAYER_IMAGE_BYTES } from "../utils/player-image-upload";

/**
 * Parse le corps brut (n'importe quel Content-Type) en Buffer, plafonné à
 * `MAX_PLAYER_IMAGE_BYTES`. Renvoie une erreur JSON propre au lieu de
 * laisser fuiter la stack du handler d'erreur Express.
 */
const rawImageParser = raw({ type: () => true, limit: MAX_PLAYER_IMAGE_BYTES });
export function parseRawPlayerImage(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  rawImageParser(req, res, (err: unknown) => {
    if (err) {
      if ((err as { type?: string }).type === "entity.too.large") {
        sendError(res, "Image trop volumineuse (max 2 Mo)", 413);
        return;
      }
      sendError(res, "Corps de requête invalide", 400);
      return;
    }
    next();
  });
}

function handleImageError(
  res: Response,
  error: unknown,
  context: string,
): void {
  if (error instanceof PlayerImageError) {
    switch (error.code) {
      case "NOT_FOUND":
        sendError(res, error.message, 404);
        return;
      case "EMPTY":
        sendError(res, error.message, 400);
        return;
      case "UNSUPPORTED_TYPE":
        sendError(res, error.message, 415);
        return;
    }
  }
  serverLog.error(`[player-image] ${context} failed`, error);
  sendError(res, "Erreur lors de la mise à jour de l'image du joueur", 500);
}

export async function handleUploadPlayerImage(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    // Corps binaire : pas de schéma Zod possible ici (le body n'est pas du
    // JSON). On narrow par `Buffer.isBuffer` plutôt que par un cast, pour
    // rester conforme à la garde `no-raw-body-cast`.
    const body: unknown = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      sendError(res, "Aucune donnée binaire reçue", 400);
      return;
    }
    const result = await setPlayerImage({
      teamId: req.params.id,
      playerId: req.params.playerId,
      ownerId: req.user!.id,
      body,
    });
    sendSuccess(res, result, 201);
  } catch (error: unknown) {
    handleImageError(res, error, "upload");
  }
}

export async function handleDeletePlayerImage(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const result = await clearPlayerImage({
      teamId: req.params.id,
      playerId: req.params.playerId,
      ownerId: req.user!.id,
    });
    sendSuccess(res, result);
  } catch (error: unknown) {
    handleImageError(res, error, "delete");
  }
}
