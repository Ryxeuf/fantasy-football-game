/**
 * Routes « documents officiels » d'une competition, cote commissaire.
 *
 * Montees sous `/api/competitions`, elles couvrent les deux familles avec un
 * seul jeu de handlers (`:kind` = `leagues` | `cups`) : la regle metier est la
 * meme des deux cotes, la dupliquer dans `league.ts` et `cup.ts` la ferait
 * fatalement diverger.
 *
 *   GET    /api/competitions/:kind/:competitionId/documents
 *   POST   /api/competitions/:kind/:competitionId/documents      (commissaire | admin)
 *   PATCH  /api/competitions/:kind/:competitionId/documents/:documentId
 *   DELETE /api/competitions/:kind/:competitionId/documents/:documentId
 *
 * L'upload prend le BINAIRE BRUT en corps (pas de multipart, comme l'upload
 * d'images du blog et les logos d'equipe) : le type reel est detecte par magic
 * bytes et le nom de fichier est regenere cote serveur.
 */

import { Router, raw } from "express";
import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";

import { authUser, optionalAuthUser } from "../middleware/authUser";
import type { AuthenticatedRequest } from "../middleware/authUser";
import {
  validate,
  validateParams,
  validateQuery,
} from "../middleware/validate";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import { hasRole } from "../utils/roles";
import { prisma } from "../prisma";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import { MAX_COMPETITION_DOCUMENT_BYTES } from "../utils/competition-document-upload";
import {
  CompetitionDocumentError,
  createCompetitionDocument,
  deleteCompetitionDocument,
  listCompetitionDocuments,
  updateCompetitionDocument,
  type ActorContext,
  type CompetitionKind,
} from "../services/competition-documents";
import {
  competitionDocumentItemParamsSchema,
  competitionDocumentParamsSchema,
  updateCompetitionDocumentSchema,
  uploadCompetitionDocumentQuerySchema,
} from "../schemas/competition-document.schemas";

const router = Router();

/** `leagues` | `cups` (URL) → `league` | `cup` (modele). */
function toKind(segment: string): CompetitionKind {
  return segment === "cups" ? "cup" : "league";
}

/** Acteur derive de la requete (l'admin est reconnu au role porte par le JWT). */
function actorOf(req: AuthenticatedRequest): ActorContext {
  return {
    userId: req.user?.id ?? null,
    isAdmin: hasRole(req.user?.roles ?? [], "admin"),
  };
}

/** Mappe les erreurs typees du service en statuts HTTP. */
function handleDocumentError(
  res: Response,
  error: unknown,
  context: string,
): void {
  if (error instanceof CompetitionDocumentError) {
    switch (error.code) {
      case "competition-not-found":
      case "document-not-found":
        sendError(res, error.message, 404);
        return;
      case "forbidden":
        sendError(res, error.message, 403);
        return;
      case "empty":
        sendError(res, error.message, 400);
        return;
      case "too-large":
        sendError(res, error.message, 413);
        return;
      case "unsupported-type":
        sendError(res, error.message, 415);
        return;
    }
  }
  serverLog.error(`[competition-documents] ${context} failed`, error);
  sendError(res, "Erreur serveur", 500);
}

/**
 * Parse le corps brut (n'importe quel Content-Type) en Buffer, plafonne a
 * 10 Mo. Miroir de `parseRawImage` (blog) / `parseRawLogo` (equipe) : la
 * limite est appliquee par le parser AVANT toute lecture complete en memoire,
 * et le depassement rend un 413 JSON propre plutot que la stack Express.
 */
const rawDocumentParser = raw({
  type: () => true,
  limit: MAX_COMPETITION_DOCUMENT_BYTES,
});
export function parseRawDocument(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  rawDocumentParser(req, res, (err: unknown) => {
    if (err) {
      if ((err as { type?: string }).type === "entity.too.large") {
        sendError(res, "Document trop volumineux (max 10 Mo)", 413);
        return;
      }
      sendError(res, "Corps de requete invalide", 400);
      return;
    }
    next();
  });
}

