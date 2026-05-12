/**
 * Sprint Q lot Q.B.2 — Service commentaires Gazette + moderation.
 *
 * Capabilites :
 *  - createComment : auto-blocklist a la creation (flag si match).
 *  - listComments : filtre flagged/deleted selon perspective (user
 *    courant peut voir ses propres flagged ; admin voit tout).
 *  - flagComment : admin ou self-report.
 *  - softDeleteComment : auteur ou admin.
 *  - unflagComment / restoreComment : admin uniquement.
 *  - adminListComments : avec filter (flagged | deleted | all).
 *
 * Blocklist : array hardcode de motifs (regex) verifies sur le body
 * normalise (toLower + trim spaces). Si match, comment.flaggedAt et
 * flagReason='blocklist:<pattern>' sont set a la creation.
 *
 * Pas de Perspective API au MVP (a brancher en lot subsequent).
 */

import { prisma } from "../prisma";

export const MAX_BODY_LENGTH = 500;
export const MIN_BODY_LENGTH = 1;

export type CommentsErrorCode =
  | "ARTICLE_NOT_FOUND"
  | "COMMENT_NOT_FOUND"
  | "BODY_TOO_LONG"
  | "BODY_EMPTY"
  | "NOT_OWNER"
  | "ALREADY_DELETED";

export class CommentsError extends Error {
  constructor(
    public readonly code: CommentsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CommentsError";
  }
}

/**
 * Blocklist conservatrice : termes les plus offensants connus, anglais
 * et francais. La detection est case-insensitive et tolere variations
 * de spacing simples. Volontairement courte — le but est un filet de
 * securite, pas un filtre complet.
 *
 * Si un commentaire match, il est `flagged` automatiquement (donc
 * masque pour les autres users).
 */
const BLOCKLIST_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  { name: "slur-1", regex: /\bn[\W_]*i[\W_]*g[\W_]*g[\W_]*(?:e[\W_]*r|a)\b/i },
  { name: "slur-2", regex: /\bf[\W_]*a[\W_]*g[\W_]*g[\W_]*o[\W_]*t\b/i },
  { name: "slur-3", regex: /\br[\W_]*e[\W_]*t[\W_]*a[\W_]*r[\W_]*d\b/i },
  { name: "slur-4", regex: /\bk[\W_]*i[\W_]*k[\W_]*e\b/i },
  // Variantes phonetiques francaises courantes
  { name: "slur-fr-1", regex: /\bsa[\W_]*l[\W_]*o[\W_]*p[\W_]*e\b/i },
];

/**
 * Verifie le body contre la blocklist. Renvoie le pattern matche ou
 * null si OK.
 */
export function detectBlocklist(body: string): string | null {
  for (const { name, regex } of BLOCKLIST_PATTERNS) {
    if (regex.test(body)) return name;
  }
  return null;
}

function validateBody(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length < MIN_BODY_LENGTH) {
    throw new CommentsError("BODY_EMPTY", "Le commentaire est vide");
  }
  if (trimmed.length > MAX_BODY_LENGTH) {
    throw new CommentsError(
      "BODY_TOO_LONG",
      `Le commentaire depasse ${MAX_BODY_LENGTH} caracteres`,
    );
  }
  return trimmed;
}

export interface CreateCommentInput {
  readonly articleId: string;
  readonly userId: string;
  readonly body: string;
}

export interface GazetteCommentView {
  readonly id: string;
  readonly articleId: string;
  readonly userId: string;
  readonly userName: string | null;
  readonly userEmail: string;
  readonly body: string;
  readonly createdAt: string;
  readonly flagged: boolean;
  readonly deleted: boolean;
  readonly flagReason: string | null;
}

/**
 * Cree un commentaire sur un article. Si le body match la blocklist,
 * le commentaire est cree avec `flaggedAt` + `flagReason` set
 * immediatement.
 */
