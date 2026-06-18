/**
 * Tests des routes médiathèque (`GET/PATCH/DELETE /api/admin/blog/images`).
 * On exerce le **vrai** store disque contre un dossier temporaire (env
 * `BLOG_UPLOAD_DIR`) et on mocke uniquement prisma (reference-check), l'auth,
 * l'audit et l'invalidation de cache. Fichier séparé de `admin-blog.test.ts`
 * et `admin-blog-upload.test.ts` (ce dernier mocke `node:fs/promises` global).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import http from "node:http";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("../prisma", () => ({
  prisma: { blogPost: { findMany: vi.fn() } },
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
vi.mock("./public-blog", () => ({ invalidatePublicBlogCache: vi.fn() }));

import blogRouter from "./admin-blog";
import { prisma } from "../prisma";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";

const mockedFindMany = (
  prisma as unknown as {
    blogPost: { findMany: ReturnType<typeof vi.fn> };
  }
).blogPost.findMany;
const mockedAudit = vi.mocked(safeRecordAdminActionFromRequest);

function makePng(w: number, h: number): Buffer {
  const buf = Buffer.alloc(24);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  buf.set([0x49, 0x48, 0x44, 0x52], 12);
  buf.writeUInt32BE(w, 16);
  buf.writeUInt32BE(h, 20);
  return buf;
}

let dir: string;

beforeEach(async () => {
  vi.clearAllMocks();
  dir = await fs.mkdtemp(path.join(tmpdir(), "blog-img-routes-"));
  process.env.BLOG_UPLOAD_DIR = dir;
});

afterEach(async () => {
  delete process.env.BLOG_UPLOAD_DIR;
  await fs.rm(dir, { recursive: true, force: true });
});

async function seedPng(name: string, w = 320, h = 240): Promise<void> {
  await fs.writeFile(path.join(dir, name), makePng(w, h));
}

async function request(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  routePath: string,
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
          path: `/api/admin/blog${routePath}`,
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

describe("GET /api/admin/blog/images", () => {
  it("liste les images uploadées avec leurs dimensions", async () => {
    await seedPng("orc-aaaaaaaaaaaa.png", 800, 600);
    await seedPng("elf-bbbbbbbbbbbb.png", 100, 100);
    const res = await request("GET", "/images");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const orc = res.body.images.find(
      (i: any) => i.filename === "orc-aaaaaaaaaaaa.png",
    );
    expect(orc).toMatchObject({
      width: 800,
      height: 600,
      url: "/images/blog/orc-aaaaaaaaaaaa.png",
    });
  });

  it("filtre par recherche", async () => {
    await seedPng("orc-aaaaaaaaaaaa.png");
    await seedPng("elf-bbbbbbbbbbbb.png");
    const res = await request("GET", "/images?search=orc");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.images[0].filename).toContain("orc");
  });
});

describe("PATCH /api/admin/blog/images/:filename", () => {
  it("met à jour le texte alternatif", async () => {
    await seedPng("pic-cccccccccccc.png", 50, 50);
    const res = await request("PATCH", "/images/pic-cccccccccccc.png", {
      alt: "Un Troll",
    });
    expect(res.status).toBe(200);
    expect(res.body.image).toMatchObject({
      alt: "Un Troll",
      width: 50,
      height: 50,
    });
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        action: "blog-image.update",
        entityId: "pic-cccccccccccc.png",
      }),
    );
  });

  it("renvoie 404 si l'image n'existe pas", async () => {
    const res = await request("PATCH", "/images/ghost-dddddddddddd.png", {
      alt: "x",
    });
    expect(res.status).toBe(404);
  });

  it("renvoie 400 pour un nom de fichier non-image", async () => {
    const res = await request("PATCH", "/images/evil.txt", { alt: "x" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/blog/images/:filename", () => {
  it("supprime une image non référencée", async () => {
    await seedPng("del-eeeeeeeeeeee.png");
    mockedFindMany.mockResolvedValue([]);
    const res = await request("DELETE", "/images/del-eeeeeeeeeeee.png");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    await expect(
      fs.access(path.join(dir, "del-eeeeeeeeeeee.png")),
    ).rejects.toThrow();
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "blog-image.delete" }),
    );
  });

  it("bloque (409) la suppression d'une image référencée par un article", async () => {
    await seedPng("used-ffffffffffff.png");
    mockedFindMany.mockResolvedValue([
      { id: "p1", slug: "mon-article", title: "Mon article" },
    ]);
    const res = await request("DELETE", "/images/used-ffffffffffff.png");
    expect(res.status).toBe(409);
    expect(res.body.referencedBy).toHaveLength(1);
    expect(res.body.referencedBy[0].slug).toBe("mon-article");
    // L'image ne doit PAS avoir été supprimée.
    await expect(
      fs.access(path.join(dir, "used-ffffffffffff.png")),
    ).resolves.toBeUndefined();
  });

  it("force=true outrepasse le reference-check", async () => {
    await seedPng("force-gggggggggggg.png");
    const res = await request(
      "DELETE",
      "/images/force-gggggggggggg.png?force=true",
    );
    expect(res.status).toBe(200);
    expect(mockedFindMany).not.toHaveBeenCalled();
    await expect(
      fs.access(path.join(dir, "force-gggggggggggg.png")),
    ).rejects.toThrow();
  });

  it("renvoie 404 si l'image n'existe pas", async () => {
    mockedFindMany.mockResolvedValue([]);
    const res = await request("DELETE", "/images/ghost-hhhhhhhhhhhh.png");
    expect(res.status).toBe(404);
  });
});
