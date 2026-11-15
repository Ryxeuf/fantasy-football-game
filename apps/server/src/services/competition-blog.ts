/**
 * Blog d'une compétition — articles et réactions (change OpenSpec
 * `competition-blog`). Seul chemin d'écriture de `CompetitionPost` : c'est
 * ici que tient l'invariant `leagueId` XOR `cupId`.
 *
 * Chaque fonction reçoit un `BlogContext` (`resolveBlogContext`) : la
 * compétition est déjà VISIBLE du lecteur et ses droits sont tranchés par les
 * règles pures. Un article d'une autre compétition que celle de l'URL, ou
 * invisible du lecteur (brouillon d'un autre, masqué, supprimé), est un 404 —
 * jamais un 403 qui en confirmerait l'existence.
 */

import { prisma } from "../prisma";
import {
  BLOG_LIMITS,
  canDeletePost,
  canEditPost,
  canSeePost,
  comparePosts,
  excerptFromHtml,
  isPostOpenForInteraction,
  summarizeReactions,
  type ReactionKind,
  type ReactionSummary,
} from "./competition-blog-rules";
import {
  assertAllowed,
  competitionFk,
  CompetitionBlogError,
  type BlogContext,
} from "./competition-blog-context";
import { notifyPostPublished } from "./competition-blog-notifications";
import { detectBlocklist } from "./text-blocklist";
import { competitionBlogImagePrefixes } from "../utils/competition-blog-upload";
import {
  hasMeaningfulContent,
  isAllowedCompetitionImageUrl,
  sanitizeCompetitionPostHtml,
} from "../utils/sanitize-competition-post-html";

const POST_SELECT = {
  id: true,
  leagueId: true,
  cupId: true,
  authorId: true,
  title: true,
  excerpt: true,
  coverImageUrl: true,
  status: true,
  publishedAt: true,
  editedAt: true,
  pinnedAt: true,
  hiddenAt: true,
  hiddenReason: true,
  deletedAt: true,
  createdAt: true,
  author: { select: { id: true, coachName: true } },
  season: { select: { seasonNumber: true } },
} as const;

interface PostRow {
  id: string;
  leagueId: string | null;
  cupId: string | null;
  authorId: string | null;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  status: string;
  publishedAt: Date | null;
  editedAt: Date | null;
  pinnedAt: Date | null;
  hiddenAt: Date | null;
  hiddenReason: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  author: { id: string; coachName: string } | null;
  season: { seasonNumber: number } | null;
  contentHtml?: string;
}

export interface PostViewerRights {
  readonly canEdit: boolean;
  readonly canDelete: boolean;
}

export interface PostView {
  readonly id: string;
  readonly title: string;
  readonly excerpt: string;
  readonly contentHtml?: string;
  readonly coverImageUrl: string | null;
  readonly status: string;
  readonly publishedAt: string | null;
  readonly editedAt: string | null;
  readonly createdAt: string;
  readonly pinned: boolean;
  /** Présent pour l'auteur et les modérateurs seulement (les autres ne le voient pas). */
  readonly hidden: { readonly reason: string | null; readonly at: string } | null;
  /** `null` = compte supprimé. */
  readonly author: { readonly id: string; readonly coachName: string } | null;
  readonly seasonNumber: number | null;
  readonly reactions: ReactionSummary;
  readonly commentCount: number;
  readonly viewer: PostViewerRights;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function toView(
  ctx: BlogContext,
  row: PostRow,
  reactions: ReactionSummary,
  commentCount: number,
): PostView {
  const viewerId = ctx.viewer.userId;
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt ?? "",
    ...(row.contentHtml !== undefined ? { contentHtml: row.contentHtml } : {}),
    coverImageUrl: row.coverImageUrl,
    status: row.status,
    publishedAt: iso(row.publishedAt),
    editedAt: iso(row.editedAt),
    createdAt: row.createdAt.toISOString(),
    pinned: row.pinnedAt !== null,
    hidden: row.hiddenAt
      ? { reason: row.hiddenReason, at: row.hiddenAt.toISOString() }
      : null,
    author: row.author,
    seasonNumber: row.season?.seasonNumber ?? null,
    reactions,
    commentCount,
    viewer: {
      canEdit: canEditPost(row, viewerId, ctx.perms),
      canDelete: canDeletePost(row, viewerId, ctx.perms),
    },
  };
}

