/**
 * Helpers pour l'upload du logo d'une équipe (cf. `routes/team-logo-handlers.ts`).
 *
 * Même modèle que les images du blog (`utils/blog-upload.ts`) : stockage
 * fichier dans un dossier servi par `express.static`, détection du type par
 * **magic bytes** (jamais le Content-Type client) et nom de fichier généré
 * côté serveur — aucune portion du nom client ne peut provoquer de path
 * traversal. La détection et la génération de nom sont réutilisées telles
 * quelles depuis `blog-upload` pour ne pas dupliquer les règles de sécurité.
 *
 * Stockage : dossier `TEAM_LOGO_UPLOAD_DIR` (env), par défaut
 * `apps/web/public/images/team-logos` (servi par Next.js en dev). En prod,
 * les conteneurs web/server sont séparés : pointer `TEAM_LOGO_UPLOAD_DIR`
 * vers un volume persistant et `TEAM_LOGO_ASSET_PUBLIC_BASE` vers l'hôte API
 * (à défaut, `BLOG_ASSET_PUBLIC_BASE` est repris, même hôte).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Taille max d'un logo (octets). Volontairement plus stricte que les images
 * du blog : un logo est affiché en vignette, quelques centaines de ko
 * suffisent.
 */
export const MAX_TEAM_LOGO_BYTES = 2 * 1024 * 1024; // 2 Mo

const DEFAULT_TEAM_LOGO_UPLOAD_DIR = path.resolve(
  __dirname,
  "../../../web/public/images/team-logos",
);

/**
 * Résout le dossier d'upload **à l'appel** (pas figé à l'import), pour
 * permettre l'override en test via `process.env.TEAM_LOGO_UPLOAD_DIR`.
 * Miroir de `getBlogUploadDir()`.
 */
export function getTeamLogoUploadDir(): string {
  return process.env.TEAM_LOGO_UPLOAD_DIR
    ? path.resolve(process.env.TEAM_LOGO_UPLOAD_DIR)
    : DEFAULT_TEAM_LOGO_UPLOAD_DIR;
}

/** Chemin public servi par express.static (et par Next en dev). */
export const TEAM_LOGO_PUBLIC_PATH = "/images/team-logos";

/**
 * Préfixe public des URLs renvoyées. Vide => URL relative
 * `/images/team-logos/x`. Retombe sur `BLOG_ASSET_PUBLIC_BASE` : en prod les
 * deux dossiers sont servis par le même hôte API.
 */
function assetPublicBase(): string {
  const base =
    process.env.TEAM_LOGO_ASSET_PUBLIC_BASE ||
    process.env.BLOG_ASSET_PUBLIC_BASE ||
    "";
  return base.replace(/\/+$/, "");
}

/** Construit l'URL publique d'un logo uploadé. */
export function buildTeamLogoUrl(filename: string): string {
  return `${assetPublicBase()}${TEAM_LOGO_PUBLIC_PATH}/${filename}`;
}

/**
 * Nom de fichier d'un logo servi par ce serveur, extrait d'une URL stockée.
 * Retourne `null` si l'URL ne pointe pas vers notre dossier de logos (logo
 * externe, URL malformée) : l'appelant ne doit alors rien supprimer sur le
 * disque.
 */
export function teamLogoFilenameFromUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const marker = `${TEAM_LOGO_PUBLIC_PATH}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const filename = url.slice(at + marker.length);
  // Un nom généré ne contient ni séparateur ni segment relatif : tout le
  // reste est refusé plutôt que nettoyé (défense en profondeur avant un
  // `unlink` sur un chemin construit).
  if (!/^[a-z0-9][a-z0-9-]*\.(png|jpg|gif|webp)$/i.test(filename)) return null;
  return filename;
}
