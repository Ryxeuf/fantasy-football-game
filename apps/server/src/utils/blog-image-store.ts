/**
 * Repository disque des images du blog (médiathèque admin — cf.
 * `routes/admin-blog.ts`). Le **disque est la source de vérité** : aucune table
 * Prisma. On liste/supprime les fichiers de `BLOG_UPLOAD_DIR` et on persiste les
 * métadonnées éditables (texte alternatif, dimensions) dans un **sidecar JSON
 * caché par image** : `.<image>.json`.
 *
 * Pourquoi un sidecar par fichier plutôt qu'un fichier-map global :
 *  - pas d'écrasement entre deux éditions concurrentes (chaque PATCH ne touche
 *    qu'un fichier) ;
 *  - la suppression d'une image retire son compagnon (zéro orphelin) ;
 *  - écriture atomique (tmp + rename dans le même dossier).
 *
 * Le listing part **toujours** de `readdir` des images réelles, jamais du
 * sidecar : un sidecar orphelin est simplement ignoré. Toutes les fonctions
 * prennent `dir` en paramètre (testabilité : un tmpdir en test, `getBlogUploadDir()`
 * en prod).
 *
 * Sécurité : nom de fichier validé par regex stricte + confinement
 * `path.resolve` (anti path-traversal), `unlink`/`lstat` (ne suit pas les
 * symlinks). Miroir du pattern de `routes/admin-sim-replays.ts`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

import { parseImageDimensions } from "./blog-image-dimensions";
import { buildPublicUrl } from "./blog-upload";

/** Nom de fichier image accepté : pas de dotfile, extension image uniquement. */
const IMAGE_FILENAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|jpe?g|gif|webp)$/i;

/** En-tête lu pour deviner les dimensions des images historiques (sans dims en sidecar). */
const HEADER_READ_BYTES = 256 * 1024;

export type BlogImageStoreErrorCode = "invalid-filename" | "not-found";

/** Erreur typée mappée en HTTP par la route (400 / 404). */
export class BlogImageStoreError extends Error {
  constructor(
    public readonly code: BlogImageStoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BlogImageStoreError";
  }
}

/** Métadonnées éditables persistées dans le sidecar. */
interface BlogImageMeta {
  alt: string | null;
  width: number | null;
  height: number | null;
}

/** Image telle qu'exposée à l'admin (disque + sidecar fusionnés). */
export interface BlogImageItem {
  readonly filename: string;
  readonly url: string;
  readonly bytes: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly alt: string | null;
  /** Date d'upload approximée par le mtime (noms immuables ⇒ jamais réécrits). */
  readonly uploadedAt: string;
  readonly ext: string;
}

export type BlogImageSort = "date" | "name" | "size";

export interface ListBlogImagesOptions {
  readonly search?: string;
  readonly page?: number;
  readonly limit?: number;
  readonly sort?: BlogImageSort;
}

export interface ListBlogImagesResult {
  readonly images: readonly BlogImageItem[];
  readonly total: number;
}

function isImageFilename(name: string): boolean {
  return !name.startsWith(".") && IMAGE_FILENAME_RE.test(name);
}

/**
 * Valide le nom et renvoie le chemin absolu confiné dans `dir`. Trois gardes
 * cumulées : regex stricte, rejet explicite de `/`, `\`, `..`, et confinement
 * `resolve(dir, name).startsWith(resolve(dir) + sep)`.
 */
export function resolveBlogImagePath(dir: string, filename: string): string {
  if (
    !isImageFilename(filename) ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..")
  ) {
    throw new BlogImageStoreError(
      "invalid-filename",
      `Nom de fichier image invalide : ${filename}`,
    );
  }
  const root = path.resolve(dir);
  const resolved = path.resolve(root, filename);
  if (!resolved.startsWith(root + path.sep)) {
    throw new BlogImageStoreError(
      "invalid-filename",
      `Chemin hors du dossier d'images : ${filename}`,
    );
  }
  return resolved;
}