/** Réactions et commentaires visibles, pour une page d'articles, sans N+1. */
async function loadCounters(
  postIds: readonly string[],
  viewerId: string | null,
): Promise<{
  reactions: Map<string, ReactionSummary>;
  comments: Map<string, number>;
}> {
  const reactions = new Map<string, ReactionSummary>();
  const comments = new Map<string, number>();
  if (postIds.length === 0) return { reactions, comments };
  const ids = [...postIds];
  const [grouped, mine, commentGroups] = await Promise.all([
    prisma.competitionPostReaction.groupBy({
      by: ["postId", "kind"],
      where: { postId: { in: ids } },
      _count: { _all: true },
    }) as unknown as Promise<
      Array<{ postId: string; kind: string; _count: { _all: number } }>
    >,
    viewerId
      ? (prisma.competitionPostReaction.findMany({
          where: { postId: { in: ids }, userId: viewerId },
          select: { postId: true, kind: true },
        }) as Promise<Array<{ postId: string; kind: string }>>)
      : Promise.resolve([] as Array<{ postId: string; kind: string }>),
    prisma.competitionPostComment.groupBy({
      by: ["postId"],
      where: { postId: { in: ids }, deletedAt: null, hiddenAt: null },
      _count: { _all: true },
    }) as unknown as Promise<Array<{ postId: string; _count: { _all: number } }>>,
  ]);
  for (const id of ids) {
    reactions.set(
      id,
      summarizeReactions(
        grouped
          .filter((g) => g.postId === id)
          .map((g) => ({ kind: g.kind, count: g._count._all })),
        mine.filter((m) => m.postId === id).map((m) => m.kind),
      ),
    );
  }
  for (const g of commentGroups) comments.set(g.postId, g._count._all);
  return { reactions, comments };
}

async function viewsOf(ctx: BlogContext, rows: readonly PostRow[]): Promise<PostView[]> {
  const { reactions, comments } = await loadCounters(
    rows.map((r) => r.id),
    ctx.viewer.userId,
  );
  return rows.map((r) =>
    toView(ctx, r, reactions.get(r.id) ?? summarizeReactions([], []), comments.get(r.id) ?? 0),
  );
}

/** Clause Prisma : articles publiés visibles du lecteur dans la compétition. */
function publishedVisibleWhere(ctx: BlogContext) {
  const viewerId = ctx.viewer.userId;
  const hiddenClause = ctx.perms.canModerate
    ? {}
    : viewerId
      ? { OR: [{ hiddenAt: null }, { authorId: viewerId }] }
      : { hiddenAt: null };
  return {
    ...competitionFk(ctx.competition),
    status: "published",
    deletedAt: null,
    ...hiddenClause,
  };
}

export interface ListPostsInput {
  readonly page: number;
  readonly limit: number;
  /** `mine` : les brouillons du lecteur au lieu des articles publiés. */
  readonly drafts?: "mine";
}

