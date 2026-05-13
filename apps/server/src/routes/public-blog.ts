/**
 * Routes publiques du blog. Lecture seule, cache 5 min via memoizeAsync.
 * Seuls les articles `status === "published"` sont exposés.
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { memoizeAsync, invalidateMemoNamespace } from "../utils/memoize-async";
import { validateQuery } from "../middleware/validate";
import { publicBlogListQuerySchema } from "../schemas/blog.schemas";
import { serverLog } from "../utils/server-log";

const router = Router();

const BLOG_CACHE_TTL_MS = 5 * 60 * 1000;
const BLOG_NS = "public-blog";

export function invalidatePublicBlogCache(): void {
  invalidateMemoNamespace(BLOG_NS);
}

interface PublicBlogPostListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  authorName: string | null;
}

interface PublicBlogPostDetail extends PublicBlogPostListItem {
  contentHtml: string;
  updatedAt: string;
}

async function loadPublicList(
  page: number,
  limit: number,
): Promise<{ posts: PublicBlogPostListItem[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.blogPost.findMany({
      where: { status: "published", publishedAt: { not: null } },
      orderBy: [{ publishedAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        coverImageUrl: true,
        publishedAt: true,
        author: { select: { coachName: true } },
      },
    }),
    prisma.blogPost.count({
      where: { status: "published", publishedAt: { not: null } },
    }),
  ]);
  const posts: PublicBlogPostListItem[] = rows.map((r: typeof rows[number]) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    coverImageUrl: r.coverImageUrl,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    authorName: r.author?.coachName ?? null,
  }));
  return { posts, total };
}

async function loadPublicDetail(
  slug: string,
): Promise<PublicBlogPostDetail | null> {
  const row = await prisma.blogPost.findFirst({
    where: { slug, status: "published", publishedAt: { not: null } },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      contentHtml: true,
      coverImageUrl: true,
      publishedAt: true,
      updatedAt: true,
      author: { select: { coachName: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    contentHtml: row.contentHtml,
    coverImageUrl: row.coverImageUrl,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
    authorName: row.author?.coachName ?? null,
  };
}

router.get(
  "/blog/posts",
  validateQuery(publicBlogListQuerySchema),
  async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const payload = await memoizeAsync(
        BLOG_NS,
        `list::${page}::${limit}`,
        BLOG_CACHE_TTL_MS,
        () => loadPublicList(page, limit),
      );
      res.json({ ...payload, page, limit });
    } catch (error: unknown) {
      serverLog.error("[public-blog] list failed", error);
      res.setHeader("Cache-Control", "no-store");
      res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

router.get("/blog/posts/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const payload = await memoizeAsync(
      BLOG_NS,
      `slug::${slug}`,
      BLOG_CACHE_TTL_MS,
      () => loadPublicDetail(slug),
    );
    if (!payload) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(404).json({ error: "Article introuvable" });
    }
    res.json({ post: payload });
  } catch (error: unknown) {
    serverLog.error("[public-blog] detail failed", error);
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
