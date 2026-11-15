/**
 * Client du blog d'une compétition (ligue | coupe) — change OpenSpec
 * `competition-blog`. Une seule API pour les deux familles : tout chemin se
 * dérive de `{ kind, id }`, comme les documents officiels.
 *
 * Les droits du lecteur (`viewer`) sont SERVIS par le serveur ; l'écran ne
 * les redéduit jamais.
 */

import { apiRequest } from "./api-client";

export type BlogCompetitionKind = "league" | "cup";

export interface BlogCompetition {
  readonly kind: BlogCompetitionKind;
  readonly id: string;
}

export const REACTIONS = [
  { kind: "like", emoji: "👍", label: "J'aime" },
  { kind: "love", emoji: "❤️", label: "J'adore" },
  { kind: "laugh", emoji: "😂", label: "Drôle" },
  { kind: "wow", emoji: "😮", label: "Waouh" },
  { kind: "fire", emoji: "🔥", label: "En feu" },
  { kind: "skull", emoji: "💀", label: "Mort au champ d'honneur" },
] as const;
export type ReactionKind = (typeof REACTIONS)[number]["kind"];

export interface ReactionSummary {
  readonly counts: Readonly<Record<ReactionKind, number>>;
  readonly mine: readonly ReactionKind[];
}

export interface BlogViewer {
  readonly isMember: boolean;
  readonly canWrite: boolean;
  readonly canReact: boolean;
  readonly canComment: boolean;
  readonly canModerate: boolean;
}

export const READ_ONLY_VIEWER: BlogViewer = {
  isMember: false,
  canWrite: false,
  canReact: false,
  canComment: false,
  canModerate: false,
};

export interface BlogAuthor {
  readonly id: string;
  readonly coachName: string;
}

export interface HiddenInfo {
  readonly reason: string | null;
  readonly at: string;
}

export interface BlogPost {
  readonly id: string;
  readonly title: string;
  readonly excerpt: string;
  readonly contentHtml?: string;
  readonly coverImageUrl: string | null;
  readonly status: "draft" | "published" | string;
  readonly publishedAt: string | null;
  readonly editedAt: string | null;
  readonly createdAt: string;
  readonly pinned: boolean;
  readonly hidden: HiddenInfo | null;
  readonly author: BlogAuthor | null;
  readonly seasonNumber: number | null;
  readonly reactions: ReactionSummary;
  readonly commentCount: number;
  readonly viewer: { readonly canEdit: boolean; readonly canDelete: boolean };
}

export interface BlogComment {
  readonly id: string;
  readonly body: string;
  readonly createdAt: string;
  readonly editedAt: string | null;
  readonly author: BlogAuthor | null;
  readonly hidden: HiddenInfo | null;
  readonly viewer: { readonly canEdit: boolean; readonly canDelete: boolean };
}