/** Chemin du sidecar caché d'une image (le nom est déjà validé en amont). */
function sidecarPath(dir: string, filename: string): string {
  return path.join(dir, `.${filename}.json`);
}

const EMPTY_META: BlogImageMeta = { alt: null, width: null, height: null };

/** Lit le sidecar ; tolérant (absent / JSON cassé ⇒ métadonnées vides). */
async function readImageMeta(
  dir: string,
  filename: string,
): Promise<BlogImageMeta> {
  try {
    const raw = await fs.readFile(sidecarPath(dir, filename), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...EMPTY_META };
    const obj = parsed as Record<string, unknown>;
    return {
      alt: typeof obj.alt === "string" ? obj.alt : null,
      width: typeof obj.width === "number" ? obj.width : null,
      height: typeof obj.height === "number" ? obj.height : null,
    };
  } catch {
    return { ...EMPTY_META };
  }
}

/** Écriture atomique du sidecar (tmp dans le même dossier puis rename). */
async function writeImageMeta(
  dir: string,
  filename: string,
  meta: BlogImageMeta,
): Promise<void> {
  const target = sidecarPath(dir, filename);
  const tmp = path.join(
    dir,
    `.${filename}.${randomBytes(6).toString("hex")}.tmp`,
  );
  await fs.writeFile(tmp, JSON.stringify(meta), "utf8");
  await fs.rename(tmp, target);
}

/** Lit un préfixe borné du fichier (suffisant pour les en-têtes d'images). */
async function readHeaderBytes(filePath: string): Promise<Buffer> {
  const fh = await fs.open(filePath, "r");
  try {
    const { size } = await fh.stat();
    const len = Math.min(size, HEADER_READ_BYTES);
    const buf = Buffer.alloc(len);
    if (len > 0) await fh.read(buf, 0, len, 0);
    return buf;
  } finally {
    await fh.close();
  }
}

interface BuildOptions {
  /** Si true, calcule les dimensions manquantes (lecture en-tête) et les persiste. */
  readonly backfillDimensions: boolean;
}

async function buildImageItem(
  dir: string,
  filename: string,
  stat: { size: number; mtimeMs: number },
  meta: BlogImageMeta,
  opts: BuildOptions,
): Promise<BlogImageItem> {
  let { width, height } = meta;
  if (opts.backfillDimensions && (width === null || height === null)) {
    try {
      const dims = parseImageDimensions(
        await readHeaderBytes(path.join(dir, filename)),
      );
      if (dims) {
        width = dims.width;
        height = dims.height;
        await writeImageMeta(dir, filename, { ...meta, width, height });
      }
    } catch {
      // Lecture impossible : on laisse les dimensions inconnues (null).
    }
  }
  return {
    filename,
    url: buildPublicUrl(filename),
    bytes: stat.size,
    width,
    height,
    alt: meta.alt,
    uploadedAt: new Date(stat.mtimeMs).toISOString(),
    ext: path.extname(filename).slice(1).toLowerCase(),
  };
}

function sortNames(
  stats: ReadonlyArray<{ name: string; size: number; mtimeMs: number }>,
  sort: BlogImageSort,
): ReadonlyArray<{ name: string; size: number; mtimeMs: number }> {
  const copy = [...stats];
  switch (sort) {
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "size":
      return copy.sort((a, b) => b.size - a.size);
    case "date":
    default:
      return copy.sort((a, b) => b.mtimeMs - a.mtimeMs);
  }
}

/**
 * Liste les images du dossier. `readdir` filtré sur les vrais fichiers image,
 * puis `lstat` (symlink-safe) pour taille/date, tri, pagination, et backfill
 * des dimensions **uniquement sur la page** retournée. Dossier absent ⇒ vide.
 */
