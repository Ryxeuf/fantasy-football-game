/**
 * Tests des helpers d'upload d'images blog : détection par magic bytes,
 * normalisation de nom (anti path traversal), génération de nom unique,
 * construction d'URL publique.
 */

import { describe, it, expect } from "vitest";
import {
  detectImageType,
  safeNameBase,
  generateImageFilename,
  buildPublicUrl,
} from "./blog-upload";

function withSig(sig: number[]): Buffer {
  // Complète jusqu'à 12 octets (longueur minimale exigée).
  const buf = Buffer.alloc(12);
  sig.forEach((b, i) => (buf[i] = b));
  return buf;
}

describe("detectImageType", () => {
  it("détecte le PNG", () => {
    expect(detectImageType(withSig([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe("png");
  });
  it("détecte le JPEG", () => {
    expect(detectImageType(withSig([0xff, 0xd8, 0xff]))?.ext).toBe("jpg");
  });
  it("détecte le GIF", () => {
    expect(detectImageType(withSig([0x47, 0x49, 0x46, 0x38]))?.ext).toBe("gif");
  });
  it("détecte le WEBP", () => {
    const buf = withSig([0x52, 0x49, 0x46, 0x46]);
    buf[8] = 0x57;
    buf[9] = 0x45;
    buf[10] = 0x42;
    buf[11] = 0x50;
    expect(detectImageType(buf)?.ext).toBe("webp");
  });
  it("rejette un contenu non-image", () => {
    expect(detectImageType(Buffer.from("not an image!"))).toBeNull();
  });
  it("rejette un buffer trop court", () => {
    expect(detectImageType(Buffer.from([0x89, 0x50]))).toBeNull();
  });
});

describe("safeNameBase", () => {
  it("slugifie et retire l'extension", () => {
    expect(safeNameBase("Mon Super Article.png")).toBe("mon-super-article");
  });
  it("neutralise toute tentative de path traversal", () => {
    expect(safeNameBase("../../etc/passwd")).toBe("etc-passwd");
    expect(safeNameBase("/abs/olu/te")).toBe("abs-olu-te");
  });
  it("retombe sur 'image' si vide", () => {
    expect(safeNameBase("")).toBe("image");
    expect(safeNameBase(undefined)).toBe("image");
    expect(safeNameBase("???")).toBe("image");
  });
});

describe("generateImageFilename", () => {
  it("produit <base>-<rand>.<ext> et est unique", () => {
    const a = generateImageFilename("photo", "jpg");
    const b = generateImageFilename("photo", "jpg");
    expect(a).toMatch(/^photo-[0-9a-f]{12}\.jpg$/);
    expect(a).not.toBe(b);
  });
});

describe("buildPublicUrl", () => {
  it("renvoie un chemin relatif quand aucune base n'est configurée", () => {
    // BLOG_ASSET_PUBLIC_BASE non défini dans l'env de test.
    expect(buildPublicUrl("x.png")).toBe("/images/blog/x.png");
  });
});
