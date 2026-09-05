/**
 * Console d'administration des documents officiels de competition
 * (`/admin/competition-documents`).
 *
 * Les documents sont deposes par les commissaires depuis leur ligue ou leur
 * coupe (cf. `routes/competition-documents.ts`) ; cette console donne a
 * l'equipe une vue TRANSVERSE : tous les documents, toutes competitions
 * confondues, filtrables et purgeables. C'est la contrepartie du droit accorde
 * aux commissaires : un fichier publie sous la banniere du site doit rester
 * moderable.
 *
 * Auth : `authUser` + `adminOnly` (role verifie en base, pas seulement dans le
 * JWT) applique a tout le routeur.
 */

import { Router } from "express";
import type { Response } from "express";
import type { z } from "zod";

import { authUser } from "../middleware/authUser";
import type { AuthenticatedRequest } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import {
  validate,
  validateParams,
  validateQuery,
} from "../middleware/validate";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import { prisma } from "../prisma";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import {
  CompetitionDocumentError,
  deleteCompetitionDocument,
  listAllCompetitionDocuments,
  updateCompetitionDocument,
} from "../services/competition-documents";
import {
  adminCompetitionDocumentListQuerySchema,
  adminCompetitionDocumentParamsSchema,
  updateCompetitionDocumentSchema,
} from "../schemas/competition-document.schemas";

const router = Router();

router.use(authUser, adminOnly);

/** L'admin passe toutes les gardes de propriete du service. */
const ADMIN_ACTOR = { isAdmin: true } as const;

function handleError(res: Response, error: unknown, context: string): void {
  if (error instanceof CompetitionDocumentError) {
    const status =
      error.code === "forbidden"
        ? 403
        : error.code === "document-not-found" ||
            error.code === "competition-not-found"
          ? 404
          : 400;
    sendError(res, error.message, status);
    return;
  }
  serverLog.error(`[admin-competition-documents] ${context} failed`, error);
  sendError(res, "Erreur serveur", 500);
}

/** GET / — listing pagine, filtrable par famille, competition et recherche. */
router.get(
  "/",
  validateQuery(adminCompetitionDocumentListQuerySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const query = req.query as unknown as z.infer<
        typeof adminCompetitionDocumentListQuerySchema
      >;
      const result = await listAllCompetitionDocuments(query);
      sendSuccess(res, { documents: result.documents }, 200, {
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (error: unknown) {
      handleError(res, error, "list");
    }
  },
);

/** PATCH /:documentId — correction du libelle / de la description. */
router.patch(
  "/:documentId",
  validateParams(adminCompetitionDocumentParamsSchema),
  validate(updateCompetitionDocumentSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body: z.infer<typeof updateCompetitionDocumentSchema> = req.body;
      const document = await updateCompetitionDocument({
        documentId: req.params.documentId,
        actor: { userId: req.user?.id ?? null, ...ADMIN_ACTOR },
        title: body.title,
        description: body.description,
        sortOrder: body.sortOrder,
      });
      await safeRecordAdminActionFromRequest(prisma, req, {
        action: "competition-document.admin-update",
        entity: "CompetitionDocument",
        entityId: document.id,
        newValue: { title: document.title, sortOrder: document.sortOrder },
      });
      sendSuccess(res, { document });
    } catch (error: unknown) {
      handleError(res, error, "update");
    }
  },
);

/** DELETE /:documentId — retrait definitif (ligne + binaire). */
router.delete(
  "/:documentId",
  validateParams(adminCompetitionDocumentParamsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const removed = await deleteCompetitionDocument({
        documentId: req.params.documentId,
        actor: { userId: req.user?.id ?? null, ...ADMIN_ACTOR },
      });
      await safeRecordAdminActionFromRequest(prisma, req, {
        action: "competition-document.admin-delete",
        entity: "CompetitionDocument",
        entityId: removed.id,
        oldValue: { filename: removed.filename },
      });
      sendSuccess(res, { deleted: true, id: removed.id });
    } catch (error: unknown) {
      handleError(res, error, "delete");
    }
  },
);

export default router;