export async function listBlogImages(
  dir: string,
  options: ListBlogImagesOptions = {},
): Promise<ListBlogImagesResult> {
  const { search, page = 1, limit = 50, sort = "date" } = options;

  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { images: [], total: 0 };
    }
    throw err;
  }

  let names = entries.filter(isImageFilename);
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    names = names.filter((n) => n.toLowerCase().includes(q));
  }

  // lstat tous les fichiers filtrés (léger, pas de lecture de contenu) pour
  // pouvoir trier par date/taille de façon cohérente.
  const stats = (
    await Promise.all(
      names.map(async (name) => {
        try {
          const st = await fs.lstat(path.join(dir, name));
          if (!st.isFile()) return null;
          return { name, size: st.size, mtimeMs: st.mtimeMs };
        } catch {
          return null;
        }
      }),
    )
  ).filter(
    (s): s is { name: string; size: number; mtimeMs: number } => s !== null,
  );

  const total = stats.length;
  const sorted = sortNames(stats, sort);
  const start = (Math.max(1, page) - 1) * limit;
  const pageStats = sorted.slice(start, start + limit);

  const images = await Promise.all(
    pageStats.map(async (s) => {
      const meta = await readImageMeta(dir, s.name);
      return buildImageItem(dir, s.name, s, meta, { backfillDimensions: true });
    }),
  );

  return { images, total };
}

/** Récupère une image unique (méta + dimensions). 404 typé si absente. */
export async function getBlogImage(
  dir: string,
  filename: string,
): Promise<BlogImageItem> {
  const resolved = resolveBlogImagePath(dir, filename);
  let stat: { size: number; mtimeMs: number; isFile: () => boolean };
  try {
    stat = await fs.lstat(resolved);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new BlogImageStoreError(
        "not-found",
        `Image introuvable : ${filename}`,
      );
    }
    throw err;
  }
  if (!stat.isFile()) {
    throw new BlogImageStoreError(
      "not-found",
      `Image introuvable : ${filename}`,
    );
  }
  const meta = await readImageMeta(dir, filename);
  return buildImageItem(dir, filename, stat, meta, {
    backfillDimensions: true,
  });
}

/**
 * Définit (ou efface si vide/null) le texte alternatif d'une image, en
 * préservant les autres métadonnées (dimensions). Renvoie l'image à jour.
 */
export async function setBlogImageAlt(
  dir: string,
  filename: string,
  alt: string | null,
): Promise<BlogImageItem> {
  const resolved = resolveBlogImagePath(dir, filename);
  let stat: { size: number; mtimeMs: number; isFile: () => boolean };
  try {
    stat = await fs.lstat(resolved);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new BlogImageStoreError(
        "not-found",
        `Image introuvable : ${filename}`,
      );
    }
    throw err;
  }
  const meta = await readImageMeta(dir, filename);
  const trimmed = typeof alt === "string" ? alt.trim() : "";
  const next: BlogImageMeta = { ...meta, alt: trimmed ? trimmed : null };
  await writeImageMeta(dir, filename, next);
  return buildImageItem(dir, filename, stat, next, {
    backfillDimensions: true,
  });
}

/**
 * Enregistre les métadonnées d'une image fraîchement uploadée : dimensions
 * calculées depuis le buffer (gratuit, on l'a en main), alt vide. Appelé par le
 * handler `/upload`. Best-effort : ne doit jamais faire échouer l'upload.
 */
export async function recordUploadedImage(
  dir: string,
  filename: string,
  buf: Buffer,
): Promise<void> {
  const dims = parseImageDimensions(buf);
  await writeImageMeta(dir, filename, {
    alt: null,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
  });
}

/** Supprime une image et son sidecar. 404 typé si l'image n'existe pas. */
export async function deleteBlogImage(
  dir: string,
  filename: string,
): Promise<void> {
  const resolved = resolveBlogImagePath(dir, filename);
  try {
    await fs.unlink(resolved); // unlink : retire le lien, ne suit pas un symlink
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new BlogImageStoreError(
        "not-found",
        `Image introuvable : ${filename}`,
      );
    }
    throw err;
  }
  // Sidecar : best-effort (peut ne pas exister pour les images historiques).
  await fs.rm(sidecarPath(dir, filename), { force: true });
}
