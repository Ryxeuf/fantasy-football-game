/**
 * Tests du repository disque des images blog, contre un vrai dossier temporaire
 * (pattern `admin-sim-replays.test.ts`) : listing/filtre/tri/pagination,
 * sécurité anti-traversal, round-trip du texte alternatif, backfill des
 * dimensions, suppression (image + sidecar), orphelin ignoré, anti-clobber.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  listBlogImages,
  resolveBlogImagePath,
  getBlogImage,
  setBlogImageAlt,
  recordUploadedImage,
  deleteBlogImage,
  BlogImageStoreError,
} from "./blog-image-store";

function makePng(w: number, h: number): Buffer {
  const buf = Buffer.alloc(24);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  buf.set([0x49, 0x48, 0x44, 0x52], 12);
  buf.writeUInt32BE(w, 16);
  buf.writeUInt32BE(h, 20);
  return buf;
}

async function writePng(
  dir: string,
  name: string,
  w = 1,
  h = 1,
): Promise<void> {
  await fs.writeFile(path.join(dir, name), makePng(w, h));
}

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(tmpdir(), "blog-img-store-"));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("listBlogImages", () => {
  it("renvoie une liste vide si le dossier n'existe pas", async () => {
    expect(await listBlogImages(path.join(dir, "absent"))).toEqual({
      images: [],
      total: 0,
    });
  });

  it("ne liste que les vrais fichiers image (exclut txt, dotfiles, sidecars)", async () => {
    await writePng(dir, "a-111111111111.png");
    await writePng(dir, "b-222222222222.png");
    await fs.writeFile(path.join(dir, ".gitkeep"), "");
    await fs.writeFile(path.join(dir, "notes.txt"), "hello");
    await fs.writeFile(
      path.join(dir, ".a-111111111111.png.json"),
      JSON.stringify({ alt: "x" }),
    );
    const res = await listBlogImages(dir);
    expect(res.total).toBe(2);
    expect(res.images.map((i) => i.filename).sort()).toEqual([
      "a-111111111111.png",
      "b-222222222222.png",
    ]);
  });

  it("calcule et persiste les dimensions au listing si absentes", async () => {
    await writePng(dir, "pic-aaaaaaaaaaaa.png", 640, 480);
    const res = await listBlogImages(dir);
    expect(res.images[0]).toMatchObject({ width: 640, height: 480 });
    const sidecar = JSON.parse(
      await fs.readFile(path.join(dir, ".pic-aaaaaaaaaaaa.png.json"), "utf8"),
    );
    expect(sidecar).toMatchObject({ width: 640, height: 480 });
  });

  it("construit une URL publique relative quand aucune base n'est configurée", async () => {
    await writePng(dir, "url-aaaaaaaaaaaa.png");
    const res = await listBlogImages(dir);
    expect(res.images[0].url).toBe("/images/blog/url-aaaaaaaaaaaa.png");
  });

  it("ignore un sidecar orphelin (image supprimée à la main)", async () => {
    await fs.writeFile(
      path.join(dir, ".orphan-hhhhhhhhhhhh.png.json"),
      JSON.stringify({ alt: "x", width: 1, height: 1 }),
    );
    expect(await listBlogImages(dir)).toEqual({ images: [], total: 0 });
  });

  it("trie par date décroissante par défaut", async () => {
    await writePng(dir, "old-iiiiiiiiiiii.png");
    await writePng(dir, "new-jjjjjjjjjjjj.png");
    await fs.utimes(
      path.join(dir, "old-iiiiiiiiiiii.png"),
      new Date("2020-01-01"),
      new Date("2020-01-01"),
    );
    await fs.utimes(
      path.join(dir, "new-jjjjjjjjjjjj.png"),
      new Date("2024-01-01"),
      new Date("2024-01-01"),
    );
    const res = await listBlogImages(dir, { sort: "date" });
    expect(res.images.map((i) => i.filename)).toEqual([
      "new-jjjjjjjjjjjj.png",
      "old-iiiiiiiiiiii.png",
    ]);
  });

  it("trie par nom", async () => {
    await writePng(dir, "zebra-aaaaaaaaaaaa.png");
    await writePng(dir, "alpha-bbbbbbbbbbbb.png");
    const res = await listBlogImages(dir, { sort: "name" });
    expect(res.images.map((i) => i.filename)).toEqual([
      "alpha-bbbbbbbbbbbb.png",
      "zebra-aaaaaaaaaaaa.png",
    ]);
  });

  it("pagine les résultats", async () => {
    for (let i = 0; i < 5; i++) await writePng(dir, `img${i}-aaaaaaaaaaaa.png`);
    const p1 = await listBlogImages(dir, { page: 1, limit: 2, sort: "name" });
    expect(p1.total).toBe(5);
    expect(p1.images).toHaveLength(2);
    const p3 = await listBlogImages(dir, { page: 3, limit: 2, sort: "name" });
    expect(p3.images).toHaveLength(1);
  });

  it("filtre par sous-chaîne du nom (insensible à la casse)", async () => {
    await writePng(dir, "orc-warrior-aaaaaaaaaaaa.png");
    await writePng(dir, "elf-blitzer-bbbbbbbbbbbb.png");
    const res = await listBlogImages(dir, { search: "ORC" });
    expect(res.total).toBe(1);
    expect(res.images[0].filename).toContain("orc");
  });
});

describe("resolveBlogImagePath", () => {
  it("accepte un nom d'image valide", () => {
    expect(resolveBlogImagePath(dir, "mon-article-ab12cd34ef56.png")).toBe(
      path.resolve(dir, "mon-article-ab12cd34ef56.png"),
    );
  });

  it("rejette les noms hostiles ou non-image", () => {
    for (const bad of [
      "../etc/passwd",
      "..\\evil.png",
      "a/b.png",
      ".hidden.png",
      "no-ext",
      "script.txt",
      "../x.png",
      "bad..name.png", // contient ".."
    ]) {
      expect(() => resolveBlogImagePath(dir, bad)).toThrow(BlogImageStoreError);
    }
  });
});

describe("recordUploadedImage / setBlogImageAlt", () => {
  it("recordUploadedImage persiste les dimensions du buffer (alt vide)", async () => {
    const name = "up-bbbbbbbbbbbb.png";
    await writePng(dir, name, 100, 200);
    await recordUploadedImage(dir, name, makePng(100, 200));
    const sidecar = JSON.parse(
      await fs.readFile(path.join(dir, `.${name}.json`), "utf8"),
    );
    expect(sidecar).toEqual({ alt: null, width: 100, height: 200 });
  });

  it("définit le texte alternatif (trim) en préservant les dimensions", async () => {
    const name = "alt-cccccccccccc.png";
    await writePng(dir, name, 50, 60);
    await recordUploadedImage(dir, name, makePng(50, 60));
    const updated = await setBlogImageAlt(dir, name, "  Un joueur Orc  ");
    expect(updated.alt).toBe("Un joueur Orc");
    expect(updated).toMatchObject({ width: 50, height: 60 });
    const sidecar = JSON.parse(
      await fs.readFile(path.join(dir, `.${name}.json`), "utf8"),
    );
    expect(sidecar).toMatchObject({
      alt: "Un joueur Orc",
      width: 50,
      height: 60,
    });
  });

  it("efface le texte alternatif si chaîne vide", async () => {
    const name = "empty-dddddddddddd.png";
    await writePng(dir, name);
    await setBlogImageAlt(dir, name, "coucou");
    const cleared = await setBlogImageAlt(dir, name, "   ");
    expect(cleared.alt).toBeNull();
  });

  it("lève not-found si l'image visée n'existe pas", async () => {
    await expect(
      setBlogImageAlt(dir, "ghost-eeeeeeeeeeee.png", "x"),
    ).rejects.toMatchObject({
      code: "not-found",
    });
  });

  it("deux éditions alt concurrentes sur des fichiers différents ne s'écrasent pas", async () => {
    const a = "concura-aaaaaaaaaaaa.png";
    const b = "concurb-bbbbbbbbbbbb.png";
    await writePng(dir, a);
    await writePng(dir, b);
    await Promise.all([
      setBlogImageAlt(dir, a, "Alt A"),
      setBlogImageAlt(dir, b, "Alt B"),
    ]);
    expect((await getBlogImage(dir, a)).alt).toBe("Alt A");
    expect((await getBlogImage(dir, b)).alt).toBe("Alt B");
  });
});

describe("deleteBlogImage", () => {
  it("supprime l'image et son sidecar", async () => {
    const name = "del-ffffffffffff.png";
    await writePng(dir, name);
    await recordUploadedImage(dir, name, makePng(1, 1));
    await deleteBlogImage(dir, name);
    await expect(fs.access(path.join(dir, name))).rejects.toThrow();
    await expect(fs.access(path.join(dir, `.${name}.json`))).rejects.toThrow();
  });

  it("lève not-found si l'image n'existe pas", async () => {
    await expect(
      deleteBlogImage(dir, "ghost-gggggggggggg.png"),
    ).rejects.toMatchObject({
      code: "not-found",
    });
  });
});
