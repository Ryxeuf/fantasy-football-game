/**
 * Règles PURES du blog des compétitions (change OpenSpec `competition-blog`).
 *
 * Qui écrit, réagit, commente, modère ; qui voit un article ou un
 * commentaire ; les limites de saisie. Aucune I/O : le service charge l'état
 * (rôle du lecteur, archivage, ligne en base) et pose ses questions ici, et
 * les mêmes réponses sont SERVIES à l'écran (`viewer`) pour qu'il n'ait pas à
 * redéduire la règle.
 *
 * Membre = commissaire, ou propriétaire d'une équipe ENGAGÉE dans l'édition
 * courante (`buildViewerRoles` → `participant === "active"`). Un ancien
 * participant, un coach retiré, un invité ou un simple lecteur lisent sans
 * écrire. L'admin écrit et modère partout. Une compétition archivée est en
 * lecture seule, la modération restant possible.
 */

import type { ViewerParticipation } from "./competition-membership";

export const REACTION_KINDS = [
  "like",
  "love",
  "laugh",
  "wow",
  "fire",
  "skull",
] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export const REACTION_EMOJI: Readonly<Record<ReactionKind, string>> = {
  like: "👍",
  love: "❤️",
  laugh: "😂",
  wow: "😮",
  fire: "🔥",
  skull: "💀",
};

export function isReactionKind(value: unknown): value is ReactionKind {
  return (
    typeof value === "string" &&
    (REACTION_KINDS as readonly string[]).includes(value)
  );
}

