/**
 * Blog d'une compétition (ligue | coupe) — un seul routeur pour les deux
 * familles, monté sur `/api/competitions/:kind/:competitionId/blog` derrière
 * le flag `competition_blog` (cf. `index.ts`). `mergeParams` : `:kind` et
 * `:competitionId` viennent du point de montage.
 *
 * Ordre des contrôles, partout : visibilité de la compétition (404) AVANT
 * tout droit (403) — un 403 ne doit jamais révéler une compétition privée.
 * Lectures en `optionalAuthUser` (le blog d'une compétition publique se lit
 * sans compte), écritures en `authUser`.
 */

import { Router, raw } from "express";
import type { NextFunction, Request, Response } from "express";

import {
  authUser,
  optionalAuthUser,
  type AuthenticatedRequest,
} from "../middleware/authUser";
import { competitionViewerOf } from "../middleware/competitionVisibility";
import { validate, validateParams, validateQuery } from "../middleware/validate";
import { sendError, sendSuccess } from "../utils/api-response";
import { serverLog } from "../utils/server-log";
import {
  BLOG_ERROR_STATUS,
  CompetitionBlogError,
  resolveBlogContext,
  assertAllowed,
  type BlogContext,
} from "../services/competition-blog-context";
import {
  createPost,
  deletePost,
  getPost,
  listPosts,
  setPostHidden,
  setPostPinned,
  setPostPublished,
  setReaction,
  updatePost,
} from "../services/competition-blog";
import {
  createComment,
  deleteComment,
  listComments,
  setCommentHidden,
  updateComment,
} from "../services/competition-blog-comments";
import { BLOG_LIMITS, type ReactionKind } from "../services/competition-blog-rules";
import {
  CompetitionBlogImageError,
  createUploadQuota,
  MAX_COMPETITION_BLOG_IMAGE_BYTES,
  saveCompetitionBlogImage,
} from "../utils/competition-blog-upload";
import {
  blogCommentParamsSchema,
  blogParamsSchema,
  blogPostParamsSchema,
  blogReactionParamsSchema,
  commentBodySchema,
  createPostSchema,
  listCommentsQuerySchema,
  listPostsQuerySchema,
  moderationSchema,
  updatePostSchema,
  type CommentBody,
  type CreatePostBody,
  type ListCommentsQuery,
  type ListPostsQuery,
  type ModerationBody,
  type UpdatePostBody,
} from "../schemas/competition-blog.schemas";

const router = Router({ mergeParams: true });

/** Quota d'uploads d'images par auteur (mémoire, par processus). */
export const imageUploadQuota = createUploadQuota(
  BLOG_LIMITS.imagesPerWindow,
  BLOG_LIMITS.imageWindowMs,
);

function contextOf(req: AuthenticatedRequest): Promise<BlogContext> {
  const kind = req.params.kind === "cups" ? "cup" : "league";
  return resolveBlogContext(kind, req.params.competitionId, competitionViewerOf(req));
}

function handleError(res: Response, error: unknown, context: string): void {
  if (error instanceof CompetitionBlogError) {
    sendError(res, error.message, BLOG_ERROR_STATUS[error.code]);
    return;
  }
  serverLog.error(`[competition-blog] ${context}`, error);
  sendError(res, "Erreur serveur", 500);
}

type Handler = (
  req: AuthenticatedRequest,
  res: Response,
  ctx: BlogContext,
) => Promise<void>;

/** Résout le contexte (404 si la compétition est cachée) puis délègue. */
function withContext(label: string, handler: Handler) {
  return async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const ctx = await contextOf(req);
      await handler(req, res, ctx);
    } catch (error: unknown) {
      handleError(res, error, label);
    }
  };
}

// ── Articles ────────────────────────────────────────────────────────────

router.get(
  "/posts",
  optionalAuthUser,
  validateParams(blogParamsSchema),
  validateQuery(listPostsQuerySchema),
  withContext("list", async (req, res, ctx) => {
    const query = req.query as unknown as ListPostsQuery;
    const result = await listPosts(ctx, query);
    sendSuccess(res, { ...result, viewer: ctx.perms });
  }),
);

router.get(
  "/posts/:postId",
  optionalAuthUser,
  validateParams(blogPostParamsSchema),
  withContext("get", async (req, res, ctx) => {
    const post = await getPost(ctx, req.params.postId);
    sendSuccess(res, { post, viewer: ctx.perms });
  }),
);

router.post(
  "/posts",
  authUser,
  validateParams(blogParamsSchema),
  validate(createPostSchema),
  withContext("create", async (req, res, ctx) => {
    const body: CreatePostBody = req.body;
    const post = await createPost(ctx, body);
    sendSuccess(res, { post }, 201);
  }),
);

router.patch(
  "/posts/:postId",
  authUser,
  validateParams(blogPostParamsSchema),
  validate(updatePostSchema),
  withContext("update", async (req, res, ctx) => {
    const body: UpdatePostBody = req.body;
    const post = await updatePost(ctx, req.params.postId, body);
    sendSuccess(res, { post });
  }),
);

router.delete(
  "/posts/:postId",
  authUser,
  validateParams(blogPostParamsSchema),
  withContext("delete", async (req, res, ctx) => {
    await deletePost(ctx, req.params.postId);
    sendSuccess(res, { deleted: true });
  }),
);