export interface ListPostsResult {
  readonly pinned: PostView[];
  readonly posts: PostView[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

const PINNED_CAP = 10;

export async function listPosts(
  ctx: BlogContext,
  input: ListPostsInput,
): Promise<ListPostsResult> {
  const limit = Math.min(Math.max(input.limit, 1), BLOG_LIMITS.pageSizeMax);
  const page = Math.max(input.page, 1);
  if (input.drafts === "mine") {
    if (!ctx.viewer.userId) {
      return { pinned: [], posts: [], total: 0, page, limit };
    }
    const where = {
      ...competitionFk(ctx.competition),
      status: "draft",
      deletedAt: null,
      authorId: ctx.viewer.userId,
    };
    const [rows, total] = await Promise.all([
      prisma.competitionPost.findMany({
        where,
        select: POST_SELECT,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }) as unknown as Promise<PostRow[]>,
      prisma.competitionPost.count({ where }),
    ]);
    return { pinned: [], posts: await viewsOf(ctx, rows), total, page, limit };
  }
  const base = publishedVisibleWhere(ctx);
  const regularWhere = { ...base, pinnedAt: null };
  const [pinnedRows, rows, total] = await Promise.all([
    page === 1
      ? (prisma.competitionPost.findMany({
          where: { ...base, pinnedAt: { not: null } },
          select: { ...POST_SELECT },
          orderBy: [{ pinnedAt: "desc" }, { id: "desc" }],
          take: PINNED_CAP,
        }) as unknown as Promise<PostRow[]>)
      : Promise.resolve([] as PostRow[]),
    prisma.competitionPost.findMany({
      where: regularWhere,
      select: POST_SELECT,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }) as unknown as Promise<PostRow[]>,
    prisma.competitionPost.count({ where: regularWhere }),
  ]);
  const views = await viewsOf(ctx, [...pinnedRows].sort(comparePosts).concat(rows));
  return {
    pinned: views.slice(0, pinnedRows.length),
    posts: views.slice(pinnedRows.length),
    total,
    page,
    limit,
  };
}

/** Article de CETTE compétition, visible du lecteur ; sinon 404. */
async function loadPost(
  ctx: BlogContext,
  postId: string,
  withContent = false,
): Promise<PostRow> {
  const row = (await prisma.competitionPost.findUnique({
    where: { id: postId },
    select: { ...POST_SELECT, ...(withContent ? { contentHtml: true } : {}) },
  })) as PostRow | null;
  const fk = competitionFk(ctx.competition);
  const belongs =
    !!row &&
    ("leagueId" in fk ? row.leagueId === fk.leagueId : row.cupId === fk.cupId);
  if (!row || !belongs || !canSeePost(row, ctx.viewer.userId, ctx.perms)) {
    throw new CompetitionBlogError("not_found", "Article introuvable");
  }
  return row;
}

export async function getPost(ctx: BlogContext, postId: string): Promise<PostView> {
  const row = await loadPost(ctx, postId, true);
  const [view] = await viewsOf(ctx, [row]);
  return view;
}

/** Article visible du lecteur (lecture des commentaires, appartenance). */
export async function getPostForComments(
  ctx: BlogContext,
  postId: string,
): Promise<PostRow> {
  return loadPost(ctx, postId);
}

/** Article publié et ouvert aux interactions (réactions, commentaires). */
export async function loadInteractivePost(
  ctx: BlogContext,
  postId: string,
): Promise<PostRow> {
  const row = await loadPost(ctx, postId);
  if (!isPostOpenForInteraction(row)) {
    throw new CompetitionBlogError("not_found", "Article introuvable");
  }
  return row;
}

export interface PostContentInput {
  readonly title?: string;
  readonly contentHtml?: string;
  readonly coverImageUrl?: string | null;
}

interface CleanContent {
  title?: string;
  contentHtml?: string;
  excerpt?: string;
  coverImageUrl?: string | null;
}

function cleanContent(ctx: BlogContext, input: PostContentInput): CleanContent {
  const out: CleanContent = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title || title.length > BLOG_LIMITS.titleMax) {
      throw new CompetitionBlogError(
        "invalid",
        `Titre requis (${BLOG_LIMITS.titleMax} caracteres max)`,
      );
    }
    out.title = title;
  }
  const prefixes = competitionBlogImagePrefixes(ctx.competition.kind, ctx.competition.id);
  if (input.contentHtml !== undefined) {
    const html = sanitizeCompetitionPostHtml(input.contentHtml, {
      allowedImagePrefixes: prefixes,
    });
    if (!hasMeaningfulContent(html)) {
      throw new CompetitionBlogError("invalid", "L'article est vide");
    }
    if (html.length > BLOG_LIMITS.contentHtmlMax) {
      throw new CompetitionBlogError("invalid", "L'article est trop long");
    }
    out.contentHtml = html;
    out.excerpt = excerptFromHtml(html);
  }
  if (input.coverImageUrl !== undefined) {
    if (
      input.coverImageUrl !== null &&
      !isAllowedCompetitionImageUrl(input.coverImageUrl, prefixes)
    ) {
      throw new CompetitionBlogError(
        "invalid",
        "Image de couverture invalide : uploadez-la sur le blog de la competition",
      );
    }
    out.coverImageUrl = input.coverImageUrl;
  }
  return out;
}

