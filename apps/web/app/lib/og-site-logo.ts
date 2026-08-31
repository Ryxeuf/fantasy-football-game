/**
 * Logo du site pour les images Open Graph (runtime Node uniquement).
 *
 * Satori a besoin d'une URL absolue ou d'une data URI. On lit le fichier
 * sur disque plutôt que de refetcher le site depuis lui-même : pas de
 * round-trip réseau, et l'image reste générable même si l'origine publique
 * n'est pas joignable depuis le conteneur.
 *
 * `og-logo.png` est une variante 320 × 320 de `logo.png` (1024 × 1024,
 * 1,8 Mo) : le rendu OG n'a pas besoin de plus, et charger 1,8 Mo à chaque
 * génération serait du gaspillage pur.
 *
 * Toute erreur de lecture rend `null` : la carte se rend alors sans logo,
 * plutôt que de faire échouer l'`ImageResponse` entière (un `src` vide ou
 * cassé, lui, la ferait échouer).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const LOGO_RELATIVE_PATH = path.join("public", "images", "og-logo.png");

/**
 * Cache mémoire du SUCCÈS uniquement : un échec de lecture n'est pas
 * mémorisé, sinon un incident transitoire (volume pas encore monté au
 * démarrage) priverait le processus de son logo jusqu'au prochain
 * redéploiement.
 */
let cached: string | undefined;

export async function loadSiteOgLogo(): Promise<string | null> {
  if (cached !== undefined) return cached;
  try {
    const buffer = await readFile(path.join(process.cwd(), LOGO_RELATIVE_PATH));
    cached = `data:image/png;base64,${buffer.toString("base64")}`;
    return cached;
  } catch {
    return null;
  }
}

/** Réinitialise le cache mémoire — réservé aux tests. */
export function resetSiteOgLogoCache(): void {
  cached = undefined;
}
