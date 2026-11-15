import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildCompetitionBlogImageUrl,
  COMPETITION_BLOG_FILENAME,
  competitionBlogFolder,
  competitionBlogImagePrefixes,
  createUploadQuota,
  saveCompetitionBlogImage,
} from "./competition-blog-upload";

const PNG = (() => {
  const b = Buffer.alloc(32);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return b;
})();
const ZIP = Buffer.from("PK\u0003\u0004 not an image at all....");

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "cblog-"));
  process.env.COMPETITION_BLOG_UPLOAD_DIR = dir;
  delete process.env.COMPETITION_BLOG_ASSET_PUBLIC_BASE;
  delete process.env.BLOG_ASSET_PUBLIC_BASE;
});
afterEach(async () => {
  delete process.env.COMPETITION_BLOG_UPLOAD_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("dossier d'une compétition", () => {
  it("préfixe par famille et id", () => {
    expect(competitionBlogFolder("cup", "abc123")).toBe("cup-abc123");
  });
  it("refuse un id qui pourrait sortir du dossier", () => {
    expect(() => competitionBlogFolder("league", "../x")).toThrow();
    expect(() => competitionBlogFolder("league", "a/b")).toThrow();
  });
  it("préfixes : relatif, plus absolu quand l'hôte d'assets est configuré", () => {
    expect(competitionBlogImagePrefixes("league", "l1")).toEqual([
      "/images/competition-blog/league-l1/",
    ]);
    process.env.BLOG_ASSET_PUBLIC_BASE = "https://api.test/";
    expect(competitionBlogImagePrefixes("league", "l1")).toEqual([
      "/images/competition-blog/league-l1/",
      "https://api.test/images/competition-blog/league-l1/",
    ]);
    expect(buildCompetitionBlogImageUrl("league", "l1", "f.png")).toBe(
      "https://api.test/images/competition-blog/league-l1/f.png",
    );
  });
});

describe("saveCompetitionBlogImage", () => {
  it("écrit sous un nom généré, dans le dossier de la compétition", async () => {
    const saved = await saveCompetitionBlogImage("league", "l1", PNG);
    expect(saved.mimeType).toBe("image/png");
    expect(saved.filename).toMatch(COMPETITION_BLOG_FILENAME);
    expect(saved.url).toBe(`/images/competition-blog/league-l1/${saved.filename}`);
    expect(await readdir(path.join(dir, "league-l1"))).toEqual([saved.filename]);
  });

  it("refuse un fichier déguisé (octets magiques)", async () => {
    await expect(saveCompetitionBlogImage("cup", "c1", ZIP)).rejects.toMatchObject({
      code: "unsupported_type",
    });
  });

  it("refuse un fichier vide", async () => {
    await expect(saveCompetitionBlogImage("cup", "c1", Buffer.alloc(0))).rejects.toMatchObject({
      code: "empty",
    });
  });
});

describe("createUploadQuota", () => {
  it("bloque au-delà du quota puis libère après la fenêtre", () => {
    const q = createUploadQuota(2, 1000);
    expect(q.take("u", 0)).toBe(true);
    expect(q.take("u", 10)).toBe(true);
    expect(q.take("u", 20)).toBe(false);
    expect(q.take("other", 20)).toBe(true);
    expect(q.take("u", 1001)).toBe(true);
  });
});