/** Masquage automatique d'un article dont le titre ou le texte tombe sous la blocklist. */
function blocklistHide(content: CleanContent) {
  const text = `${content.title ?? ""} ${content.excerpt ?? ""} ${
    content.contentHtml ? excerptFromHtml(content.contentHtml, 100_000) : ""
  }`;
  const match = detectBlocklist(text);
  return match
    ? { hiddenAt: new Date(), hiddenById: null, hiddenReason: `blocklist:${match}` }
    : {};
}

async function assertPublishQuota(ctx: BlogContext, authorId: string): Promise<void> {
  const since = new Date(Date.now() - BLOG_LIMITS.publishWindowMs);
  const recent = await prisma.competitionPost.count({
    where: {
      ...competitionFk(ctx.competition),
      authorId,
      publishedAt: { gte: since },
    },
  });
  if (recent >= BLOG_LIMITS.publishPerWindow) {
    throw new CompetitionBlogError(
      "rate_limited",
      "Trop d'articles publies recemment : reessayez plus tard",
    );
  }
}

function requireUser(ctx: BlogContext): string {
  if (!ctx.viewer.userId) {
    throw new CompetitionBlogError("forbidden", "Connexion requise");
  }
  return ctx.viewer.userId;
}

async function authorName(userId: string): Promise<string> {
  const user = (await prisma.user.findUnique({
    where: { id: userId },
    select: { coachName: true },
  })) as { coachName: string } | null;
  return user?.coachName ?? "Un coach";
}

export interface CreatePostInput extends Required<Pick<PostContentInput, "title" | "contentHtml">> {
  readonly coverImageUrl?: string | null;
  readonly publish?: boolean;
}

export async function createPost(
  ctx: BlogContext,
  input: CreatePostInput,
): Promise<PostView> {
  const userId = requireUser(ctx);
  assertAllowed(ctx, ctx.perms.canWrite, "publier");
  const content = cleanContent(ctx, input);
  const publish = input.publish === true;
  if (publish) await assertPublishQuota(ctx, userId);
  const now = new Date();
  const created = (await prisma.competitionPost.create({
    data: {
      ...competitionFk(ctx.competition),
      authorId: userId,
      title: content.title!,
      contentHtml: content.contentHtml!,
      excerpt: content.excerpt ?? null,
      coverImageUrl: content.coverImageUrl ?? null,
      status: publish ? "published" : "draft",
      publishedAt: publish ? now : null,
      seasonId: publish ? ctx.currentSeasonId : null,
      ...blocklistHide(content),
    },
    select: { id: true, title: true, authorId: true, hiddenAt: true },
  })) as { id: string; title: string; authorId: string | null; hiddenAt: Date | null };
  if (publish && !created.hiddenAt) {
    await notifyPostPublished(ctx, created, await authorName(userId));
  }
  return getPost(ctx, created.id);
}

export async function updatePost(
  ctx: BlogContext,
  postId: string,
  input: PostContentInput,
): Promise<PostView> {
  requireUser(ctx);
  const row = await loadPost(ctx, postId);
  if (!canEditPost(row, ctx.viewer.userId, ctx.perms)) {
    assertAllowed(ctx, false, "modifier");
  }
  const content = cleanContent(ctx, input);
  const autoHide = row.hiddenAt ? {} : blocklistHide(content);
  await prisma.competitionPost.update({
    where: { id: row.id },
    data: {
      ...content,
      ...(row.status === "published" ? { editedAt: new Date() } : {}),
      ...autoHide,
    },
  });
  return getPost(ctx, row.id);
}

