/**
 * Tests du service « documents officiels de competition ».
 *
 * Prisma est mocke (toutes les methodes utilisees sont declarees, sinon
 * `TypeError: Cannot read properties of undefined`), mais le DISQUE est reel :
 * on ecrit dans un dossier temporaire via `COMPETITION_DOCUMENT_UPLOAD_DIR`
 * pour verifier que le binaire est bien pose puis retire.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

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

import { prisma } from "../prisma";
import {
  CompetitionDocumentError,
  canManageCompetition,
  createCompetitionDocument,
  defaultTitleFromOriginalName,
  deleteCompetitionDocument,
  listAllCompetitionDocuments,
  listCompetitionDocuments,
  updateCompetitionDocument,
} from "./competition-documents";

const db = prisma as unknown as {
  league: { findUnique: ReturnType<typeof vi.fn> };
  cup: { findUnique: ReturnType<typeof vi.fn> };
  leagueParticipant: { count: ReturnType<typeof vi.fn> };
  cupParticipant: { count: ReturnType<typeof vi.fn> };
  competitionDocument: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const COMMISSIONER = { userId: "coach-1", isAdmin: false };
const OTHER_COACH = { userId: "coach-2", isAdmin: false };
const ADMIN = { userId: "admin-1", isAdmin: true };
const ANONYMOUS = { userId: null, isAdmin: false };

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
  dir = await fs.mkdtemp(path.join(tmpdir(), "competition-docs-"));
  process.env.COMPETITION_DOCUMENT_UPLOAD_DIR = dir;
  db.competitionDocument.aggregate.mockResolvedValue({
    _max: { sortOrder: null },
  });
});

afterEach(async () => {
  delete process.env.COMPETITION_DOCUMENT_UPLOAD_DIR;
  await fs.rm(dir, { recursive: true, force: true });
});

describe("canManageCompetition", () => {
  const competition = {
    kind: "league" as const,
    id: "league-1",
    name: "L",
    creatorId: "coach-1",
    isPublic: true,
  };

  it("autorise le commissaire (createur)", () => {
    expect(canManageCompetition(competition, COMMISSIONER)).toBe(true);
  });

  it("autorise l'admin", () => {
    expect(canManageCompetition(competition, ADMIN)).toBe(true);
  });

  it("refuse un autre coach et un visiteur anonyme", () => {
    expect(canManageCompetition(competition, OTHER_COACH)).toBe(false);
    expect(canManageCompetition(competition, ANONYMOUS)).toBe(false);
  });
});

describe("defaultTitleFromOriginalName", () => {
  it("retire l'extension", () => {
    expect(defaultTitleFromOriginalName("Reglement 2027.pdf")).toBe(
      "Reglement 2027",
    );
  });

  it("retombe sur un libelle par defaut", () => {
    expect(defaultTitleFromOriginalName(".pdf")).toBe("Document officiel");
  });
});

describe("createCompetitionDocument", () => {
  it("ecrit le binaire sur le disque et cree la ligne (commissaire)", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow());
    db.competitionDocument.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        docRow({ ...data, createdAt: new Date(), updatedAt: new Date() }),
    );

    const view = await createCompetitionDocument({
      kind: "league",
      competitionId: "league-1",
      actor: COMMISSIONER,
      body: PDF,
      originalName: "Règlement Officiel.pdf",
    });

    expect(view.mimeType).toBe("application/pdf");
    expect(view.title).toBe("Règlement Officiel");
    expect(view.competitionKind).toBe("league");
    // Le fichier existe reellement, sous le nom genere cote serveur.
    const written = await fs.readFile(path.join(dir, view.filename));
    expect(written.equals(PDF)).toBe(true);
    // FK polymorphe : seule `leagueId` est posee, jamais les deux.
    const created = db.competitionDocument.create.mock.calls[0][0].data;
    expect(created.leagueId).toBe("league-1");
    expect(created).not.toHaveProperty("cupId");
  });

  it("place le nouveau document en fin de liste (max + 1)", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow());
    db.competitionDocument.aggregate.mockResolvedValue({
      _max: { sortOrder: 4 },
    });
    db.competitionDocument.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => docRow(data),
    );

    const view = await createCompetitionDocument({
      kind: "league",
      competitionId: "league-1",
      actor: COMMISSIONER,
      body: PDF,
    });
    expect(view.sortOrder).toBe(5);
  });

  it("accepte l'upload sur une coupe via la FK cupId", async () => {
    db.cup.findUnique.mockResolvedValue({
      id: "cup-1",
      name: "Nuffle Cup",
      creatorId: "coach-1",
      isPublic: true,
    });
    db.competitionDocument.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        docRow({
          ...data,
          leagueId: null,
          league: null,
          cup: { id: "cup-1", name: "Nuffle Cup" },
        }),
    );

    const view = await createCompetitionDocument({
      kind: "cup",
      competitionId: "cup-1",
      actor: COMMISSIONER,
      body: PDF,
    });
    expect(view.competitionKind).toBe("cup");
    expect(view.competitionId).toBe("cup-1");
  });

  it("refuse un coach qui n'est pas commissaire", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow());
    await expect(
      createCompetitionDocument({
        kind: "league",
        competitionId: "league-1",
        actor: OTHER_COACH,
        body: PDF,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(db.competitionDocument.create).not.toHaveBeenCalled();
    expect(await fs.readdir(dir)).toEqual([]);
  });

  it("autorise l'admin sur une competition qu'il n'a pas creee", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow({ creatorId: "someone" }));
    db.competitionDocument.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => docRow(data),
    );
    await expect(
      createCompetitionDocument({
        kind: "league",
        competitionId: "league-1",
        actor: ADMIN,
        body: PDF,
      }),
    ).resolves.toBeTruthy();
  });

  it("404 si la competition n'existe pas", async () => {
    db.league.findUnique.mockResolvedValue(null);
    await expect(
      createCompetitionDocument({
        kind: "league",
        competitionId: "nope",
        actor: ADMIN,
        body: PDF,
      }),
    ).rejects.toMatchObject({ code: "competition-not-found" });
  });

  it("refuse un corps vide", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow());
    await expect(
      createCompetitionDocument({
        kind: "league",
        competitionId: "league-1",
        actor: COMMISSIONER,
        body: Buffer.alloc(0),
      }),
    ).rejects.toMatchObject({ code: "empty" });
  });

  it("refuse un format non supporte (magic bytes, pas l'extension)", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow());
    const zip = Buffer.alloc(32);
    zip.set([0x50, 0x4b, 0x03, 0x04], 0);
    await expect(
      createCompetitionDocument({
        kind: "league",
        competitionId: "league-1",
        actor: COMMISSIONER,
        body: zip,
        originalName: "piege.pdf",
      }),
    ).rejects.toMatchObject({ code: "unsupported-type" });
    expect(await fs.readdir(dir)).toEqual([]);
  });

  it("refuse un document au-dela de 10 Mo", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow());
    const big = Buffer.alloc(10 * 1024 * 1024 + 1);
    big.set([0x25, 0x50, 0x44, 0x46, 0x2d], 0);
    await expect(
      createCompetitionDocument({
        kind: "league",
        competitionId: "league-1",
        actor: COMMISSIONER,
        body: big,
      }),
    ).rejects.toMatchObject({ code: "too-large" });
  });

  it("ne laisse pas de binaire orphelin si l'insert echoue", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow());
    db.competitionDocument.create.mockRejectedValue(new Error("db down"));
    await expect(
      createCompetitionDocument({
        kind: "league",
        competitionId: "league-1",
        actor: COMMISSIONER,
        body: PDF,
      }),
    ).rejects.toThrow("db down");
    expect(await fs.readdir(dir)).toEqual([]);
  });
});

describe("listCompetitionDocuments", () => {
  it("sert les documents d'une competition publique a un visiteur anonyme", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow());
    db.competitionDocument.findMany.mockResolvedValue([docRow()]);
    const docs = await listCompetitionDocuments({
      kind: "league",
      competitionId: "league-1",
      actor: ANONYMOUS,
    });
    expect(docs).toHaveLength(1);
    expect(docs[0].url).toBe(
      "/documents/competitions/reglement-aabbccddeeff.pdf",
    );
    expect(db.competitionDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
    );
  });

  it("refuse un anonyme sur une competition privee", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow({ isPublic: false }));
    await expect(
      listCompetitionDocuments({
        kind: "league",
        competitionId: "league-1",
        actor: ANONYMOUS,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("autorise un coach inscrit sur une competition privee", async () => {
    db.league.findUnique.mockResolvedValue(leagueRow({ isPublic: false }));
    db.leagueParticipant.count.mockResolvedValue(1);
    db.competitionDocument.findMany.mockResolvedValue([]);
    await expect(
      listCompetitionDocuments({
        kind: "league",
        competitionId: "league-1",
        actor: OTHER_COACH,
      }),
    ).resolves.toEqual([]);
  });

  it("refuse un coach non inscrit sur une coupe privee", async () => {
    db.cup.findUnique.mockResolvedValue({
      id: "cup-1",
      name: "C",
      creatorId: "coach-1",
      isPublic: false,
    });
    db.cupParticipant.count.mockResolvedValue(0);
    await expect(
      listCompetitionDocuments({
        kind: "cup",
        competitionId: "cup-1",
        actor: OTHER_COACH,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("404 quand la competition n'existe pas", async () => {
    db.cup.findUnique.mockResolvedValue(null);
    await expect(
      listCompetitionDocuments({
        kind: "cup",
        competitionId: "nope",
        actor: ADMIN,
      }),
    ).rejects.toBeInstanceOf(CompetitionDocumentError);
  });
});

describe("updateCompetitionDocument", () => {
  it("met a jour titre, description et ordre", async () => {
    db.competitionDocument.findUnique.mockResolvedValue(docRow());
    db.league.findUnique.mockResolvedValue(leagueRow());
    db.competitionDocument.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        docRow({ ...data }),
    );
    const view = await updateCompetitionDocument({
      documentId: "doc-1",
      actor: COMMISSIONER,
      title: "  Reglement v2  ",
      description: "  version corrigee  ",
      sortOrder: 3,
    });
    expect(view.title).toBe("Reglement v2");
    expect(view.description).toBe("version corrigee");
    expect(view.sortOrder).toBe(3);
  });

  it("efface la description avec une chaine vide", async () => {
    db.competitionDocument.findUnique.mockResolvedValue(
      docRow({ description: "ancienne" }),
    );
    db.league.findUnique.mockResolvedValue(leagueRow());
    db.competitionDocument.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        docRow({ description: null, ...data }),
    );
    const view = await updateCompetitionDocument({
      documentId: "doc-1",
      actor: COMMISSIONER,
      description: "",
    });
    expect(view.description).toBeNull();
  });

  it("refuse un coach tiers", async () => {
    db.competitionDocument.findUnique.mockResolvedValue(docRow());
    db.league.findUnique.mockResolvedValue(leagueRow());
    await expect(
      updateCompetitionDocument({
        documentId: "doc-1",
        actor: OTHER_COACH,
        title: "pirate",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(db.competitionDocument.update).not.toHaveBeenCalled();
  });

  it("404 sur un document inexistant", async () => {
    db.competitionDocument.findUnique.mockResolvedValue(null);
    await expect(
      updateCompetitionDocument({
        documentId: "nope",
        actor: ADMIN,
        title: "x",
      }),
    ).rejects.toMatchObject({ code: "document-not-found" });
  });
});

describe("deleteCompetitionDocument", () => {
  it("supprime la ligne puis le binaire", async () => {
    const filename = "reglement-aabbccddeeff.pdf";
    await fs.writeFile(path.join(dir, filename), PDF);
    db.competitionDocument.findUnique.mockResolvedValue(docRow({ filename }));
    db.league.findUnique.mockResolvedValue(leagueRow());
    db.competitionDocument.delete.mockResolvedValue(docRow({ filename }));

    await deleteCompetitionDocument({
      documentId: "doc-1",
      actor: COMMISSIONER,
    });

    expect(db.competitionDocument.delete).toHaveBeenCalledWith({
      where: { id: "doc-1" },
    });
    expect(await fs.readdir(dir)).toEqual([]);
  });

  it("ne leve pas si le binaire a deja disparu du disque", async () => {
    db.competitionDocument.findUnique.mockResolvedValue(docRow());
    db.league.findUnique.mockResolvedValue(leagueRow());
    db.competitionDocument.delete.mockResolvedValue(docRow());
    await expect(
      deleteCompetitionDocument({ documentId: "doc-1", actor: ADMIN }),
    ).resolves.toMatchObject({ id: "doc-1" });
  });

  it("refuse un coach tiers et ne touche ni la base ni le disque", async () => {
    const filename = "reglement-aabbccddeeff.pdf";
    await fs.writeFile(path.join(dir, filename), PDF);
    db.competitionDocument.findUnique.mockResolvedValue(docRow({ filename }));
    db.league.findUnique.mockResolvedValue(leagueRow());
    await expect(
      deleteCompetitionDocument({ documentId: "doc-1", actor: OTHER_COACH }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(db.competitionDocument.delete).not.toHaveBeenCalled();
    expect(await fs.readdir(dir)).toEqual([filename]);
  });
});

describe("listAllCompetitionDocuments (admin)", () => {
  it("pagine et remonte le total", async () => {
    db.competitionDocument.count.mockResolvedValue(42);
    db.competitionDocument.findMany.mockResolvedValue([docRow()]);
    const result = await listAllCompetitionDocuments({ page: 2, limit: 10 });
    expect(result.total).toBe(42);
    expect(result.page).toBe(2);
    expect(db.competitionDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it("filtre par famille de competition", async () => {
    db.competitionDocument.count.mockResolvedValue(0);
    db.competitionDocument.findMany.mockResolvedValue([]);
    await listAllCompetitionDocuments({ kind: "cup" });
    expect(db.competitionDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cupId: { not: null } } }),
    );
  });

  it("combine filtre de competition et recherche sans s'ecraser", async () => {
    db.competitionDocument.count.mockResolvedValue(0);
    db.competitionDocument.findMany.mockResolvedValue([]);
    await listAllCompetitionDocuments({
      competitionId: "league-1",
      search: "regle",
    });
    const where = db.competitionDocument.findMany.mock.calls[0][0].where;
    expect(where.OR).toBeUndefined();
    expect(where.AND).toHaveLength(2);
  });

  it("borne `limit` a 100", async () => {
    db.competitionDocument.count.mockResolvedValue(0);
    db.competitionDocument.findMany.mockResolvedValue([]);
    const result = await listAllCompetitionDocuments({ limit: 5000 });
    expect(result.limit).toBe(100);
  });
});

describe("listAllCompetitionDocuments — recherche selon le provider", () => {
  it("active `mode: insensitive` hors miroir sqlite (PostgreSQL)", async () => {
    const previous = process.env.TEST_SQLITE;
    delete process.env.TEST_SQLITE;
    try {
      db.competitionDocument.count.mockResolvedValue(0);
      db.competitionDocument.findMany.mockResolvedValue([]);
      await listAllCompetitionDocuments({ search: "Règlement" });
      const where = db.competitionDocument.findMany.mock.calls[0][0].where;
      expect(where.OR[0].title).toEqual({
        contains: "Règlement",
        mode: "insensitive",
      });
    } finally {
      if (previous !== undefined) process.env.TEST_SQLITE = previous;
    }
  });

  it("omet `mode` sur le miroir sqlite (le connecteur le refuse)", async () => {
    const previous = process.env.TEST_SQLITE;
    process.env.TEST_SQLITE = "1";
    try {
      db.competitionDocument.count.mockResolvedValue(0);
      db.competitionDocument.findMany.mockResolvedValue([]);
      await listAllCompetitionDocuments({ search: "regle" });
      const where = db.competitionDocument.findMany.mock.calls[0][0].where;
      expect(where.OR[0].title).toEqual({ contains: "regle" });
    } finally {
      if (previous === undefined) delete process.env.TEST_SQLITE;
      else process.env.TEST_SQLITE = previous;
    }
  });
});