export interface BlogPostList {
  readonly pinned: BlogPost[];
  readonly posts: BlogPost[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly viewer: BlogViewer;
}

export interface BlogCommentList {
  readonly comments: BlogComment[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly viewer: BlogViewer;
}

export const BLOG_TITLE_MAX = 120;
export const BLOG_COMMENT_MAX = 2000;
export const BLOG_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const BLOG_IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

/** Préfixe de l'API du blog. */
export function blogApiBase(c: BlogCompetition): string {
  const scope = c.kind === "league" ? "leagues" : "cups";
  return `/api/competitions/${scope}/${encodeURIComponent(c.id)}/blog`;
}

/** Page web du blog (et de ses articles). */
export function blogPagePath(c: BlogCompetition, suffix = ""): string {
  const root = c.kind === "league" ? "/leagues" : "/cups";
  return `${root}/${encodeURIComponent(c.id)}/blog${suffix}`;
}

export function blogPostPagePath(c: BlogCompetition, postId: string): string {
  return blogPagePath(c, `/${encodeURIComponent(postId)}`);
}

/** Page de la compétition elle-même. */
export function competitionPagePath(c: BlogCompetition): string {
  return `${c.kind === "league" ? "/leagues" : "/cups"}/${encodeURIComponent(c.id)}`;
}

export function listBlogPosts(
  c: BlogCompetition,
  opts: { page?: number; limit?: number; drafts?: boolean } = {},
): Promise<BlogPostList> {
  const qs = new URLSearchParams();
  if (opts.page) qs.set("page", String(opts.page));
  if (opts.limit) qs.set("limit", String(opts.limit));
  if (opts.drafts) qs.set("drafts", "mine");
  const query = qs.toString();
  return apiRequest<BlogPostList>(`${blogApiBase(c)}/posts${query ? `?${query}` : ""}`);
}

export function getBlogPost(
  c: BlogCompetition,
  postId: string,
): Promise<{ post: BlogPost; viewer: BlogViewer }> {
  return apiRequest(`${blogApiBase(c)}/posts/${encodeURIComponent(postId)}`);
}

export interface BlogPostInput {
  readonly title: string;
  readonly contentHtml: string;
  readonly coverImageUrl?: string | null;
}

export async function createBlogPost(
  c: BlogCompetition,
  input: BlogPostInput & { readonly publish: boolean },
): Promise<BlogPost> {
  const data = await apiRequest<{ post: BlogPost }>(`${blogApiBase(c)}/posts`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.post;
}

export async function updateBlogPost(
  c: BlogCompetition,
  postId: string,
  patch: Partial<BlogPostInput>,
): Promise<BlogPost> {
  const data = await apiRequest<{ post: BlogPost }>(
    `${blogApiBase(c)}/posts/${encodeURIComponent(postId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return data.post;
}

export async function deleteBlogPost(c: BlogCompetition, postId: string): Promise<void> {
  await apiRequest(`${blogApiBase(c)}/posts/${encodeURIComponent(postId)}`, {
    method: "DELETE",
  });
}

export type PostAction = "publish" | "unpublish" | "pin" | "unpin" | "hide" | "unhide";

export async function postAction(
  c: BlogCompetition,
  postId: string,
  action: PostAction,
  reason?: string | null,
): Promise<BlogPost> {
  const data = await apiRequest<{ post: BlogPost }>(
    `${blogApiBase(c)}/posts/${encodeURIComponent(postId)}/${action}`,
    {
      method: "POST",
      body: JSON.stringify(action === "hide" ? { reason: reason ?? null } : {}),
    },
  );
  return data.post;
}

export async function toggleReaction(
  c: BlogCompetition,
  postId: string,
  kind: ReactionKind,
  on: boolean,
): Promise<ReactionSummary> {
  const data = await apiRequest<{ reactions: ReactionSummary }>(
    `${blogApiBase(c)}/posts/${encodeURIComponent(postId)}/reactions/${kind}`,
    { method: on ? "PUT" : "DELETE" },
  );
  return data.reactions;
}

export function listBlogComments(
  c: BlogCompetition,
  postId: string,
  page = 1,
): Promise<BlogCommentList> {
  return apiRequest<BlogCommentList>(
    `${blogApiBase(c)}/posts/${encodeURIComponent(postId)}/comments?page=${page}`,
  );
}

export async function createBlogComment(
  c: BlogCompetition,
  postId: string,
  body: string,
): Promise<BlogComment> {
  const data = await apiRequest<{ comment: BlogComment }>(
    `${blogApiBase(c)}/posts/${encodeURIComponent(postId)}/comments`,
    { method: "POST", body: JSON.stringify({ body }) },
  );
  return data.comment;
}

export async function updateBlogComment(
  c: BlogCompetition,
  commentId: string,
  body: string,
): Promise<BlogComment> {
  const data = await apiRequest<{ comment: BlogComment }>(
    `${blogApiBase(c)}/comments/${encodeURIComponent(commentId)}`,
    { method: "PATCH", body: JSON.stringify({ body }) },
  );
  return data.comment;
}

export async function deleteBlogComment(c: BlogCompetition, commentId: string): Promise<void> {
  await apiRequest(`${blogApiBase(c)}/comments/${encodeURIComponent(commentId)}`, {
    method: "DELETE",
  });
}

export async function moderateBlogComment(
  c: BlogCompetition,
  commentId: string,
  hidden: boolean,
  reason?: string | null,
): Promise<BlogComment> {
  const data = await apiRequest<{ comment: BlogComment }>(
    `${blogApiBase(c)}/comments/${encodeURIComponent(commentId)}/${hidden ? "hide" : "unhide"}`,
    { method: "POST", body: JSON.stringify(hidden ? { reason: reason ?? null } : {}) },
  );
  return data.comment;
}

export async function uploadBlogImage(c: BlogCompetition, file: File): Promise<string> {
  if (file.size === 0) throw new Error("Fichier vide");
  if (file.size > BLOG_IMAGE_MAX_BYTES) {
    throw new Error("Image trop volumineuse (3 Mo max)");
  }
  const data = await apiRequest<{ image: { url: string } }>(`${blogApiBase(c)}/images`, {
    method: "POST",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  return data.image.url;
}

/** « 12 mars 2027 » ; vide si absent. */
export function formatBlogDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Signature d'un contenu : coach, ou « coach supprimé ». */
export function authorLabel(author: BlogAuthor | null): string {
  return author?.coachName ?? "Coach supprimé";
}

/** Raison de masquage lisible (« blocklist:x » → message neutre). */
export function hiddenReasonLabel(hidden: HiddenInfo): string {
  if (!hidden.reason) return "Masqué par la modération";
  if (hidden.reason.startsWith("blocklist:")) {
    return "Masqué automatiquement (langage inapproprié)";
  }
  return `Masqué par la modération : ${hidden.reason}`;
}
