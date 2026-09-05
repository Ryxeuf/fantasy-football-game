/**
 * Helpers pour l'upload des DOCUMENTS OFFICIELS d'une competition (ligue /
 * championnat ou coupe) — cf. `services/competition-documents.ts` et
 * `routes/competition-documents.ts`.
 *
 * Meme modele que les images du blog (`utils/blog-upload.ts`) et les logos
 * d'equipe (`utils/team-logo-upload.ts`) :
 *  - stockage fichier dans un dossier servi par `express.static` ;
 *  - type reel determine par **magic bytes**, jamais par le Content-Type
 *    client ;
 *  - nom de fichier **genere cote serveur** : aucune portion du nom fourni par
 *    le client ne peut provoquer de path traversal.
 *
 * La difference avec le blog : on accepte aussi le **PDF** (c'est le format
 * naturel d'un reglement de tournoi) et le plafond est de 10 Mo.
 *
 * Stockage : dossier `COMPETITION_DOCUMENT_UPLOAD_DIR` (env), par defaut
 * `apps/web/public/documents/competitions` (servi par Next.js en dev). En prod
 * les conteneurs web/server sont separes : pointer
 * `COMPETITION_DOCUMENT_UPLOAD_DIR` vers un volume persistant et
 * `COMPETITION_DOCUMENT_ASSET_PUBLIC_BASE` vers l'hote API (a defaut,
 * `BLOG_ASSET_PUBLIC_BASE` est repris, meme hote).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { safeNameBase } from "./blog-upload";
import { randomBytes } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Taille max d'un document officiel (octets). Plafond produit demande :
 * 10 Mo par fichier. C'est AUSSI la limite du parser `express.raw` de la
 * route : un depassement se traduit par un 413 propre, jamais par une lecture
 * complete en memoire.
 */
export const MAX_COMPETITION_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 Mo

const DEFAULT_COMPETITION_DOCUMENT_UPLOAD_DIR = path.resolve(
  __dirname,
  "../../../web/public/documents/competitions",
);

/**
 * Resout le dossier d'upload **a l'appel** (pas fige a l'import), pour
 * permettre l'override en test via `process.env.COMPETITION_DOCUMENT_UPLOAD_DIR`.
 * Miroir de `getBlogUploadDir()` / `getTeamLogoUploadDir()`.
 */
export function getCompetitionDocumentUploadDir(): string {
  return process.env.COMPETITION_DOCUMENT_UPLOAD_DIR
    ? path.resolve(process.env.COMPETITION_DOCUMENT_UPLOAD_DIR)
    : DEFAULT_COMPETITION_DOCUMENT_UPLOAD_DIR;
}

/** Chemin public servi par express.static (et par Next en dev). */
export const COMPETITION_DOCUMENT_PUBLIC_PATH = "/documents/competitions";

/**
 * Prefixe public des URLs renvoyees. Vide => URL relative
 * `/documents/competitions/x`. Retombe sur `BLOG_ASSET_PUBLIC_BASE` : en prod
 * les dossiers d'assets sont servis par le meme hote API.
 */
function assetPublicBase(): string {
  const base =
    process.env.COMPETITION_DOCUMENT_ASSET_PUBLIC_BASE ||
    process.env.BLOG_ASSET_PUBLIC_BASE ||
    "";
  return base.replace(/\/+$/, "");
}

/** Construit l'URL publique d'un document uploade. */
export function buildCompetitionDocumentUrl(filename: string): string {
  return `${assetPublicBase()}${COMPETITION_DOCUMENT_PUBLIC_PATH}/${filename}`;
}

/** Extensions acceptees pour un document officiel. */
export type CompetitionDocumentExt = "pdf" | "png" | "jpg" | "gif" | "webp";

export interface DetectedCompetitionDocument {
  readonly ext: CompetitionDocumentExt;
  readonly mime: string;
}

/**
 * Detecte le type d'un document a partir des octets de signature.
 * Retourne `null` si le contenu n'est ni un PDF ni une image supportee — on ne
 * fait jamais confiance au Content-Type declare par le client.
 *
 * Volontairement ecrit ici plutot que reutilise depuis `detectImageType` : la
 * liste des formats acceptes est une regle PRODUIT de ce module (PDF inclus),
 * elle ne doit pas deriver si celle du blog change.
 */
export function detectDocumentType(
  buf: Buffer,
): DetectedCompetitionDocument | null {
  if (buf.length < 12) return null;
  // PDF : "%PDF-"
  if (
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46 &&
    buf[4] === 0x2d
  ) {
    return { ext: "pdf", mime: "application/pdf" };
  }
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
  // GIF : "GIF8"
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
 * Base de nom d'un document : `safeNameBase` (kebab-case strict, aucun `/`,
 * `\`, `.` ni `..` ne survit) avec le repli propre a ce module.
 *
 * La sanitisation N'EST PAS reecrite ici : c'est la meme regle de securite que
 * pour les images du blog, et la dupliquer la ferait deriver. Seul le repli
 * change — `safeNameBase` renvoie "image" quand la suggestion ne laisse aucun
 * caractere exploitable, ce qui n'a pas de sens pour un reglement PDF.
 */
function documentNameBase(hint: string | undefined): string {
  const base = safeNameBase(hint);
  if (base === "image" && !/image/i.test(hint ?? "")) return "document";
  return base;
}

/**
 * Genere un nom de fichier unique et sur : `<base>-<rand>.<ext>`. Le suffixe
 * aleatoire evite les collisions et les ecrasements.
 */
export function generateDocumentFilename(
  hint: string | undefined,
  ext: CompetitionDocumentExt,
): string {
  return `${documentNameBase(hint)}-${randomBytes(6).toString("hex")}.${ext}`;
}

/** Nom de fichier accepte sur le disque (genere par nous, revalide au lu). */
const DOCUMENT_FILENAME_RE = /^[a-z0-9][a-z0-9-]*\.(pdf|png|jpg|gif|webp)$/i;

/**
 * Valide le nom et renvoie le chemin absolu confine dans `dir`. Trois gardes
 * cumulees (miroir de `resolveBlogImagePath`) : regex stricte, rejet explicite
 * des separateurs et de `..`, confinement `path.resolve`. Retourne `null`
 * plutot que de lever : l'appelant (suppression best-effort) ne doit rien
 * toucher sur le disque quand le nom est suspect.
 */
export function resolveCompetitionDocumentPath(
  dir: string,
  filename: string,
): string | null {
  if (
    !DOCUMENT_FILENAME_RE.test(filename) ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..")
  ) {
    return null;
  }
  const root = path.resolve(dir);
  const resolved = path.resolve(root, filename);
  if (!resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

/**
 * Nom de fichier propose au telechargement (`Content-Disposition`), derive du
 * titre saisi et de l'extension reelle. Purement cosmetique : le fichier servi
 * reste `filename`.
 */
export function downloadNameFor(title: string, filename: string): string {
  const ext = path.extname(filename).slice(1).toLowerCase() || "bin";
  return `${documentNameBase(title)}.${ext}`;
}
