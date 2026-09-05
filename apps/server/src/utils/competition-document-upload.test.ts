/**
 * Tests des helpers d'upload des documents officiels de competition.
 *
 * Le coeur de la securite du module est ici : c'est la detection par magic
 * bytes (jamais le Content-Type client) et la generation/validation des noms de
 * fichiers qui empechent d'ecrire ou de supprimer hors du dossier d'upload.
 */

import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";

import {
  buildCompetitionDocumentUrl,
  COMPETITION_DOCUMENT_PUBLIC_PATH,
  detectDocumentType,
  downloadNameFor,
  generateDocumentFilename,
  getCompetitionDocumentUploadDir,
  MAX_COMPETITION_DOCUMENT_BYTES,
  resolveCompetitionDocumentPath,
} from "./competition-document-upload";

function withHeader(bytes: number[], length = 32): Buffer {
  const buf = Buffer.alloc(length);
  buf.set(bytes, 0);
  return buf;
}

const PDF = withHeader([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const PNG = withHeader([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = withHeader([0xff, 0xd8, 0xff, 0xe0]);
const GIF = withHeader([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

afterEach(() => {
  delete process.env.COMPETITION_DOCUMENT_UPLOAD_DIR;
  delete process.env.COMPETITION_DOCUMENT_ASSET_PUBLIC_BASE;
  delete process.env.BLOG_ASSET_PUBLIC_BASE;
});

describe("MAX_COMPETITION_DOCUMENT_BYTES", () => {
  it("plafonne un document a 10 Mo (regle produit)", () => {
    expect(MAX_COMPETITION_DOCUMENT_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe("detectDocumentType", () => {
  it("reconnait un PDF", () => {
    expect(detectDocumentType(PDF)).toEqual({
      ext: "pdf",
      mime: "application/pdf",
    });
  });

  it("reconnait les images acceptees", () => {
    expect(detectDocumentType(PNG)?.ext).toBe("png");
    expect(detectDocumentType(JPEG)?.ext).toBe("jpg");
    expect(detectDocumentType(GIF)?.ext).toBe("gif");
    const webp = Buffer.alloc(16);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(detectDocumentType(webp)?.ext).toBe("webp");
  });

  it("refuse un format non supporte meme si le nom ment", () => {
    // "PK\x03\x04" = archive ZIP (docx, xlsx...) : refusee.
    expect(detectDocumentType(withHeader([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
  });

  it("refuse un buffer trop court pour porter une signature", () => {
    expect(detectDocumentType(Buffer.from([0x25, 0x50]))).toBeNull();
  });
});

describe("generateDocumentFilename", () => {
  it("slugifie la suggestion et ajoute un suffixe aleatoire", () => {
    const name = generateDocumentFilename("Règlement Officiel.pdf", "pdf");
    expect(name).toMatch(/^reglement-officiel-[0-9a-f]{12}\.pdf$/);
  });

  it("neutralise toute tentative de path traversal", () => {
    const name = generateDocumentFilename("../../etc/passwd", "pdf");
    expect(name).not.toContain("/");
    expect(name).not.toContain("..");
    expect(name).toMatch(/^etc-passwd-[0-9a-f]{12}\.pdf$/);
  });

  it("retombe sur « document » sans suggestion", () => {
    expect(generateDocumentFilename(undefined, "pdf")).toMatch(
      /^document-[0-9a-f]{12}\.pdf$/,
    );
  });

  it("ne collisionne pas entre deux appels identiques", () => {
    const a = generateDocumentFilename("reglement", "pdf");
    const b = generateDocumentFilename("reglement", "pdf");
    expect(a).not.toBe(b);
  });
});

describe("resolveCompetitionDocumentPath", () => {
  it("resout un nom genere dans le dossier cible", () => {
    const resolved = resolveCompetitionDocumentPath(
      "/srv/docs",
      "a-b1c2d3.pdf",
    );
    expect(resolved).toBe(path.resolve("/srv/docs", "a-b1c2d3.pdf"));
  });

  it("refuse les noms hors format (null, pas d'exception)", () => {
    for (const bad of [
      "../secret.pdf",
      "sub/dir.pdf",
      "sub\\dir.pdf",
      ".hidden.pdf",
      "archive.zip",
      "no-extension",
      "",
    ]) {
      expect(resolveCompetitionDocumentPath("/srv/docs", bad)).toBeNull();
    }
  });
});

describe("getCompetitionDocumentUploadDir", () => {
  it("prend l'override d'environnement quand il est pose", () => {
    process.env.COMPETITION_DOCUMENT_UPLOAD_DIR = "/tmp/nuffle-docs";
    expect(getCompetitionDocumentUploadDir()).toBe(
      path.resolve("/tmp/nuffle-docs"),
    );
  });

  it("retombe sur le dossier public du web par defaut", () => {
    expect(getCompetitionDocumentUploadDir()).toContain(
      path.join("web", "public", "documents", "competitions"),
    );
  });
});

describe("buildCompetitionDocumentUrl", () => {
  it("rend une URL relative sans base configuree", () => {
    expect(buildCompetitionDocumentUrl("x-1.pdf")).toBe(
      `${COMPETITION_DOCUMENT_PUBLIC_PATH}/x-1.pdf`,
    );
  });

  it("prefixe avec la base dediee, sinon celle du blog", () => {
    process.env.BLOG_ASSET_PUBLIC_BASE = "https://api.example.test/";
    expect(buildCompetitionDocumentUrl("x-1.pdf")).toBe(
      "https://api.example.test/documents/competitions/x-1.pdf",
    );
    process.env.COMPETITION_DOCUMENT_ASSET_PUBLIC_BASE =
      "https://cdn.example.test";
    expect(buildCompetitionDocumentUrl("x-1.pdf")).toBe(
      "https://cdn.example.test/documents/competitions/x-1.pdf",
    );
  });
});

describe("downloadNameFor", () => {
  it("derive un nom lisible du titre et de l'extension reelle", () => {
    expect(downloadNameFor("Règlement 2027", "abc-123.pdf")).toBe(
      "reglement-2027.pdf",
    );
  });

  it("retombe sur « document » quand le titre ne donne rien", () => {
    expect(downloadNameFor("!!!", "abc-123.png")).toBe("document.png");
  });
});
