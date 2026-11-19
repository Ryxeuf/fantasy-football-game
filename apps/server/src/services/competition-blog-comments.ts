/**
 * Commentaires des articles de blog de compétition : texte brut, à plat, du
 * plus ancien au plus récent. Réservés aux membres (`canComment`) ; un
 * commentaire qui tombe sous la blocklist est enregistré MASQUÉ (visible de
 * son auteur et des modérateurs, avec la raison).
 */

import { prisma } from "../prisma";
import {
  BLOG_LIMITS,
  canDeleteComment,
  canEditComment,
  canSeeComment,
} from "./competition-blog-rules";
import {
  assertAllowed,
  CompetitionBlogError,
  type BlogContext,
} from "./competition-blog-context";
import { getPostForComments, loadInteractivePost } from "./competition-blog";
import { notifyPostCommented } from "./competition-blog-notifications";
import { detectBlocklist } from "./text-blocklist";

const COMMENT_SELECT = {
  id: true,
  postId: true,
  authorId: true,
  body: true,
  editedAt: true,
  hiddenAt: true,
  hiddenReason: true,
  deletedAt: true,
  createdAt: true,
  author: { select: { id: true, coachName: true } },
} as const;

interface CommentRow {
  id: string;
  postId: string;
  authorId: string | null;
  body: string;
  editedAt: Date | null;
  hiddenAt: Date | null;
  hiddenReason: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  author: { id: string; coachName: string } | null;
}

export interface CommentView {
  readonly id: string;
  readonly body: string;
  readonly createdAt: string;
  readonly editedAt: string | null;
  readonly author: { readonly id: string; readonly coachName: string } | null;
  readonly hidden: { readonly reason: string | null; readonly at: string } | null;
  readonly viewer: { readonly canEdit: boolean; readonly canDelete: boolean };
}

function toView(ctx: BlogContext, row: CommentRow): CommentView {
  const viewerId = ctx.viewer.userId;
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    author: row.author,
    hidden: row.hiddenAt
      ? { reason: row.hiddenReason, at: row.hiddenAt.toISOString() }
      : null,
    viewer: {
      canEdit: canEditComment(row, viewerId, ctx.perms),
      canDelete: canDeleteComment(row, viewerId, ctx.perms),
    },
  };
}

function cleanBody(raw: string): string {
  const body = raw.trim();
  if (!body) throw new CompetitionBlogError("invalid", "Le commentaire est vide");
  if (body.length > BLOG_LIMITS.commentMax) {
    throw new CompetitionBlogError(
      "invalid",
      `Le commentaire depasse ${BLOG_LIMITS.commentMax} caracteres`,
    );
  }
  return body;
}

function requireUser(ctx: BlogContext): string {
  if (!ctx.viewer.userId) {
    throw new CompetitionBlogError("forbidden", "Connexion requise");
  }
  return ctx.viewer.userId;
}

