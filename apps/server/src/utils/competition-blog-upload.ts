/**
 * Images des blogs de compétition (change OpenSpec `competition-blog`).
 *
 * Patron des uploads du site (cf. `utils/blog-upload`,
 * `utils/competition-document-upload`) :
 *  1. corps binaire brut, taille bornée par le PARSER (413 au-delà) ;
 *  2. type par octets magiques (JPEG, PNG, WebP, GIF), jamais le
 *     Content-Type ni l'extension ;
 *  3. nom de fichier GÉNÉRÉ côté serveur : aucune portion du nom client ne
 *     survit.
 *
 * Chaque compétition a SON dossier (`<kind>-<id>`) : l'assainissement d'un
 * article n'accepte que les images de ce dossier — ni pixel espion d'un
 * domaine tiers, ni réemploi d'une image du blog d'une compétition privée.
 * Pas de table : comme la médiathèque du blog, le disque fait foi.
 */

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectImageType } from "./blog-upload";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type BlogCompetitionKind = "league" | "cup";

/** Taille max d'une image (octets), portée par `express.raw`. */
export const MAX_COMPETITION_BLOG_IMAGE_BYTES = 3 * 1024 * 1024;

const DEFAULT_DIR = path.resolve(
  __dirname,
  "../../../web/public/images/competition-blog",
);

/** Dossier racine, résolu À L'APPEL (override par env testable). */
export function getCompetitionBlogUploadDir(): string {
  return process.env.COMPETITION_BLOG_UPLOAD_DIR
    ? path.resolve(process.env.COMPETITION_BLOG_UPLOAD_DIR)
    : DEFAULT_DIR;
}

/** Chemin public servi par `express.static` (et par Next en dev). */
export const COMPETITION_BLOG_PUBLIC_PATH = "/images/competition-blog";

function assetPublicBase(): string {
  const base =
    process.env.COMPETITION_BLOG_ASSET_PUBLIC_BASE ||
    process.env.BLOG_ASSET_PUBLIC_BASE ||
    "";
  return base.replace(/\/+$/, "");
}

/** Un id de compétition est un cuid : rien d'autre ne nomme un dossier. */
const SAFE_ID = /^[a-z0-9]{1,64}$/i;

export function competitionBlogFolder(
  kind: BlogCompetitionKind,
  competitionId: string,
): string {
  if (!SAFE_ID.test(competitionId)) {
    throw new Error("Identifiant de competition invalide");
  }
  return `${kind}-${competitionId}`;
}

/**
 * Préfixes d'URL acceptés pour une image de la compétition : le chemin
 * relatif, et sa forme absolue quand l'hôte d'assets est configuré (prod).
 */
export function competitionBlogImagePrefixes(
  kind: BlogCompetitionKind,
  competitionId: string,
): string[] {
  const relative = `${COMPETITION_BLOG_PUBLIC_PATH}/${competitionBlogFolder(kind, competitionId)}/`;
  const base = assetPublicBase();
  return base ? [relative, `${base}${relative}`] : [relative];
}

export function buildCompetitionBlogImageUrl(
  kind: BlogCompetitionKind,
  competitionId: string,
  filename: string,
): string {
  return `${assetPublicBase()}${COMPETITION_BLOG_PUBLIC_PATH}/${competitionBlogFolder(kind, competitionId)}/${filename}`;
}

/** Nom d'un fichier généré par `saveCompetitionBlogImage`. */
export const COMPETITION_BLOG_FILENAME = /^[a-f0-9]{16}\.(png|jpg|gif|webp)$/;

export class CompetitionBlogImageError extends Error {
  constructor(
    public readonly code: "unsupported_type" | "empty",
    message: string,
  ) {
    super(message);
    this.name = "CompetitionBlogImageError";
  }
}

export interface SavedCompetitionBlogImage {
  readonly url: string;
  readonly filename: string;
  readonly bytes: number;
  readonly mimeType: string;
}

export async function saveCompetitionBlogImage(
  kind: BlogCompetitionKind,
  competitionId: string,
  buffer: Buffer,
): Promise<SavedCompetitionBlogImage> {
  if (buffer.length === 0) {
    throw new CompetitionBlogImageError("empty", "Fichier vide");
  }
  const detected = detectImageType(buffer);
  if (!detected) {
    throw new CompetitionBlogImageError(
      "unsupported_type",
      "Format non supporte (JPEG, PNG, WebP ou GIF)",
    );
  }
  const folder = competitionBlogFolder(kind, competitionId);
  const dir = path.join(getCompetitionBlogUploadDir(), folder);
  await mkdir(dir, { recursive: true });
  const filename = `${randomBytes(8).toString("hex")}.${detected.ext}`;
  await writeFile(path.join(dir, filename), buffer, { flag: "wx" });
  return {
    url: buildCompetitionBlogImageUrl(kind, competitionId, filename),
    filename,
    bytes: buffer.length,
    mimeType: detected.mime,
  };
}

/**
 * Quota d'uploads par auteur sur une fenêtre glissante. En MÉMOIRE et par
 * processus : sans table, un fichier n'est pas attribuable à son auteur. Un
 * garde-fou anti-abus, la taille restant bornée par le parser.
 */
export function createUploadQuota(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    /** Consomme une unité ; `false` si le quota est atteint. */
    take(userId: string, now: number = Date.now()): boolean {
      const recent = (hits.get(userId) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(userId, recent);
        return false;
      }
      hits.set(userId, [...recent, now]);
      return true;
    },
    reset(): void {
      hits.clear();
    },
  };
}