export const POST_STATUSES = ["draft", "published"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/** Limites de saisie, partagées par les schémas Zod et le service. */
export const BLOG_LIMITS = {
  titleMax: 120,
  contentHtmlMax: 50_000,
  excerptMax: 280,
  commentMax: 2_000,
  moderationReasonMax: 200,
  pageSizeMax: 50,
  /** Publications par auteur, par compétition et par fenêtre glissante. */
  publishPerWindow: 10,
  publishWindowMs: 24 * 60 * 60 * 1000,
  /** Commentaires par auteur (toutes compétitions) et par fenêtre. */
  commentsPerWindow: 30,
  commentWindowMs: 10 * 60 * 1000,
  /** Images uploadées par auteur et par fenêtre. */
  imagesPerWindow: 20,
  imageWindowMs: 24 * 60 * 60 * 1000,
} as const;

export interface BlogViewerContext {
  readonly userId: string | null;
  readonly isAdmin: boolean;
  readonly isCommissioner: boolean;
  readonly participant: ViewerParticipation;
  readonly archived: boolean;
}

export interface BlogPermissions {
  /** Commissaire ou équipe engagée dans l'édition courante. */
  readonly isMember: boolean;
  readonly canWrite: boolean;
  readonly canReact: boolean;
  readonly canComment: boolean;
  readonly canModerate: boolean;
}

export function isBlogMember(ctx: BlogViewerContext): boolean {
  if (!ctx.userId) return false;
  return ctx.isCommissioner || ctx.participant === "active";
}

export function blogPermissions(ctx: BlogViewerContext): BlogPermissions {
  const isMember = isBlogMember(ctx);
  const contributes = !!ctx.userId && (isMember || ctx.isAdmin) && !ctx.archived;
  return {
    isMember,
    canWrite: contributes,
    canReact: contributes,
    canComment: contributes,
    canModerate: !!ctx.userId && (ctx.isCommissioner || ctx.isAdmin),
  };
}

/** Colonnes d'un article qui décident de sa visibilité et de ses droits. */
export interface PostAccessRow {
  readonly authorId: string | null;
  readonly status: string;
  readonly hiddenAt: Date | null;
  readonly deletedAt: Date | null;
}

/** Colonnes d'un commentaire qui décident de sa visibilité et de ses droits. */
export interface CommentAccessRow {
  readonly authorId: string | null;
  readonly hiddenAt: Date | null;
  readonly deletedAt: Date | null;
}

function isAuthor(
  row: { readonly authorId: string | null },
  viewerId: string | null,
): boolean {
  return !!viewerId && row.authorId === viewerId;
}

/**
 * Un article supprimé n'existe pour personne ; un brouillon pour son seul
 * auteur (commissaire compris : un brouillon n'est pas soumis) ; un article
 * masqué pour son auteur et les modérateurs.
 */
export function canSeePost(
  post: PostAccessRow,
  viewerId: string | null,
  perms: Pick<BlogPermissions, "canModerate">,
): boolean {
  if (post.deletedAt) return false;
  if (post.status !== "published") return isAuthor(post, viewerId);
  if (post.hiddenAt) return isAuthor(post, viewerId) || perms.canModerate;
  return true;
}

/** Un article publié, non masqué, non supprimé : on peut y réagir / commenter. */
export function isPostOpenForInteraction(post: PostAccessRow): boolean {
  return post.status === "published" && !post.hiddenAt && !post.deletedAt;
}

export function canSeeComment(
  comment: CommentAccessRow,
  viewerId: string | null,
  perms: Pick<BlogPermissions, "canModerate">,
): boolean {
  if (comment.deletedAt) return false;
  if (comment.hiddenAt) return isAuthor(comment, viewerId) || perms.canModerate;
  return true;
}

/** L'auteur modifie son article tant qu'il a le droit d'écrire. */
export function canEditPost(
  post: PostAccessRow,
  viewerId: string | null,
  perms: Pick<BlogPermissions, "canWrite">,
): boolean {
  return !post.deletedAt && isAuthor(post, viewerId) && perms.canWrite;
}

/**
 * L'auteur supprime TOUJOURS son article (même retiré de la compétition) ; un
 * modérateur supprime celui des autres.
 */
export function canDeletePost(
  post: PostAccessRow,
  viewerId: string | null,
  perms: Pick<BlogPermissions, "canModerate">,
): boolean {
  if (post.deletedAt) return false;
  return isAuthor(post, viewerId) || perms.canModerate;
}

export function canEditComment(
  comment: CommentAccessRow,
  viewerId: string | null,
  perms: Pick<BlogPermissions, "canComment">,
): boolean {
  return !comment.deletedAt && isAuthor(comment, viewerId) && perms.canComment;
}

export function canDeleteComment(
  comment: CommentAccessRow,
  viewerId: string | null,
  perms: Pick<BlogPermissions, "canModerate">,
): boolean {
  if (comment.deletedAt) return false;
  return isAuthor(comment, viewerId) || perms.canModerate;
}

/**
 * Ordre du blog : épinglés d'abord (le plus récemment épinglé en tête), puis
 * date de publication décroissante, puis id (ordre total, stable).
 */
export interface PostOrderRow {
  readonly id: string;
  readonly pinnedAt: Date | null;
  readonly publishedAt: Date | null;
}

export function comparePosts(a: PostOrderRow, b: PostOrderRow): number {
  const pa = a.pinnedAt?.getTime() ?? null;
  const pb = b.pinnedAt?.getTime() ?? null;
  if (pa !== null || pb !== null) {
    if (pa === null) return 1;
    if (pb === null) return -1;
    if (pa !== pb) return pb - pa;
  }
  const da = a.publishedAt?.getTime() ?? 0;
  const db = b.publishedAt?.getTime() ?? 0;
  if (da !== db) return db - da;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** Texte brut d'un extrait de HTML assaini (listings, aperçus). */
export function excerptFromHtml(
  html: string,
  max: number = BLOG_LIMITS.excerptMax,
): string {
  const text = html
    .replace(/<\/(p|h[1-6]|li|blockquote|pre)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Compte des réactions par type, avec les types posés par le lecteur. */
export interface ReactionSummary {
  readonly counts: Readonly<Record<ReactionKind, number>>;
  readonly mine: readonly ReactionKind[];
}

export function emptyReactionCounts(): Record<ReactionKind, number> {
  return { like: 0, love: 0, laugh: 0, wow: 0, fire: 0, skull: 0 };
}

export function summarizeReactions(
  rows: ReadonlyArray<{ readonly kind: string; readonly count: number }>,
  mine: readonly string[],
): ReactionSummary {
  const counts = emptyReactionCounts();
  for (const row of rows) {
    if (isReactionKind(row.kind)) counts[row.kind] += row.count;
  }
  return {
    counts,
    mine: REACTION_KINDS.filter((k) => mine.includes(k)),
  };
}