export interface ListCommentsResult {
  readonly comments: CommentView[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export async function listComments(
  ctx: BlogContext,
  postId: string,
  input: { readonly page: number; readonly limit: number },
): Promise<ListCommentsResult> {
  const post = await getPostForComments(ctx, postId);
  const viewerId = ctx.viewer.userId;
  const limit = Math.min(Math.max(input.limit, 1), BLOG_LIMITS.pageSizeMax);
  const page = Math.max(input.page, 1);
  const hiddenClause = ctx.perms.canModerate
    ? {}
    : viewerId
      ? { OR: [{ hiddenAt: null }, { authorId: viewerId }] }
      : { hiddenAt: null };
  const where = { postId: post.id, deletedAt: null, ...hiddenClause };
  const [rows, total] = await Promise.all([
    prisma.competitionPostComment.findMany({
      where,
      select: COMMENT_SELECT,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }) as unknown as Promise<CommentRow[]>,
    prisma.competitionPostComment.count({ where }),
  ]);
  return { comments: rows.map((r) => toView(ctx, r)), total, page, limit };
}

async function assertCommentQuota(userId: string): Promise<void> {
  const since = new Date(Date.now() - BLOG_LIMITS.commentWindowMs);
  const recent = await prisma.competitionPostComment.count({
    where: { authorId: userId, createdAt: { gte: since } },
  });
  if (recent >= BLOG_LIMITS.commentsPerWindow) {
    throw new CompetitionBlogError(
      "rate_limited",
      "Trop de commentaires recemment : reessayez dans quelques minutes",
    );
  }
}

export async function createComment(
  ctx: BlogContext,
  postId: string,
  rawBody: string,
): Promise<CommentView> {
  const userId = requireUser(ctx);
  assertAllowed(ctx, ctx.perms.canComment, "commenter");
  const post = await loadInteractivePost(ctx, postId);
  const body = cleanBody(rawBody);
  await assertCommentQuota(userId);
  const match = detectBlocklist(body);
  const row = (await prisma.competitionPostComment.create({
    data: {
      postId: post.id,
      authorId: userId,
      body,
      ...(match
        ? { hiddenAt: new Date(), hiddenReason: `blocklist:${match}` }
        : {}),
    },
    select: COMMENT_SELECT,
  })) as unknown as CommentRow;
  if (!match) {
    await notifyPostCommented(ctx, post, userId, row.author?.coachName ?? "Un coach");
  }
  return toView(ctx, row);
}

/** Commentaire de CET article, visible du lecteur ; sinon 404. */
async function loadComment(ctx: BlogContext, commentId: string): Promise<CommentRow> {
  const row = (await prisma.competitionPostComment.findUnique({
    where: { id: commentId },
    select: COMMENT_SELECT,
  })) as unknown as CommentRow | null;
  if (!row || !canSeeComment(row, ctx.viewer.userId, ctx.perms)) {
    throw new CompetitionBlogError("not_found", "Commentaire introuvable");
  }
  // L'article doit appartenir à la compétition de l'URL et être visible.
  await getPostForComments(ctx, row.postId);
  return row;
}

export async function updateComment(
  ctx: BlogContext,
  commentId: string,
  rawBody: string,
): Promise<CommentView> {
  requireUser(ctx);
  const row = await loadComment(ctx, commentId);
  if (!canEditComment(row, ctx.viewer.userId, ctx.perms)) {
    assertAllowed(ctx, false, "modifier ce commentaire");
  }
  const body = cleanBody(rawBody);
  const match = row.hiddenAt ? null : detectBlocklist(body);
  const updated = (await prisma.competitionPostComment.update({
    where: { id: row.id },
    data: {
      body,
      editedAt: new Date(),
      ...(match
        ? { hiddenAt: new Date(), hiddenReason: `blocklist:${match}` }
        : {}),
    },
    select: COMMENT_SELECT,
  })) as unknown as CommentRow;
  return toView(ctx, updated);
}

export async function deleteComment(ctx: BlogContext, commentId: string): Promise<void> {
  requireUser(ctx);
  const row = await loadComment(ctx, commentId);
  if (!canDeleteComment(row, ctx.viewer.userId, ctx.perms)) {
    throw new CompetitionBlogError(
      "forbidden",
      "Suppression reservee a l'auteur ou au commissaire",
    );
  }
  await prisma.competitionPostComment.update({
    where: { id: row.id },
    data: { deletedAt: new Date() },
  });
}

export async function setCommentHidden(
  ctx: BlogContext,
  commentId: string,
  hidden: boolean,
  reason?: string | null,
): Promise<CommentView> {
  const moderatorId = requireUser(ctx);
  if (!ctx.perms.canModerate) {
    throw new CompetitionBlogError(
      "forbidden",
      "Moderation reservee au commissaire de la competition",
    );
  }
  const row = await loadComment(ctx, commentId);
  const updated = (await prisma.competitionPostComment.update({
    where: { id: row.id },
    data: hidden
      ? {
          hiddenAt: new Date(),
          hiddenById: moderatorId,
          hiddenReason: reason?.trim() || null,
        }
      : { hiddenAt: null, hiddenById: null, hiddenReason: null },
    select: COMMENT_SELECT,
  })) as unknown as CommentRow;
  return toView(ctx, updated);
}