export async function setPostPublished(
  ctx: BlogContext,
  postId: string,
  published: boolean,
): Promise<PostView> {
  const userId = requireUser(ctx);
  const row = await loadPost(ctx, postId);
  if (!canEditPost(row, userId, ctx.perms)) assertAllowed(ctx, false, "publier");
  const target = published ? "published" : "draft";
  if (row.status === target) return getPost(ctx, row.id);
  if (published && !row.publishedAt) await assertPublishQuota(ctx, userId);
  await prisma.competitionPost.update({
    where: { id: row.id },
    data: {
      status: target,
      // Write-once : une republication garde la date (et la saison) d'origine.
      ...(published && !row.publishedAt
        ? { publishedAt: new Date(), seasonId: ctx.currentSeasonId }
        : {}),
    },
  });
  if (published && !row.hiddenAt) {
    await notifyPostPublished(ctx, row, await authorName(userId));
  }
  return getPost(ctx, row.id);
}

export async function deletePost(ctx: BlogContext, postId: string): Promise<void> {
  requireUser(ctx);
  const row = await loadPost(ctx, postId);
  if (!canDeletePost(row, ctx.viewer.userId, ctx.perms)) {
    throw new CompetitionBlogError("forbidden", "Suppression reservee a l'auteur ou au commissaire");
  }
  await prisma.competitionPost.update({
    where: { id: row.id },
    data: { deletedAt: new Date(), pinnedAt: null },
  });
}

function assertModerator(ctx: BlogContext): string {
  const userId = requireUser(ctx);
  if (!ctx.perms.canModerate) {
    throw new CompetitionBlogError(
      "forbidden",
      "Moderation reservee au commissaire de la competition",
    );
  }
  return userId;
}

export async function setPostPinned(
  ctx: BlogContext,
  postId: string,
  pinned: boolean,
): Promise<PostView> {
  assertModerator(ctx);
  const row = await loadPost(ctx, postId);
  if (pinned && row.status !== "published") {
    throw new CompetitionBlogError("invalid", "Seul un article publie s'epingle");
  }
  await prisma.competitionPost.update({
    where: { id: row.id },
    data: { pinnedAt: pinned ? new Date() : null },
  });
  return getPost(ctx, row.id);
}

export async function setPostHidden(
  ctx: BlogContext,
  postId: string,
  hidden: boolean,
  reason?: string | null,
): Promise<PostView> {
  const moderatorId = assertModerator(ctx);
  const row = await loadPost(ctx, postId);
  await prisma.competitionPost.update({
    where: { id: row.id },
    data: hidden
      ? {
          hiddenAt: new Date(),
          hiddenById: moderatorId,
          hiddenReason: reason?.trim() || null,
        }
      : { hiddenAt: null, hiddenById: null, hiddenReason: null },
  });
  return getPost(ctx, row.id);
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: unknown }).code === "P2002"
  );
}

/** Pose (`on`) ou retire une réaction ; idempotent dans les deux sens. */
export async function setReaction(
  ctx: BlogContext,
  postId: string,
  kind: ReactionKind,
  on: boolean,
): Promise<ReactionSummary> {
  const userId = requireUser(ctx);
  assertAllowed(ctx, ctx.perms.canReact, "reagir");
  const row = await loadInteractivePost(ctx, postId);
  if (on) {
    try {
      await prisma.competitionPostReaction.upsert({
        where: { postId_userId_kind: { postId: row.id, userId, kind } },
        create: { postId: row.id, userId, kind },
        update: {},
      });
    } catch (e: unknown) {
      // Deux clics simultanés : le second voit la contrainte unique.
      if (!isUniqueViolation(e)) throw e;
    }
  } else {
    await prisma.competitionPostReaction.deleteMany({
      where: { postId: row.id, userId, kind },
    });
  }
  const { reactions } = await loadCounters([row.id], userId);
  return reactions.get(row.id) ?? summarizeReactions([], []);
}