for (const [path, published] of [
  ["publish", true],
  ["unpublish", false],
] as const) {
  router.post(
    `/posts/:postId/${path}`,
    authUser,
    validateParams(blogPostParamsSchema),
    withContext(path, async (req, res, ctx) => {
      const post = await setPostPublished(ctx, req.params.postId, published);
      sendSuccess(res, { post });
    }),
  );
}

for (const [path, pinned] of [
  ["pin", true],
  ["unpin", false],
] as const) {
  router.post(
    `/posts/:postId/${path}`,
    authUser,
    validateParams(blogPostParamsSchema),
    withContext(path, async (req, res, ctx) => {
      const post = await setPostPinned(ctx, req.params.postId, pinned);
      sendSuccess(res, { post });
    }),
  );
}

for (const [path, hidden] of [
  ["hide", true],
  ["unhide", false],
] as const) {
  router.post(
    `/posts/:postId/${path}`,
    authUser,
    validateParams(blogPostParamsSchema),
    validate(moderationSchema),
    withContext(`post-${path}`, async (req, res, ctx) => {
      const body: ModerationBody = req.body;
      const post = await setPostHidden(ctx, req.params.postId, hidden, body.reason);
      sendSuccess(res, { post });
    }),
  );
  router.post(
    `/comments/:commentId/${path}`,
    authUser,
    validateParams(blogCommentParamsSchema),
    validate(moderationSchema),
    withContext(`comment-${path}`, async (req, res, ctx) => {
      const body: ModerationBody = req.body;
      const comment = await setCommentHidden(
        ctx,
        req.params.commentId,
        hidden,
        body.reason,
      );
      sendSuccess(res, { comment });
    }),
  );
}

// ── Réactions ───────────────────────────────────────────────────────────

for (const [method, on] of [
  ["put", true],
  ["delete", false],
] as const) {
  router[method](
    "/posts/:postId/reactions/:reaction",
    authUser,
    validateParams(blogReactionParamsSchema),
    withContext(`reaction-${method}`, async (req, res, ctx) => {
      const reactions = await setReaction(
        ctx,
        req.params.postId,
        req.params.reaction as ReactionKind,
        on,
      );
      sendSuccess(res, { reactions });
    }),
  );
}

// ── Commentaires ────────────────────────────────────────────────────────

router.get(
  "/posts/:postId/comments",
  optionalAuthUser,
  validateParams(blogPostParamsSchema),
  validateQuery(listCommentsQuerySchema),
  withContext("comments-list", async (req, res, ctx) => {
    const query = req.query as unknown as ListCommentsQuery;
    const result = await listComments(ctx, req.params.postId, query);
    sendSuccess(res, { ...result, viewer: ctx.perms });
  }),
);

router.post(
  "/posts/:postId/comments",
  authUser,
  validateParams(blogPostParamsSchema),
  validate(commentBodySchema),
  withContext("comment-create", async (req, res, ctx) => {
    const body: CommentBody = req.body;
    const comment = await createComment(ctx, req.params.postId, body.body);
    sendSuccess(res, { comment }, 201);
  }),
);

router.patch(
  "/comments/:commentId",
  authUser,
  validateParams(blogCommentParamsSchema),
  validate(commentBodySchema),
  withContext("comment-update", async (req, res, ctx) => {
    const body: CommentBody = req.body;
    const comment = await updateComment(ctx, req.params.commentId, body.body);
    sendSuccess(res, { comment });
  }),
);

router.delete(
  "/comments/:commentId",
  authUser,
  validateParams(blogCommentParamsSchema),
  withContext("comment-delete", async (req, res, ctx) => {
    await deleteComment(ctx, req.params.commentId);
    sendSuccess(res, { deleted: true });
  }),
);

// ── Images ──────────────────────────────────────────────────────────────

const rawImageParser = raw({
  type: () => true,
  limit: MAX_COMPETITION_BLOG_IMAGE_BYTES,
});

/** Corps binaire brut, borné par le parser : 413 propre au-delà. */
function parseRawImage(req: Request, res: Response, next: NextFunction): void {
  rawImageParser(req, res, (err: unknown) => {
    if (err) {
      if ((err as { type?: string }).type === "entity.too.large") {
        sendError(res, "Image trop volumineuse (max 3 Mo)", 413);
        return;
      }
      sendError(res, "Corps de requete invalide", 400);
      return;
    }
    next();
  });
}

router.post(
  "/images",
  authUser,
  validateParams(blogParamsSchema),
  // Contexte AVANT la lecture du corps : un non-membre ne fait pas écrire
  // 3 Mo en mémoire pour rien.
  withContext("image", async (req, res, ctx) => {
    assertAllowed(ctx, ctx.perms.canWrite, "illustrer un article");
    parseRawImage(req, res, async () => {
      try {
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          sendError(res, "Fichier vide", 400);
          return;
        }
        if (!imageUploadQuota.take(ctx.viewer.userId!)) {
          sendError(res, "Trop d'images envoyees recemment", 429);
          return;
        }
        const saved = await saveCompetitionBlogImage(
          ctx.competition.kind,
          ctx.competition.id,
          req.body,
        );
        sendSuccess(res, { image: saved }, 201);
      } catch (error: unknown) {
        if (error instanceof CompetitionBlogImageError) {
          sendError(res, error.message, error.code === "empty" ? 400 : 415);
          return;
        }
        handleError(res, error, "image-save");
      }
    });
  }),
);

export default router;
