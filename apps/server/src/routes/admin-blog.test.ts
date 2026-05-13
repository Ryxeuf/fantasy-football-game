/**
 * Tests d'intégration des endpoints /api/admin/blog/posts.
 * Couvre : list, get, create (avec sanitization HTML + audit), update
 * (publication = set publishedAt première fois seulement), delete, mapping
 * P2002/P2025 → 409/404.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    blogPost: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("../middleware/authUser", () => ({
  authUser: (req: any, _res: any, next: any) => {
    req.user = { id: "admin-1", role: "admin", roles: ["admin"] };
    return next();
  },
}));

vi.mock("../middleware/adminOnly", () => ({
  adminOnly: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../services/audit-log", () => ({
  safeRecordAdminActionFromRequest: vi.fn(async () => {}),
}));

vi.mock("./public-blog", () => ({
  invalidatePublicBlogCache: vi.fn(),
}));

import express from "express";
import http from "http";
import blogRouter from "./admin-blog";
import { prisma } from "../prisma";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import { invalidatePublicBlogCache } from "./public-blog";

const mockedAudit = vi.mocked(safeRecordAdminActionFromRequest);
const mockedInvalidate = vi.mocked(invalidatePublicBlogCache);

interface MockedPrisma {
  blogPost: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}

const mockedPrisma = prisma as unknown as MockedPrisma;

async function request(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body: Record<string, unknown> | null = null,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/blog", blogRouter);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const data = body !== null ? JSON.stringify(body) : "";
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: `/api/admin/blog${path}`,
          method,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data).toString(),
            Authorization: "Bearer dummy",
          },
        },
        (res) => {
          let buf = "";
          res.on("data", (c) => (buf += c));
          res.on("end", () => {
            server.close();
            try {
              resolve({
                status: res.statusCode ?? 0,
                body: buf ? JSON.parse(buf) : {},
              });
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on("error", (e) => {
        server.close();
        reject(e);
      });
      if (data) req.write(data);
      req.end();
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/blog/posts", () => {
  it("liste tous les articles, ordre updatedAt desc", async () => {
    mockedPrisma.blogPost.findMany.mockResolvedValueOnce([
      {
        id: "p1",
        slug: "hello",
        title: "Hello",
        excerpt: null,
        status: "draft",
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        coverImageUrl: null,
        author: { id: "u1", coachName: "Admin" },
      },
    ]);
    const res = await request("GET", "/posts");
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    expect(mockedPrisma.blogPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: "desc" }],
      }),
    );
  });

  it("filtre par status si fourni", async () => {
    mockedPrisma.blogPost.findMany.mockResolvedValueOnce([]);
    await request("GET", "/posts?status=published");
    expect(mockedPrisma.blogPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "published" } }),
    );
  });
});

describe("POST /api/admin/blog/posts", () => {
  it("crée un article draft, sanitize le HTML, audit + invalidate cache", async () => {
    mockedPrisma.blogPost.create.mockResolvedValueOnce({
      id: "p1",
      slug: "hello",
      status: "draft",
    });
    const res = await request("POST", "/posts", {
      slug: "hello",
      title: "Hello world",
      contentHtml:
        '<p>Hi <script>alert(1)</script><a href="https://x.com">link</a></p>',
      status: "draft",
    });
    expect(res.status).toBe(201);
    const createCall = mockedPrisma.blogPost.create.mock.calls[0][0];
    expect(createCall.data.contentHtml).not.toContain("<script>");
    expect(createCall.data.contentHtml).toContain("<a");
    expect(createCall.data.contentHtml).toContain('rel="noopener noreferrer nofollow"');
    expect(createCall.data.publishedAt).toBeNull();
    expect(createCall.data.authorId).toBe("admin-1");
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    expect(mockedInvalidate).toHaveBeenCalledTimes(1);
  });

  it("set publishedAt si status=published à la création", async () => {
    mockedPrisma.blogPost.create.mockResolvedValueOnce({
      id: "p1",
      slug: "live",
      status: "published",
    });
    await request("POST", "/posts", {
      slug: "live",
      title: "Live now",
      contentHtml: "<p>ok</p>",
      status: "published",
    });
    const createCall = mockedPrisma.blogPost.create.mock.calls[0][0];
    expect(createCall.data.publishedAt).toBeInstanceOf(Date);
  });

  it("renvoie 409 sur conflit de slug (P2002)", async () => {
    mockedPrisma.blogPost.create.mockRejectedValueOnce({ code: "P2002" });
    const res = await request("POST", "/posts", {
      slug: "dup",
      title: "Dup",
      contentHtml: "<p>x</p>",
      status: "draft",
    });
    expect(res.status).toBe(409);
  });

  it("renvoie 400 si slug invalide (validation Zod)", async () => {
    const res = await request("POST", "/posts", {
      slug: "Bad Slug!",
      title: "Bad",
      contentHtml: "<p>x</p>",
      status: "draft",
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/blog/posts/:id", () => {
  it("publie un draft : set publishedAt à la première publication", async () => {
    mockedPrisma.blogPost.findUnique.mockResolvedValueOnce({
      slug: "x",
      title: "X",
      status: "draft",
      publishedAt: null,
    });
    mockedPrisma.blogPost.update.mockResolvedValueOnce({
      id: "p1",
      slug: "x",
      status: "published",
      title: "X",
    });
    await request("PATCH", "/posts/p1", { status: "published" });
    const updateCall = mockedPrisma.blogPost.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe("published");
    expect(updateCall.data.publishedAt).toBeInstanceOf(Date);
  });

  it("repassage draft → published existant : ne réécrit pas publishedAt", async () => {
    const original = new Date("2026-01-01");
    mockedPrisma.blogPost.findUnique.mockResolvedValueOnce({
      slug: "x",
      title: "X",
      status: "draft",
      publishedAt: original,
    });
    mockedPrisma.blogPost.update.mockResolvedValueOnce({
      id: "p1",
      slug: "x",
      status: "published",
      title: "X",
    });
    await request("PATCH", "/posts/p1", { status: "published" });
    const updateCall = mockedPrisma.blogPost.update.mock.calls[0][0];
    expect(updateCall.data.publishedAt).toBeUndefined();
  });

  it("renvoie 404 si article introuvable", async () => {
    mockedPrisma.blogPost.findUnique.mockResolvedValueOnce(null);
    const res = await request("PATCH", "/posts/missing", {
      title: "New",
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/blog/posts/:id", () => {
  it("supprime + audit + invalidate cache", async () => {
    mockedPrisma.blogPost.findUnique.mockResolvedValueOnce({
      slug: "x",
      title: "X",
      status: "draft",
    });
    mockedPrisma.blogPost.delete.mockResolvedValueOnce({});
    const res = await request("DELETE", "/posts/p1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    expect(mockedInvalidate).toHaveBeenCalledTimes(1);
  });

  it("renvoie 404 si article introuvable", async () => {
    mockedPrisma.blogPost.findUnique.mockResolvedValueOnce(null);
    const res = await request("DELETE", "/posts/missing");
    expect(res.status).toBe(404);
  });
});
