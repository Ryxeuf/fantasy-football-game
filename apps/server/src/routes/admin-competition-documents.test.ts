/**
 * Tests de la console d'administration des documents officiels
 * (`/admin/competition-documents`). L'auth et le role admin sont mockes
 * (verifies ailleurs) ; on valide ici le listing filtre/pagine, la correction
 * de metadonnees et la purge — les trois actions qui rendent un document
 * publie moderable.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import http from "node:http";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

vi.mock("../prisma", () => ({
  prisma: {
    league: { findUnique: vi.fn() },
    cup: { findUnique: vi.fn() },
    competitionDocument: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
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

import router from "./admin-competition-documents";
import { prisma } from "../prisma";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";

const db = prisma as unknown as Record<string, any>;

function docRow(over: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    leagueId: "league-1",
    cupId: null,
    title: "Reglement",
    description: null,
    filename: "reglement-aabbccddeeff.pdf",
    originalName: "reglement.pdf",
    mimeType: "application/pdf",
    bytes: 64,
    sortOrder: 0,
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    updatedAt: new Date("2026-09-01T10:00:00.000Z"),
    uploader: { id: "coach-1", coachName: "Grim" },
    league: { id: "league-1", name: "Ligue du Chaos" },
    cup: null,
    ...over,
  };
}

let dir: string;

beforeEach(async () => {
  vi.resetAllMocks();
  dir = await fs.mkdtemp(path.join(tmpdir(), "admin-competition-docs-"));
  process.env.COMPETITION_DOCUMENT_UPLOAD_DIR = dir;
});

afterEach(async () => {
  delete process.env.COMPETITION_DOCUMENT_UPLOAD_DIR;
  await fs.rm(dir, { recursive: true, force: true });
});

async function request(
  method: "GET" | "PATCH" | "DELETE",
  routePath: string,
  body: Record<string, unknown> | null = null,
): Promise<{ status: number; body: any }> {
  const app = express();
  app.use(express.json());
  app.use("/admin/competition-documents", router);
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
          path: `/admin/competition-documents${routePath}`,
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

describe("GET /admin/competition-documents", () => {
  it("liste les documents de toutes les competitions avec leur meta", async () => {
    db.competitionDocument.count.mockResolvedValue(1);
    db.competitionDocument.findMany.mockResolvedValue([docRow()]);
    const res = await request("GET", "");
    expect(res.status).toBe(200);
    expect(res.body.data.documents[0]).toMatchObject({
      competitionKind: "league",
      competitionName: "Ligue du Chaos",
      uploadedBy: { id: "coach-1", coachName: "Grim" },
    });
    expect(res.body.meta).toMatchObject({ total: 1, page: 1, limit: 25 });
  });

  it("transmet les filtres au service", async () => {
    db.competitionDocument.count.mockResolvedValue(0);
    db.competitionDocument.findMany.mockResolvedValue([]);
    const res = await request("GET", "?kind=cup&search=regle&page=2&limit=5");
    expect(res.status).toBe(200);
    expect(db.competitionDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });

  it("400 sur une famille inconnue", async () => {
    const res = await request("GET", "?kind=tournoi");
    expect(res.status).toBe(400);
  });
});

describe("PATCH /admin/competition-documents/:documentId", () => {
  it("corrige le libelle d'un document", async () => {
    db.competitionDocument.findUnique.mockResolvedValue(docRow());
    db.league.findUnique.mockResolvedValue({
      id: "league-1",
      name: "Ligue du Chaos",
      creatorId: "coach-1",
      isPublic: true,
    });
    db.competitionDocument.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => docRow(data),
    );
    const res = await request("PATCH", "/doc-1", { title: "Reglement 2027" });
    expect(res.status).toBe(200);
    expect(res.body.data.document.title).toBe("Reglement 2027");
    expect(safeRecordAdminActionFromRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "competition-document.admin-update" }),
    );
  });

  it("404 sur un document inconnu", async () => {
    db.competitionDocument.findUnique.mockResolvedValue(null);
    const res = await request("PATCH", "/nope", { title: "x" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /admin/competition-documents/:documentId", () => {
  it("purge la ligne et le binaire", async () => {
    const filename = "reglement-aabbccddeeff.pdf";
    await fs.writeFile(path.join(dir, filename), Buffer.from("%PDF-1.7"));
    db.competitionDocument.findUnique.mockResolvedValue(docRow({ filename }));
    db.league.findUnique.mockResolvedValue({
      id: "league-1",
      name: "Ligue du Chaos",
      creatorId: "coach-1",
      isPublic: true,
    });
    db.competitionDocument.delete.mockResolvedValue(docRow({ filename }));
    const res = await request("DELETE", "/doc-1");
    expect(res.status).toBe(200);
    expect(await fs.readdir(dir)).toEqual([]);
    expect(safeRecordAdminActionFromRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "competition-document.admin-delete" }),
    );
  });

  it("404 quand la competition rattachee a disparu", async () => {
    db.competitionDocument.findUnique.mockResolvedValue(docRow());
    db.league.findUnique.mockResolvedValue(null);
    const res = await request("DELETE", "/doc-1");
    expect(res.status).toBe(404);
  });
});
