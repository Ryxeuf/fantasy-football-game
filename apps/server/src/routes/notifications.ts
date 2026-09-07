/**
 * Routes des notifications internes (in-app), montées sur `/notifications`.
 *
 *  - GET  /notifications              liste paginée (+ compteur de non lus)
 *  - GET  /notifications/unread-count compteur seul (pastille du menu)
 *  - POST /notifications/read-all     marque tout lu (ouverture de la page)
 *  - POST /notifications/:id/read     marque une notification lue
 *
 * Toutes réservées à l'utilisateur authentifié, qui ne voit et ne modifie
 * que SES notifications (le service filtre par `userId`).
 */

import { Router } from "express";
import type { Response } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { validateQuery } from "../middleware/validate";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import {
  listNotificationsQuerySchema,
  type ListNotificationsQuery,
} from "../schemas/notifications.schemas";
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/in-app-notifications";

function requireUserId(
  req: AuthenticatedRequest,
  res: Response,
): string | null {
  const id = req.user?.id;
  if (!id) {
    sendError(res, "Non authentifie", 401);
    return null;
  }
  return id;
}

function serverFailure(res: Response, label: string, e: unknown): void {
  serverLog.error(`[notifications] ${label} failed`, e);
  sendError(res, "Erreur serveur", 500);
}

export async function handleListNotifications(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  const query = req.query as unknown as ListNotificationsQuery;
  try {
    const result = await listNotifications(userId, {
      limit: query.limit,
      offset: query.offset,
      unreadOnly: query.unread === true,
    });
    sendSuccess(
      res,
      { notifications: result.items, unreadCount: result.unreadCount },
      200,
      {
        total: result.total,
        page: Math.floor(result.offset / result.limit),
        limit: result.limit,
      },
    );
  } catch (e: unknown) {
    serverFailure(res, "list", e);
  }
}

export async function handleUnreadCount(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const count = await countUnreadNotifications(userId);
    sendSuccess(res, { count });
  } catch (e: unknown) {
    serverFailure(res, "unread-count", e);
  }
}

export async function handleMarkAllRead(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const updated = await markAllNotificationsRead(userId);
    sendSuccess(res, { updated });
  } catch (e: unknown) {
    serverFailure(res, "read-all", e);
  }
}

export async function handleMarkRead(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const outcome = await markNotificationRead(userId, req.params.id);
    if (outcome === "not_found") {
      sendError(res, "Notification introuvable", 404);
      return;
    }
    sendSuccess(res, { read: true, changed: outcome === "read" });
  } catch (e: unknown) {
    serverFailure(res, "read", e);
  }
}

const router = Router();

router.get(
  "/",
  authUser,
  validateQuery(listNotificationsQuerySchema),
  handleListNotifications,
);
router.get("/unread-count", authUser, handleUnreadCount);
router.post("/read-all", authUser, handleMarkAllRead);
router.post("/:id/read", authUser, handleMarkRead);

export default router;
