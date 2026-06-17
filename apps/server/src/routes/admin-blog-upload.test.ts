/**
 * Tests d'intégration de `POST /api/admin/blog/upload`.
 * Couvre : upload PNG valide (201 + url + écriture disque mockée), rejet d'un
 * corps vide (400), rejet d'un contenu non-image (415, détection magic bytes).
 *
 * `node:fs/promises` est mocké : aucun fichier n'est réellement écrit.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: { blogPost: {} },
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

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
}));

import express from "express";
import http from "http";
import { mkdir, writeFile } from "node:fs/promises";
import blogRouter from "./admin-blog";

const mockedWriteFile = vi.mocked(writeFile);
const mockedMkdir = vi.mocked(mkdir);

async function upload(
  body: Buffer,
  contentType = "application/octet-stream",
  query = "",
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
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: `/api/admin/blog/upload${query}`,
          method: "POST",
          headers: {
            "Content-Type": contentType,
            "Content-Length": body.length.toString(),
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
      if (body.length) req.write(body);
      req.end();
    });
  });
}

// PNG : signature 8 octets + padding pour atteindre la longueur min (12).
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/blog/upload", () => {
  it("accepte un PNG, écrit le fichier et renvoie une URL /images/blog/*.png", async () => {
    const res = await upload(PNG_BYTES, "image/png", "?filename=Mon%20Article!");
    expect(res.status).toBe(201);
    expect(res.body.mime).toBe("image/png");
    expect(res.body.bytes).toBe(PNG_BYTES.length);
    expect(res.body.filename).toMatch(/^mon-article-[0-9a-f]{12}\.png$/);
    expect(res.body.url).toMatch(/^\/images\/blog\/mon-article-[0-9a-f]{12}\.png$/);
    expect(mockedMkdir).toHaveBeenCalledTimes(1);
    expect(mockedWriteFile).toHaveBeenCalledTimes(1);
    // Le buffer écrit est bien celui reçu.
    const written = mockedWriteFile.mock.calls[0]?.[1];
    expect(Buffer.isBuffer(written)).toBe(true);
    expect((written as Buffer).equals(PNG_BYTES)).toBe(true);
  });

  it("rejette un corps vide (400) sans rien écrire", async () => {
    const res = await upload(Buffer.alloc(0), "image/png");
    expect(res.status).toBe(400);
    expect(mockedWriteFile).not.toHaveBeenCalled();
  });

  it("rejette un contenu non-image (415) même si le Content-Type ment", async () => {
    const notAnImage = Buffer.from("ceci n'est pas une image du tout");
    const res = await upload(notAnImage, "image/png");
    expect(res.status).toBe(415);
    expect(mockedWriteFile).not.toHaveBeenCalled();
  });
});