export async function createComment(
  input: CreateCommentInput,
): Promise<GazetteCommentView> {
  const trimmed = validateBody(input.body);

  const article = (await prisma.proGazetteArticle.findUnique({
    where: { id: input.articleId },
    select: { id: true },
  })) as { id: string } | null;
  if (!article) {
    throw new CommentsError(
      "ARTICLE_NOT_FOUND",
      `Article '${input.articleId}' introuvable`,
    );
  }

  const blocked = detectBlocklist(trimmed);

  const now = new Date();
  const created = (await prisma.proGazetteComment.create({
    data: {
      articleId: input.articleId,
      userId: input.userId,
      body: trimmed,
      flaggedAt: blocked ? now : null,
      flagReason: blocked ? `blocklist:${blocked}` : null,
    },
    select: {
      id: true,
      articleId: true,
      userId: true,
      body: true,
      createdAt: true,
      flaggedAt: true,
      flagReason: true,
      deletedAt: true,
      user: { select: { name: true, email: true } },
    },
  })) as {
    id: string;
    articleId: string;
    userId: string;
    body: string;
    createdAt: Date;
    flaggedAt: Date | null;
    flagReason: string | null;
    deletedAt: Date | null;
    user: { name: string | null; email: string };
  };

  return toView(created);
}

interface CommentRow {
  id: string;
  articleId: string;
  userId: string;
  body: string;
  createdAt: Date;
  flaggedAt: Date | null;
  flagReason: string | null;
  deletedAt: Date | null;
  user: { name: string | null; email: string };
}

function toView(row: CommentRow): GazetteCommentView {
  return {
    id: row.id,
    articleId: row.articleId,
    userId: row.userId,
    userName: row.user.name,
    userEmail: row.user.email,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    flagged: row.flaggedAt !== null,
    deleted: row.deletedAt !== null,
    flagReason: row.flagReason,
  };
}

export interface ListCommentsOptions {
  readonly currentUserId?: string;
  readonly isAdmin?: boolean;
}

/**
 * Liste les commentaires d'un article. Filtre :
 *  - Soft-deleted : masques pour tous sauf admin.
 *  - Flagged : visible pour l'auteur + admin, masque pour les autres.
 *
 * Ordre : createdAt asc (chronologique).
 */
export async function listComments(
  articleId: string,
  options: ListCommentsOptions = {},
): Promise<readonly GazetteCommentView[]> {
  const all = (await prisma.proGazetteComment.findMany({
    where: { articleId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      articleId: true,
      userId: true,
      body: true,
      createdAt: true,
      flaggedAt: true,
      flagReason: true,
      deletedAt: true,
      user: { select: { name: true, email: true } },
    },
  })) as CommentRow[];

  return all.flatMap((row): GazetteCommentView[] => {
    const isAdmin = options.isAdmin === true;
    const isAuthor = row.userId === options.currentUserId;
    // Deleted : admin seulement
    if (row.deletedAt !== null && !isAdmin) return [];
    // Flagged : admin ou auteur
    if (row.flaggedAt !== null && !isAdmin && !isAuthor) return [];
    return [toView(row)];
  });
}

export interface FlagCommentInput {
  readonly commentId: string;
  readonly reason: string;
}

/** Flag un commentaire (admin ou user-report). Idempotent : si deja
 *  flagged, le flagReason est mis a jour. */
export async function flagComment(
  input: FlagCommentInput,
): Promise<GazetteCommentView> {
  const comment = (await prisma.proGazetteComment.findUnique({
    where: { id: input.commentId },
    select: { id: true },
  })) as { id: string } | null;
  if (!comment) {
    throw new CommentsError(
      "COMMENT_NOT_FOUND",
      `Comment '${input.commentId}' introuvable`,
    );
  }

  const updated = (await prisma.proGazetteComment.update({
    where: { id: input.commentId },
    data: {
      flaggedAt: new Date(),
      flagReason: input.reason,
    },
    select: {
      id: true,
      articleId: true,
      userId: true,
      body: true,
      createdAt: true,
      flaggedAt: true,
      flagReason: true,
      deletedAt: true,
      user: { select: { name: true, email: true } },
    },
  })) as CommentRow;

  return toView(updated);
}

