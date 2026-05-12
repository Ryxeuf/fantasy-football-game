/**
 * Sprint Q lot Q.B.2 — Endpoints HTTP commentaires Gazette.
 *
 * User-facing :
 *   GET    /pro-league/gazette/articles/:id/comments
 *   POST   /pro-league/gazette/articles/:id/comments   (auth)
 *   DELETE /pro-league/gazette/comments/:id            (auth, owner)
 *   POST   /pro-league/gazette/comments/:id/flag      (auth, report)
 *
 * Admin :
 *   GET  /admin/gazette/comments?filter=flagged|deleted|all
 *   POST /admin/gazette/comments/:id/delete
 *   POST /admin/gazette/comments/:id/unflag
 *   POST /admin/gazette/comments/:id/restore
 */

import { Router } from "express";
import { authUser, type AuthenticatedRequest } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { serverLog } from "../utils/server-log";
import {
  CommentsError,
  adminListComments,
  createComment,
  flagComment,
  listComments,
  restoreComment,
  softDeleteComment,
  unflagComment,
  type AdminListFilter,
} from "../services/pro-gazette-comments";

function errorStatus(code: CommentsError["code"]): number {
  switch (code) {
    case "ARTICLE_NOT_FOUND":
    case "COMMENT_NOT_FOUND":
      return 404;
    case "BODY_EMPTY":
    case "BODY_TOO_LONG":
      return 400;
    case "NOT_OWNER":
      return 403;
    case "ALREADY_DELETED":
      return 409;
    default:
      return 500;
  }
}

function isAdminUser(req: AuthenticatedRequest): boolean {
  const roles = req.user?.roles ?? [];
  const role = req.user?.role;
  return roles.includes("admin") || role === "admin";
}

// ─────────────────────────────────────────────────────────────────────────
// User-facing router (mounted under /pro-league/gazette)
// ─────────────────────────────────────────────────────────────────────────

export const userRouter: Router = Router();

/** GET /pro-league/gazette/articles/:id/comments (public). */
userRouter.get("/articles/:id/comments", async (req, res) => {
  try {
    const auth = req as AuthenticatedRequest;
    const list = await listComments(req.params.id, {
      currentUserId: auth.user?.id,
      isAdmin: auth.user ? isAdminUser(auth) : false,
    });
    res.json({ comments: list });
  } catch (e) {
    if (e instanceof CommentsError) {
      return res.status(errorStatus(e.code)).json({ error: e.message });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lecture" });
  }
});

/** POST /pro-league/gazette/articles/:id/comments (auth). */
userRouter.post("/articles/:id/comments", authUser, async (req, res) => {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    const body = (req.body ?? {}) as { body?: unknown };
    if (typeof body.body !== "string") {
      return res.status(400).json({ error: "missing-body" });
    }
    const comment = await createComment({
      articleId: req.params.id,
      userId,
      body: body.body,
    });
    res.status(201).json({ comment });
  } catch (e) {
    if (e instanceof CommentsError) {
      return res.status(errorStatus(e.code)).json({ error: e.message });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur creation" });
  }
});

/** DELETE /pro-league/gazette/comments/:id (auth, owner ou admin). */
userRouter.delete("/comments/:id", authUser, async (req, res) => {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    const comment = await softDeleteComment({
      commentId: req.params.id,
      byUserId: userId,
      isAdmin: isAdminUser(auth),
    });
    res.json({ comment });
  } catch (e) {
    if (e instanceof CommentsError) {
      return res.status(errorStatus(e.code)).json({ error: e.message });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur suppression" });
  }
});

/** POST /pro-league/gazette/comments/:id/flag (auth, user report). */
userRouter.post("/comments/:id/flag", authUser, async (req, res) => {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    const body = (req.body ?? {}) as { reason?: unknown };
    const reasonText =
      typeof body.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim().slice(0, 200)
        : "user-report";
    const comment = await flagComment({
      commentId: req.params.id,
      reason: `user:${reasonText}`,
    });
    res.json({ comment });
  } catch (e) {
    if (e instanceof CommentsError) {
      return res.status(errorStatus(e.code)).json({ error: e.message });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur flag" });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Admin router (mounted under /admin/gazette)
// ─────────────────────────────────────────────────────────────────────────

export const adminRouter: Router = Router();
adminRouter.use(authUser, adminOnly);

/** GET /admin/gazette/comments?filter=flagged|deleted|all&limit=N */
adminRouter.get("/comments", async (req, res) => {
  try {
    const filter =
      (req.query.filter as AdminListFilter | undefined) ?? "flagged";
    const limitRaw = req.query.limit;
    let limit = 100;
    if (typeof limitRaw === "string" && /^\d+$/.test(limitRaw)) {
      limit = Math.min(500, Math.max(1, Number.parseInt(limitRaw, 10)));
    }
    const list = await adminListComments(filter, limit);
    res.json({ comments: list });
  } catch (e) {
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lecture admin" });
  }
});

/** POST /admin/gazette/comments/:id/delete */
adminRouter.post("/comments/:id/delete", async (req, res) => {
  try {
    const auth = req as AuthenticatedRequest;
    const userId = auth.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Non authentifie" });
    }
    const comment = await softDeleteComment({
      commentId: req.params.id,
      byUserId: userId,
      isAdmin: true,
    });
    res.json({ comment });
  } catch (e) {
    if (e instanceof CommentsError) {
      return res.status(errorStatus(e.code)).json({ error: e.message });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur admin delete" });
  }
});

/** POST /admin/gazette/comments/:id/unflag */
adminRouter.post("/comments/:id/unflag", async (req, res) => {
  try {
    const comment = await unflagComment(req.params.id);
    res.json({ comment });
  } catch (e) {
    if (e instanceof CommentsError) {
      return res.status(errorStatus(e.code)).json({ error: e.message });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur unflag" });
  }
});

/** POST /admin/gazette/comments/:id/restore */
adminRouter.post("/comments/:id/restore", async (req, res) => {
  try {
    const comment = await restoreComment(req.params.id);
    res.json({ comment });
  } catch (e) {
    if (e instanceof CommentsError) {
      return res.status(errorStatus(e.code)).json({ error: e.message });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur restore" });
  }
});
