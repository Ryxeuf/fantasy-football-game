/**
 * Handlers du logo d'équipe.
 *
 * `POST /team/:id/logo` — corps = binaire brut de l'image (pas de
 * multipart), comme l'upload d'images du blog. Le type réel est détecté par
 * magic bytes et le nom de fichier régénéré côté serveur.
 * `DELETE /team/:id/logo` — retire le logo (retour au logo programmatique).
 *
 * Réservé au propriétaire de l'équipe (authUser + filtre `ownerId` dans le
 * service) : pas de schéma Zod ici, le corps n'est pas du JSON.
 */

import { raw } from "express";
import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authUser";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import { setTeamLogo, clearTeamLogo, TeamLogoError } from "../services/team-logo";
import { MAX_TEAM_LOGO_BYTES } from "../utils/team-logo-upload";

/**
 * Parse le corps brut (n'importe quel Content-Type) en Buffer, plafonné à
 * `MAX_TEAM_LOGO_BYTES`. Renvoie une erreur JSON propre au lieu de laisser
 * fuiter la stack du handler d'erreur Express (miroir de `parseRawImage`
 * côté blog).
 */
const rawLogoParser = raw({ type: () => true, limit: MAX_TEAM_LOGO_BYTES });
export function parseRawLogo(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  rawLogoParser(req, res, (err: unknown) => {
    if (err) {
      if ((err as { type?: string }).type === "entity.too.large") {
        sendError(res, "Logo trop volumineux (max 2 Mo)", 413);
        return;
      }
      sendError(res, "Corps de requête invalide", 400);
      return;
    }
    next();
  });
}

function handleLogoError(res: Response, error: unknown, context: string): void {
  if (error instanceof TeamLogoError) {
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
  serverLog.error(`[team-logo] ${context} failed`, error);
  sendError(res, "Erreur lors de la mise à jour du logo", 500);
}

export async function handleUploadTeamLogo(
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
    const result = await setTeamLogo({
      teamId: req.params.id,
      ownerId: req.user!.id,
      body,
    });
    sendSuccess(res, result, 201);
  } catch (error: unknown) {
    handleLogoError(res, error, "upload");
  }
}

export async function handleDeleteTeamLogo(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const result = await clearTeamLogo({
      teamId: req.params.id,
      ownerId: req.user!.id,
    });
    sendSuccess(res, result);
  } catch (error: unknown) {
    handleLogoError(res, error, "delete");
  }
}