/** Unflag (admin uniquement). */
export async function unflagComment(
  commentId: string,
): Promise<GazetteCommentView> {
  const comment = (await prisma.proGazetteComment.findUnique({
    where: { id: commentId },
    select: { id: true },
  })) as { id: string } | null;
  if (!comment) {
    throw new CommentsError(
      "COMMENT_NOT_FOUND",
      `Comment '${commentId}' introuvable`,
    );
  }

  const updated = (await prisma.proGazetteComment.update({
    where: { id: commentId },
    data: { flaggedAt: null, flagReason: null },
    select: {
      id: true,
      articleId: true,
      userId: true,
      body: true,
      createdAt: true,
      flaggedAt: true,
      flagReason: true,
      deletedAt: true,
      user: { select: { name: true, email: true } },
    },
  })) as CommentRow;

  return toView(updated);
}

export interface SoftDeleteInput {
  readonly commentId: string;
  readonly byUserId: string;
  readonly isAdmin: boolean;
}

/**
 * Soft delete : marque le commentaire comme supprime. Verifie que
 * le caller est l'auteur ou un admin.
 */
export async function softDeleteComment(
  input: SoftDeleteInput,
): Promise<GazetteCommentView> {
  const comment = (await prisma.proGazetteComment.findUnique({
    where: { id: input.commentId },
    select: { id: true, userId: true, deletedAt: true },
  })) as { id: string; userId: string; deletedAt: Date | null } | null;
  if (!comment) {
    throw new CommentsError(
      "COMMENT_NOT_FOUND",
      `Comment '${input.commentId}' introuvable`,
    );
  }
  if (comment.deletedAt !== null) {
    throw new CommentsError(
      "ALREADY_DELETED",
      "Comment deja supprime",
    );
  }
  if (!input.isAdmin && comment.userId !== input.byUserId) {
    throw new CommentsError(
      "NOT_OWNER",
      "Seul l'auteur ou un admin peut supprimer ce commentaire",
    );
  }

  const updated = (await prisma.proGazetteComment.update({
    where: { id: input.commentId },
    data: { deletedAt: new Date() },
    select: {
      id: true,
      articleId: true,
      userId: true,
      body: true,
      createdAt: true,
      flaggedAt: true,
      flagReason: true,
      deletedAt: true,
      user: { select: { name: true, email: true } },
    },
  })) as CommentRow;

  return toView(updated);
}

/** Restore : un-soft-delete (admin). */
export async function restoreComment(
  commentId: string,
): Promise<GazetteCommentView> {
  const comment = (await prisma.proGazetteComment.findUnique({
    where: { id: commentId },
    select: { id: true },
  })) as { id: string } | null;
  if (!comment) {
    throw new CommentsError(
      "COMMENT_NOT_FOUND",
      `Comment '${commentId}' introuvable`,
    );
  }

  const updated = (await prisma.proGazetteComment.update({
    where: { id: commentId },
    data: { deletedAt: null },
    select: {
      id: true,
      articleId: true,
      userId: true,
      body: true,
      createdAt: true,
      flaggedAt: true,
      flagReason: true,
      deletedAt: true,
      user: { select: { name: true, email: true } },
    },
  })) as CommentRow;

  return toView(updated);
}

export type AdminListFilter = "flagged" | "deleted" | "all";

/**
 * Liste admin : filtre sur flagged | deleted | all. Limit 100 par
 * defaut, max 500.
 */
export async function adminListComments(
  filter: AdminListFilter = "flagged",
  limit: number = 100,
): Promise<readonly GazetteCommentView[]> {
  const cap = Math.min(500, Math.max(1, limit));
  const where =
    filter === "flagged"
      ? { flaggedAt: { not: null } }
      : filter === "deleted"
        ? { deletedAt: { not: null } }
        : {};

  const rows = (await prisma.proGazetteComment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: cap,
    select: {
      id: true,
      articleId: true,
      userId: true,
      body: true,
      createdAt: true,
      flaggedAt: true,
      flagReason: true,
      deletedAt: true,
      user: { select: { name: true, email: true } },
    },
  })) as CommentRow[];

  return rows.map(toView);
}
