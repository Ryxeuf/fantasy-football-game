/**
 * Helpers pour l'upload de l'image d'un joueur d'équipe
 * (cf. `routes/player-image-handlers.ts`).
 *
 * Même modèle que le logo d'équipe (`utils/team-logo-upload.ts`) : stockage
 * fichier dans un dossier servi par `express.static`, détection du type par
 * **magic bytes** (jamais le Content-Type client) et nom de fichier généré
 * côté serveur — aucune portion du nom client ne peut provoquer de path
 * traversal.
 *
 * Stockage : dossier `PLAYER_IMAGE_UPLOAD_DIR` (env), par défaut
 * `apps/web/public/images/player-images` (servi par Next.js en dev). En
 * prod, pointer `PLAYER_IMAGE_UPLOAD_DIR` vers un volume persistant et
 * `PLAYER_IMAGE_ASSET_PUBLIC_BASE` vers l'hôte API (à défaut,
 * `BLOG_ASSET_PUBLIC_BASE` est repris, même hôte).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Taille max d'une image de joueur (octets). Comme le logo d'équipe :
 * l'image est affichée en miniature sur le site (la pleine résolution ne
 * sert qu'à l'export de la carte joueur 750×1050) — 2 Mo suffisent.
 */
export const MAX_PLAYER_IMAGE_BYTES = 2 * 1024 * 1024; // 2 Mo

const DEFAULT_PLAYER_IMAGE_UPLOAD_DIR = path.resolve(
  __dirname,
  "../../../web/public/images/player-images",
);

/**
 * Résout le dossier d'upload **à l'appel** (pas figé à l'import), pour
 * permettre l'override en test via `process.env.PLAYER_IMAGE_UPLOAD_DIR`.
 */
export function getPlayerImageUploadDir(): string {
  return process.env.PLAYER_IMAGE_UPLOAD_DIR
    ? path.resolve(process.env.PLAYER_IMAGE_UPLOAD_DIR)
    : DEFAULT_PLAYER_IMAGE_UPLOAD_DIR;
}

/** Chemin public servi par express.static (et par Next en dev). */
export const PLAYER_IMAGE_PUBLIC_PATH = "/images/player-images";

/**
 * Préfixe public des URLs renvoyées. Vide => URL relative. Retombe sur
 * `BLOG_ASSET_PUBLIC_BASE` : en prod les dossiers sont servis par le même
 * hôte API.
 */
function assetPublicBase(): string {
  const base =
    process.env.PLAYER_IMAGE_ASSET_PUBLIC_BASE ||
    process.env.BLOG_ASSET_PUBLIC_BASE ||
    "";
  return base.replace(/\/+$/, "");
}

/** Construit l'URL publique d'une image de joueur uploadée. */
export function buildPlayerImageUrl(filename: string): string {
  return `${assetPublicBase()}${PLAYER_IMAGE_PUBLIC_PATH}/${filename}`;
}

/**
 * Nom de fichier d'une image servie par ce serveur, extrait d'une URL
 * stockée. Retourne `null` si l'URL ne pointe pas vers notre dossier
 * (image externe, URL malformée) : l'appelant ne doit alors rien supprimer
 * sur le disque.
 */
export function playerImageFilenameFromUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const marker = `${PLAYER_IMAGE_PUBLIC_PATH}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const filename = url.slice(at + marker.length);
  // Un nom généré ne contient ni séparateur ni segment relatif : tout le
  // reste est refusé plutôt que nettoyé (défense en profondeur avant un
  // `unlink` sur un chemin construit).
  if (!/^[a-z0-9][a-z0-9-]*\.(png|jpg)$/i.test(filename)) return null;
  return filename;
}
