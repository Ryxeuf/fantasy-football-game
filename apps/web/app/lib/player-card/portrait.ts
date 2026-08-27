/**
 * Résolution du portrait d'une carte joueur pour le rendu satori.
 *
 * Deux problèmes à régler avant de passer une image à `ImageResponse` :
 *
 *  1. **satori ne décode que png / apng / jpeg / gif / svg.** Les portraits du
 *     catalogue (Star Players) sont en `.webp` : passés tels quels, satori
 *     lève « Unsupported image type » et la carte sort sans visuel. On les
 *     transcode donc en PNG (sharp) avant de les embarquer.
 *  2. **satori fetch les URLs distantes.** Pour un asset servi par le site
 *     lui-même, la lecture directe sur le disque évite un aller-retour HTTP
 *     vers sa propre origine (et fonctionne même quand le rendu se fait avant
 *     que le serveur n'accepte des connexions).
 *
 * Sécurité : seuls des chemins d'un dossier ALLOWLISTÉ de `public/` sont lus,
 * et le chemin absolu résolu doit rester sous ce dossier (anti-traversal).
 * Toute autre URL est rendue telle quelle par l'appelant (chemin historique).
 *
 * Module **serveur** : à n'importer que depuis un route handler
 * `runtime = "nodejs"`.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Dossiers de `public/` dont une image peut être embarquée dans une carte :
 * visuels de Star Players, illustrations de positionnels, photos de joueurs
 * uploadées par les coachs (quand elles sont servies par le front).
 */
const PORTRAIT_DIRS = ["star-players", "positions", "player-images"] as const;

/** Extensions acceptées (celles que sharp sait ouvrir, plus le SVG). */
const PORTRAIT_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
] as const;

/** Formats déjà compris par satori : aucune conversion nécessaire. */
const SATORI_NATIVE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/** Garde-fou : un portrait embarqué en data URI ne doit pas exploser la carte. */
const MAX_PORTRAIT_BYTES = 8 * 1024 * 1024;

/**
 * Chemin historique des visuels de Star Players tel que stocké en base
 * (`StarPlayer.imageUrl`), déjà réécrit à l'affichage sur la fiche publique.
 * La carte applique la MÊME réécriture pour montrer le même visuel.
 */
const LEGACY_STAR_PREFIX = "/data/Star-Players_files/";
const STAR_PUBLIC_PREFIX = "/images/star-players/";

const SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9 '._-]*$/;

/**
 * Normalise une URL d'image de catalogue en chemin public `/images/<dir>/<file>`.
 * Retourne `null` si l'URL ne désigne pas un asset local exploitable.
 */
export function normalizePortraitPath(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let pathname = raw;
  if (!pathname.startsWith("/")) {
    try {
      pathname = new URL(raw).pathname;
    } catch {
      return null;
    }
  }
  if (pathname.startsWith(LEGACY_STAR_PREFIX)) {
    pathname = STAR_PUBLIC_PREFIX + pathname.slice(LEGACY_STAR_PREFIX.length);
  }
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const parts = pathname.split("/");
  // ["", "images", "<dir>", "<file>"] — pas de sous-dossier supplémentaire.
  if (parts.length !== 4 || parts[0] !== "" || parts[1] !== "images") {
    return null;
  }
  const [, , dir, file] = parts;
  if (!(PORTRAIT_DIRS as readonly string[]).includes(dir)) return null;
  if (!SEGMENT_RE.test(file)) return null;
  const ext = path.extname(file).toLowerCase();
  if (!(PORTRAIT_EXTENSIONS as readonly string[]).includes(ext)) return null;
  return `/images/${dir}/${file}`;
}

/** Racine des assets statiques du front (`apps/web/public`). */
function publicRoot(): string {
  return path.join(process.cwd(), "public");
}

function toDataUri(mime: string, bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Transcode un buffer en PNG via sharp. `sharp` est importé PARESSEUSEMENT :
 * une installation sans binaire natif ne doit pas casser le rendu de carte —
 * on retombe alors sur l'emblème programmatique.
 */
async function transcodeToPng(bytes: Buffer): Promise<string | null> {
  try {
    const { default: sharp } = await import("sharp");
    const png = await sharp(bytes).png().toBuffer();
    return toDataUri("image/png", new Uint8Array(png));
  } catch {
    return null;
  }
}

/** Cache process : un portrait donné n'est lu et transcodé qu'une fois. */
const cache = new Map<string, string | null>();

/**
 * Charge le portrait local désigné par `raw` et le renvoie en data URI prêt
 * pour satori. `null` si l'URL n'est pas un asset local connu, si le fichier
 * est absent, trop gros, ou si la conversion échoue — l'appelant retombe
 * alors sur son rendu par défaut.
 */
export async function loadPortraitDataUri(
  raw: string | null | undefined,
): Promise<string | null> {
  const publicPath = normalizePortraitPath(raw);
  if (!publicPath) return null;
  const cached = cache.get(publicPath);
  if (cached !== undefined) return cached;

  const result = await readPortrait(publicPath);
  cache.set(publicPath, result);
  return result;
}

async function readPortrait(publicPath: string): Promise<string | null> {
  const root = publicRoot();
  const absolute = path.resolve(root, `.${publicPath}`);
  // Ceinture et bretelles : le chemin est déjà validé segment par segment.
  if (!absolute.startsWith(root + path.sep)) return null;
  let bytes: Buffer;
  try {
    bytes = await readFile(absolute);
  } catch {
    return null;
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PORTRAIT_BYTES) {
    return null;
  }
  const ext = path.extname(publicPath).toLowerCase();
  if (SATORI_NATIVE_EXTENSIONS.has(ext)) {
    return toDataUri(MIME_BY_EXTENSION[ext], new Uint8Array(bytes));
  }
  return transcodeToPng(bytes);
}

/** Vrai si l'extension du chemin est directement décodable par satori. */
export function isSatoriNativeImage(publicPath: string): boolean {
  return SATORI_NATIVE_EXTENSIONS.has(path.extname(publicPath).toLowerCase());
}

/**
 * Résout l'image d'une carte en une source utilisable par satori.
 *
 * - asset local du site (chemin relatif d'un dossier allowlisté) : embarqué
 *   en data URI, transcodé en PNG au besoin ;
 * - autre URL : comportement historique — un chemin relatif est absolutisé
 *   contre l'origine de la requête, une URL absolue est passée telle quelle ;
 * - `undefined` quand rien d'affichable ne peut être produit : l'appelant
 *   retombe sur l'emblème programmatique plutôt que de faire échouer le rendu
 *   (satori lève sur un format qu'il ne sait pas décoder).
 */
export async function resolveCardImageUrl(
  raw: string | null | undefined,
  origin: string,
): Promise<string | undefined> {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  const isRelative = raw.startsWith("/");
  const publicPath = normalizePortraitPath(raw);
  if (publicPath && isRelative) {
    const dataUri = await loadPortraitDataUri(raw);
    if (dataUri) return dataUri;
    // Fichier introuvable côté front (upload servi par l'API en prod) :
    // on ne peut absolutiser que ce que satori sait décoder.
    return isSatoriNativeImage(publicPath)
      ? new URL(raw, origin).toString()
      : undefined;
  }
  if (publicPath && !isSatoriNativeImage(publicPath)) return undefined;
  return isRelative ? new URL(raw, origin).toString() : raw;
}

/** Vide le cache process (tests). */
export function resetPortraitCache(): void {
  cache.clear();
}
