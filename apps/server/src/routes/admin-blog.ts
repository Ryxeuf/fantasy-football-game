/**
 * Routes d'administration du blog.
 * - Auth : authUser + adminOnly.
 * - Validation : Zod schemas (blog.schemas.ts).
 * - Sanitization : sanitizeBlogHtml() avant écriture en base.
 * - Audit : safeRecordAdminActionFromRequest pour create/update/delete.
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { adminOnly } from "../middleware/adminOnly";
import { authUser } from "../middleware/authUser";
import type { AuthenticatedRequest } from "../middleware/authUser";
import { validate, validateQuery } from "../middleware/validate";
import {
  createBlogPostSchema,
  updateBlogPostSchema,
  adminBlogListQuerySchema,
} from "../schemas/blog.schemas";
import { sanitizeBlogHtml } from "../utils/sanitize-blog-html";
import { serverLog } from "../utils/server-log";
import {
  safeRecordAdminActionFromRequest,
  type RecordAdminActionInput,
} from "../services/audit-log";
import { invalidatePublicBlogCache } from "./public-blog";

const router = Router();

router.use(authUser, adminOnly);

async function safeAudit(
  req: AuthenticatedRequest,
  partial: Omit<RecordAdminActionInput, "userId" | "ipAddress" | "userAgent">,
): Promise<void> {
  await safeRecordAdminActionFromRequest(prisma, req, partial);
}

router.get(
  "/posts",
  validateQuery(adminBlogListQuerySchema),
  async (req, res) => {
    try {
      const { status, search } = req.query as {
        status?: "draft" | "published";
        search?: string;
      };
      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
        ];
      }
      const posts = await prisma.blogPost.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          status: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          coverImageUrl: true,
          author: { select: { id: true, coachName: true } },
        },
      });
      res.json({ posts });
    } catch (error: unknown) {
      serverLog.error("[admin-blog] list failed", error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

router.get("/posts/:id", async (req, res) => {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { id: req.params.id },
      include: { author: { select: { id: true, coachName: true } } },
    });
    if (!post) {
      return res.status(404).json({ error: "Article introuvable" });
    }
    res.json({ post });
  } catch (error: unknown) {
    serverLog.error("[admin-blog] get failed", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/posts", validate(createBlogPostSchema), async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const authorId = authReq.user?.id ?? null;
  try {
    const body = req.body as {
      slug: string;
      title: string;
      excerpt?: string | null;
      contentHtml: string;
      coverImageUrl?: string | null;
      status: "draft" | "published";
    };
    const sanitized = sanitizeBlogHtml(body.contentHtml);
    const publishedAt = body.status === "published" ? new Date() : null;

    const post = await prisma.blogPost.create({
      data: {
        slug: body.slug,
        title: body.title,
        excerpt: body.excerpt ?? null,
        contentHtml: sanitized,
        coverImageUrl: body.coverImageUrl || null,
        status: body.status,
        publishedAt,
        authorId,
      },
    });
    await safeAudit(authReq, {
      action: "blog-post.create",
      entity: "BlogPost",
      entityId: post.id,
      newValue: { slug: post.slug, status: post.status },
    });
    invalidatePublicBlogCache();
    res.status(201).json({ post });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return res.status(409).json({ error: "Ce slug existe déjà" });
    }
    serverLog.error("[admin-blog] create failed", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.patch("/posts/:id", validate(updateBlogPostSchema), async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const body = req.body as {
      slug?: string;
      title?: string;
      excerpt?: string | null;
      contentHtml?: string;
      coverImageUrl?: string | null;
      status?: "draft" | "published";
    };

    const previous = await prisma.blogPost.findUnique({
      where: { id: req.params.id },
      select: { slug: true, title: true, status: true, publishedAt: true },
    });
    if (!previous) {
      return res.status(404).json({ error: "Article introuvable" });
    }

    const data: Record<string, unknown> = {};
    if (body.slug !== undefined) data.slug = body.slug;
    if (body.title !== undefined) data.title = body.title;
    if (body.excerpt !== undefined) data.excerpt = body.excerpt ?? null;
    if (body.contentHtml !== undefined)
      data.contentHtml = sanitizeBlogHtml(body.contentHtml);
    if (body.coverImageUrl !== undefined)
      data.coverImageUrl = body.coverImageUrl || null;
    if (body.status !== undefined) {
      data.status = body.status;
      if (body.status === "published" && !previous.publishedAt) {
        data.publishedAt = new Date();
      }
    }

    const post = await prisma.blogPost.update({
      where: { id: req.params.id },
      data,
    });
    await safeAudit(authReq, {
      action: "blog-post.update",
      entity: "BlogPost",
      entityId: post.id,
      oldValue: previous,
      newValue: { slug: post.slug, status: post.status, title: post.title },
    });
    invalidatePublicBlogCache();
    res.json({ post });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return res.status(404).json({ error: "Article introuvable" });
    }
    if ((error as { code?: string }).code === "P2002") {
      return res.status(409).json({ error: "Ce slug existe déjà" });
    }
    serverLog.error("[admin-blog] update failed", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/posts/:id", async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const previous = await prisma.blogPost.findUnique({
      where: { id: req.params.id },
      select: { slug: true, title: true, status: true },
    });
    if (!previous) {
      return res.status(404).json({ error: "Article introuvable" });
    }
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    await safeAudit(authReq, {
      action: "blog-post.delete",
      entity: "BlogPost",
      entityId: req.params.id,
      oldValue: previous,
    });
    invalidatePublicBlogCache();
    res.json({ ok: true });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return res.status(404).json({ error: "Article introuvable" });
    }
    serverLog.error("[admin-blog] delete failed", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