/** GET — liste des documents officiels de la competition. */
router.get(
  "/:kind/:competitionId/documents",
  optionalAuthUser,
  validateParams(competitionDocumentParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const documents = await listCompetitionDocuments({
        kind: toKind(req.params.kind),
        competitionId: req.params.competitionId,
        actor: actorOf(req),
      });
      sendSuccess(res, { documents });
    } catch (error: unknown) {
      handleDocumentError(res, error, "list");
    }
  },
);

/**
 * POST — depot d'un document officiel. Corps = binaire brut ; metadonnees
 * facultatives en query (`filename`, `title`, `description`).
 */
router.post(
  "/:kind/:competitionId/documents",
  authUser,
  validateParams(competitionDocumentParamsSchema),
  validateQuery(uploadCompetitionDocumentQuerySchema),
  parseRawDocument,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Corps binaire : pas de schema Zod possible (le corps n'est pas du
      // JSON). On narrow par `Buffer.isBuffer` plutot que par un cast, pour
      // rester conforme a la garde `no-raw-body-cast`.
      const body: unknown = req.body;
      if (!Buffer.isBuffer(body)) {
        sendError(res, "Aucune donnee binaire recue", 400);
        return;
      }
      const query = req.query as unknown as z.infer<
        typeof uploadCompetitionDocumentQuerySchema
      >;
      const kind = toKind(req.params.kind);
      const document = await createCompetitionDocument({
        kind,
        competitionId: req.params.competitionId,
        actor: actorOf(req),
        body,
        originalName: query.filename ?? null,
        title: query.title ?? null,
        description: query.description ?? null,
      });
      await safeRecordAdminActionFromRequest(prisma, req, {
        action: "competition-document.upload",
        entity: "CompetitionDocument",
        entityId: document.id,
        newValue: {
          competitionKind: kind,
          competitionId: req.params.competitionId,
          filename: document.filename,
          bytes: document.bytes,
          mimeType: document.mimeType,
        },
      });
      sendSuccess(res, { document }, 201);
    } catch (error: unknown) {
      handleDocumentError(res, error, "upload");
    }
  },
);

/** PATCH — metadonnees editables (titre, description, ordre d'affichage). */
router.patch(
  "/:kind/:competitionId/documents/:documentId",
  authUser,
  validateParams(competitionDocumentItemParamsSchema),
  validate(updateCompetitionDocumentSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body: z.infer<typeof updateCompetitionDocumentSchema> = req.body;
      const document = await updateCompetitionDocument({
        documentId: req.params.documentId,
        actor: actorOf(req),
        title: body.title,
        description: body.description,
        sortOrder: body.sortOrder,
      });
      await safeRecordAdminActionFromRequest(prisma, req, {
        action: "competition-document.update",
        entity: "CompetitionDocument",
        entityId: document.id,
        newValue: { title: document.title, sortOrder: document.sortOrder },
      });
      sendSuccess(res, { document });
    } catch (error: unknown) {
      handleDocumentError(res, error, "update");
    }
  },
);

/** DELETE — retrait d'un document (ligne puis binaire). */
router.delete(
  "/:kind/:competitionId/documents/:documentId",
  authUser,
  validateParams(competitionDocumentItemParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const removed = await deleteCompetitionDocument({
        documentId: req.params.documentId,
        actor: actorOf(req),
      });
      await safeRecordAdminActionFromRequest(prisma, req, {
        action: "competition-document.delete",
        entity: "CompetitionDocument",
        entityId: removed.id,
        oldValue: { filename: removed.filename },
      });
      sendSuccess(res, { deleted: true, id: removed.id });
    } catch (error: unknown) {
      handleDocumentError(res, error, "delete");
    }
  },
);

export default router;
