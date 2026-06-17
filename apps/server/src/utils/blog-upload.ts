/**
 * Helpers pour l'upload d'images du blog (cf. routes/admin-blog.ts `POST /upload`).
 *
 * Stockage : dossier `BLOG_UPLOAD_DIR` (env), par défaut le dossier
 * `apps/web/public/images/blog` du monorepo (servi par Next.js en dev). En
 * prod, le serveur sert lui-même ce dossier via `express.static("/images/blog")`
 * (les conteneurs web/server sont séparés — cf. docker-compose.prod.yml) : il
 * faut donc pointer `BLOG_UPLOAD_DIR` vers un volume persistant et
 * `BLOG_ASSET_PUBLIC_BASE` vers l'hôte API.
 *
 * Sécurité : le type est déterminé par **magic bytes** (jamais par le
 * Content-Type client), et le nom de fichier est généré côté serveur — aucune
 * portion du nom fourni par le client ne peut provoquer de path traversal.
 */

import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Taille max d'une image uploadée (octets). */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 Mo

/**
 * Dossier de destination des images. Résolu une seule fois au démarrage.
 * - `BLOG_UPLOAD_DIR` absolu en prod (volume monté, cf. compose prod).
 * - Défaut : `<repo>/apps/web/public/images/blog` (utils → ../../../web/...).
 */
export const BLOG_UPLOAD_DIR = process.env.BLOG_UPLOAD_DIR
  ? path.resolve(process.env.BLOG_UPLOAD_DIR)
  : path.resolve(__dirname, "../../../web/public/images/blog");

/**
 * Préfixe public des URLs renvoyées. Vide => URL relative `/images/blog/x`
 * (OK en dev, Next sert le dossier). En prod, mettre l'hôte API
 * (`https://api.nufflearena.fr`) car c'est le serveur Express qui sert le
 * fichier, pas Next.
 */
const ASSET_PUBLIC_BASE = (process.env.BLOG_ASSET_PUBLIC_BASE || "").replace(
  /\/+$/,
  "",
);

/** Chemin public servi par express.static (et par Next en dev). */
export const BLOG_PUBLIC_PATH = "/images/blog";

interface DetectedImage {
  readonly ext: "png" | "jpg" | "gif" | "webp";
  readonly mime: string;
}

/**
 * Détecte le type d'image à partir des octets de signature (magic bytes).
 * Retourne `null` si le contenu n'est pas une image supportée — on ne fait
 * jamais confiance au Content-Type déclaré par le client.
 */
export function detectImageType(buf: Buffer): DetectedImage | null {
  if (buf.length < 12) return null;
  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ext: "png", mime: "image/png" };
  }
  // JPEG : FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  // GIF : "GIF87a" / "GIF89a"
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  ) {
    return { ext: "gif", mime: "image/gif" };
  }
  // WEBP : "RIFF"...."WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

/**
 * Normalise une suggestion de nom (slug, sans extension ni chemin) en base
 * kebab-case sûre. Toute portion non `[a-z0-9-]` est éliminée, donc aucun `/`,
 * `\`, `.` ou `..` ne survit : pas de path traversal possible.
 */
export function safeNameBase(hint: string | undefined): string {
  const base = (hint ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "") // retire une éventuelle extension
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "image";
}

/**
 * Génère un nom de fichier unique et sûr : `<base>-<rand>.<ext>`.
 * Le suffixe aléatoire évite les collisions et les écrasements.
 */
export function generateImageFilename(
  hint: string | undefined,
  ext: string,
): string {
  return `${safeNameBase(hint)}-${randomBytes(6).toString("hex")}.${ext}`;
}

/** Construit l'URL publique d'un fichier uploadé. */
export function buildPublicUrl(filename: string): string {
  return `${ASSET_PUBLIC_BASE}${BLOG_PUBLIC_PATH}/${filename}`;
}
