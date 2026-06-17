/**
 * Routes d'administration du blog.
 * - Auth : authUser + adminOnly.
 * - Validation : Zod schemas (blog.schemas.ts).
 * - Sanitization : sanitizeBlogHtml() avant écriture en base.
 * - Audit : safeRecordAdminActionFromRequest pour create/update/delete.
 */

import { Router, raw } from "express";
import type { Request, Response, NextFunction } from "express";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
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
import {
  BLOG_UPLOAD_DIR,
  MAX_UPLOAD_BYTES,
  detectImageType,
  generateImageFilename,
  buildPublicUrl,
} from "../utils/blog-upload";

const router = Router();

router.use(authUser, adminOnly);

/**
 * Parse le corps brut (n'importe quel Content-Type) en Buffer, plafonné à
 * MAX_UPLOAD_BYTES. Renvoie une erreur JSON propre si le payload dépasse la
 * limite, au lieu de laisser fuiter la stack du handler d'erreur Express.
 */
const rawImageParser = raw({ type: () => true, limit: MAX_UPLOAD_BYTES });
function parseRawImage(req: Request, res: Response, next: NextFunction): void {
  rawImageParser(req, res, (err: unknown) => {
    if (err) {
      if ((err as { type?: string }).type === "entity.too.large") {
        res.status(413).json({ error: "Image trop volumineuse (max 8 Mo)" });
        return;
      }
      res.status(400).json({ error: "Corps de requête invalide" });
      return;
    }
    next();
  });
}

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
    const body: {
      slug: string;
      title: string;
      excerpt?: string | null;
      contentHtml: string;
      coverImageUrl?: string | null;
      status: "draft" | "published";
    } = req.body;
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
    const body: {
      slug?: string;
      title?: string;
      excerpt?: string | null;
      contentHtml?: string;
      coverImageUrl?: string | null;
      status?: "draft" | "published";
    } = req.body;

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

/**
 * Upload d'une image du blog. Réservé aux admins (router.use ci-dessus).
 *
 * Corps : binaire brut de l'image (pas de multipart) — le client envoie le
 * fichier directement comme body. Optionnel : `?filename=` pour suggérer une
 * base de nom (slug d'article). Le type réel est détecté par magic bytes et
 * le nom de fichier est régénéré côté serveur (anti path traversal).
 *
 * Appelable depuis l'admin (éditeur) comme depuis une automatisation (n8n) :
 * `POST https://api.nufflearena.fr/api/admin/blog/upload?filename=mon-slug`
 * avec `Authorization: Bearer <jwt>` et le binaire en corps.
 *
 * Réponse 201 : { url, filename, mime, bytes }.
 */
router.post("/upload", parseRawImage, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const buf: unknown = req.body;
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      return res.status(400).json({ error: "Aucune donnée binaire reçue" });
    }
    const detected = detectImageType(buf);
    if (!detected) {
      return res.status(415).json({
        error: "Format non supporté (PNG, JPEG, GIF ou WEBP attendu)",
      });
    }
    const hint =
      typeof req.query.filename === "string" ? req.query.filename : undefined;
    const filename = generateImageFilename(hint, detected.ext);

    await mkdir(BLOG_UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(BLOG_UPLOAD_DIR, filename), buf);

    const url = buildPublicUrl(filename);
    await safeAudit(authReq, {
      action: "blog-image.upload",
      entity: "BlogImage",
      entityId: filename,
      newValue: { filename, bytes: buf.length, mime: detected.mime },
    });
    res.status(201).json({ url, filename, mime: detected.mime, bytes: buf.length });
  } catch (error: unknown) {
    serverLog.error("[admin-blog] upload failed", error);
    res.status(500).json({ error: "Erreur serveur lors de l'upload" });
  }
});

export default router;
