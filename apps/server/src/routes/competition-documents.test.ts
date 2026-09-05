/**
 * Tests des routes « documents officiels » cote commissaire
 * (`/api/competitions/:kind/:competitionId/documents`).
 *
 * On exerce la VRAIE chaine Express (raw parser, validation Zod, mapping des
 * erreurs typees en statuts HTTP) contre un service dont seul Prisma est
 * mocke ; le disque est un dossier temporaire. Le point le plus sensible est
 * l'upload : corps binaire brut (pas de multipart), plafonne a 10 Mo par le
 * parser lui-meme.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import http from "node:http";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let currentUser: { id: string; roles: string[] } | null = {
  id: "coach-1",
  roles: ["user"],
};

vi.mock("../prisma", () => ({
  prisma: {
    league: { findUnique: vi.fn() },
    cup: { findUnique: vi.fn() },
    leagueParticipant: { count: vi.fn() },
    cupParticipant: { count: vi.fn() },
    competitionDocument: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));
vi.mock("../middleware/authUser", () => ({
  authUser: (req: any, res: any, next: any) => {
    if (!currentUser) return res.status(401).json({ error: "Non authentifié" });
    req.user = currentUser;
    return next();
  },
  optionalAuthUser: (req: any, _res: any, next: any) => {
    if (currentUser) req.user = currentUser;
    return next();
  },
}));
vi.mock("../services/audit-log", () => ({
  safeRecordAdminActionFromRequest: vi.fn(async () => {}),
}));

import router from "./competition-documents";
import { prisma } from "../prisma";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";

const db = prisma as unknown as Record<string, any>;

const PDF = (() => {
  const buf = Buffer.alloc(64);
  buf.set([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37], 0);
  return buf;
})();

function leagueRow(over: Record<string, unknown> = {}) {
  return {
    id: "league-1",
    name: "Ligue du Chaos",
    creatorId: "coach-1",
    isPublic: true,
    ...over,
  };
}

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
  currentUser = { id: "coach-1", roles: ["user"] };
  dir = await fs.mkdtemp(path.join(tmpdir(), "competition-docs-routes-"));
  process.env.COMPETITION_DOCUMENT_UPLOAD_DIR = dir;
  db.competitionDocument.aggregate.mockResolvedValue({
    _max: { sortOrder: null },
  });
});

afterEach(async () => {
  delete process.env.COMPETITION_DOCUMENT_UPLOAD_DIR;
  await fs.rm(dir, { recursive: true, force: true });
});

interface RequestOptions {
  readonly json?: Record<string, unknown>;
  readonly binary?: Buffer;
  readonly contentType?: string;
}

async function request(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  routePath: string,
  options: RequestOptions = {},
): Promise<{ status: number; body: any }> {
  const app = express();
  // Miroir du montage reel : le parser JSON global precede le routeur.
  app.use(express.json());
  app.use("/api/competitions", router);
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("listen failed"));
        return;
      }
      const payload = options.binary
        ? options.binary
        : Buffer.from(options.json ? JSON.stringify(options.json) : "");
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: `/api/competitions${routePath}`,
          method,
          headers: {
            "Content-Type":
              options.contentType ??
              (options.binary ? "application/pdf" : "application/json"),
            "Content-Length": payload.length.toString(),
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
      if (payload.length) req.write(payload);
      req.end();
    });
  });
}

describe("GET /:kind/:competitionId/documents", () => {
  it("liste les documents d'une ligue publique", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow());
    db.competitionDocument.findMany.mockResolvedValue([docRow()]);
    const res = await request("GET", "/leagues/league-1/documents");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.documents).toHaveLength(1);
    expect(res.body.data.documents[0]).toMatchObject({
      title: "Reglement",
      mimeType: "application/pdf",
      url: "/documents/competitions/reglement-aabbccddeeff.pdf",
    });
  });

  it("sert aussi les visiteurs non connectes", async () => {
    currentUser = null;
    db.league.findUnique.mockResolvedValue(leagueRow());
    db.competitionDocument.findMany.mockResolvedValue([]);
    const res = await request("GET", "/leagues/league-1/documents");
    expect(res.status).toBe(200);
  });

  it("404 sur une competition inconnue", async () => {
    db.cup.findUnique.mockResolvedValue(null);
    const res = await request("GET", "/cups/nope/documents");
    expect(res.status).toBe(404);
  });

  it("400 sur une famille de competition inconnue", async () => {
    const res = await request("GET", "/tournois/league-1/documents");
    expect(res.status).toBe(400);
  });
});

describe("POST /:kind/:competitionId/documents", () => {
  it("accepte un PDF depose par le commissaire", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow());
    db.competitionDocument.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => docRow(data),
    );
    const res = await request("POST", "/leagues/league-1/documents", {
      binary: PDF,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.document.mimeType).toBe("application/pdf");
    expect(safeRecordAdminActionFromRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "competition-document.upload" }),
    );
  });

  it("reprend le titre et la description passes en query", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow());
    db.competitionDocument.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => docRow(data),
    );
    const res = await request(
      "POST",
      "/leagues/league-1/documents?filename=reglement.pdf&title=R%C3%A8glement&description=Version%202027",
      { binary: PDF },
    );
    expect(res.status).toBe(201);
    expect(res.body.data.document).toMatchObject({
      title: "Règlement",
      description: "Version 2027",
    });
  });

  it("403 pour un coach qui n'est pas commissaire", async () => {
    currentUser = { id: "coach-2", roles: ["user"] };
    db.league.findUnique.mockResolvedValue(leagueRow());
    const res = await request("POST", "/leagues/league-1/documents", {
      binary: PDF,
    });
    expect(res.status).toBe(403);
    expect(db.competitionDocument.create).not.toHaveBeenCalled();
  });

  it("200/201 pour un admin sur la ligue d'un autre", async () => {
    currentUser = { id: "admin-1", roles: ["admin"] };
    db.league.findUnique.mockResolvedValue(leagueRow({ creatorId: "other" }));
    db.competitionDocument.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => docRow(data),
    );
    const res = await request("POST", "/leagues/league-1/documents", {
      binary: PDF,
    });
    expect(res.status).toBe(201);
  });

  it("401 sans authentification", async () => {
    currentUser = null;
    const res = await request("POST", "/leagues/league-1/documents", {
      binary: PDF,
    });
    expect(res.status).toBe(401);
  });

  it("415 sur un format non supporte", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow());
    const zip = Buffer.alloc(32);
    zip.set([0x50, 0x4b, 0x03, 0x04], 0);
    const res = await request("POST", "/leagues/league-1/documents", {
      binary: zip,
    });
    expect(res.status).toBe(415);
  });

  it("400 sur un corps vide", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow());
    const res = await request("POST", "/leagues/league-1/documents", {
      binary: Buffer.alloc(0),
    });
    expect(res.status).toBe(400);
  });

  it("413 au-dela de 10 Mo (refus par le parser, sans lecture complete)", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow());
    const big = Buffer.alloc(10 * 1024 * 1024 + 512);
    big.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0);
    const res = await request("POST", "/leagues/league-1/documents", {
      binary: big,
    });
    expect(res.status).toBe(413);
    expect(db.competitionDocument.create).not.toHaveBeenCalled();
  });

  it("400 sur un parametre de query inconnu", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow());
    const res = await request("POST", "/leagues/league-1/documents?evil=1", {
      binary: PDF,
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /:kind/:competitionId/documents/:documentId", () => {
  it("met a jour le titre", async () => {
    db.competitionDocument.findUnique.mockResolvedValue(docRow());
    db.league.findUnique.mockResolvedValue(leagueRow());
    db.competitionDocument.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => docRow(data),
    );
    const res = await request("PATCH", "/leagues/league-1/documents/doc-1", {
      json: { title: "Reglement v2" },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.document.title).toBe("Reglement v2");
  });

  it("400 quand le corps ne porte aucun champ", async () => {
    const res = await request("PATCH", "/leagues/league-1/documents/doc-1", {
      json: {},
    });
    expect(res.status).toBe(400);
  });

  it("403 pour un coach tiers", async () => {
    currentUser = { id: "coach-2", roles: ["user"] };
    db.competitionDocument.findUnique.mockResolvedValue(docRow());
    db.league.findUnique.mockResolvedValue(leagueRow());
    const res = await request("PATCH", "/leagues/league-1/documents/doc-1", {
      json: { title: "pirate" },
    });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /:kind/:competitionId/documents/:documentId", () => {
  it("supprime le document et son binaire", async () => {
    const filename = "reglement-aabbccddeeff.pdf";
    await fs.writeFile(path.join(dir, filename), PDF);
    db.competitionDocument.findUnique.mockResolvedValue(docRow({ filename }));
    db.league.findUnique.mockResolvedValue(leagueRow());
    db.competitionDocument.delete.mockResolvedValue(docRow({ filename }));
    const res = await request("DELETE", "/leagues/league-1/documents/doc-1");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ deleted: true, id: "doc-1" });
    expect(await fs.readdir(dir)).toEqual([]);
  });

  it("404 sur un document inconnu", async () => {
    db.competitionDocument.findUnique.mockResolvedValue(null);
    const res = await request("DELETE", "/leagues/league-1/documents/nope");
    expect(res.status).toBe(404);
  });
});
