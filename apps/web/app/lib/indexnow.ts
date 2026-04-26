/**
 * IndexNow protocol client (Q.18 — Sprint 23).
 *
 * IndexNow est un protocole gratuit, partage par Bing, Yandex, Naver,
 * Seznam et Yep, qui permet de notifier les moteurs de recherche d'un
 * changement d'URL sans attendre le re-crawl periodique.
 *
 * Concept :
 *   1. Genere une cle aleatoire (8-128 chars, alphanumerique + _ -)
 *   2. Heberge la cle sous une URL connue (ex: /indexnow-key.txt)
 *   3. POST le payload sur l'endpoint d'un operateur — il propage aux
 *      autres operateurs IndexNow.
 *
 * Ce module reste pur : pas de fetch. La couche HTTP est dans la route
 * Next.js qui appelle `buildIndexNowPayload` puis envoie le POST.
 *
 * Specification : https://www.indexnow.org/documentation
 */

const KEY_REGEX = /^[A-Za-z0-9_-]{8,128}$/;
const MAX_URLS_PER_REQUEST = 10000;

/**
 * Endpoints IndexNow officiels. POST sur n'importe lequel propage
 * aux autres operateurs participants.
 */
export const INDEXNOW_ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
  "https://yandex.com/indexnow",
] as const;

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

export interface BuildIndexNowPayloadInput {
  /** Hostname autorise (les URLs hors-host sont filtrees). */
  host: string;
  /** Cle IndexNow. Doit valider {@link isValidIndexNowKey}. */
  key: string;
  /** URL https complete du fichier hebergeant la cle (ex: /indexnow-key.txt). */
  keyLocation: string;
  urls: ReadonlyArray<string>;
}

/**
 * Verifie qu'une cle respecte les contraintes IndexNow :
 *  - 8 a 128 caracteres
 *  - alphanumerique + tirets + underscores uniquement
 */
export function isValidIndexNowKey(key: string | undefined | null): boolean {
  if (typeof key !== "string") return false;
  return KEY_REGEX.test(key);
}

/**
 * Filtre une liste d'URLs pour ne garder que celles compatibles avec
 * le protocole : https + meme host. Dedoublonne en preservant l'ordre.
 */
export function filterIndexNowUrls(
  urls: ReadonlyArray<string>,
  host: string,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of urls) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      continue;
    }
    if (parsed.protocol !== "https:") continue;
    if (parsed.hostname !== host) continue;
    const normalized = parsed.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

/**
 * Construit un payload IndexNow valide. Leve en cas d'entree invalide
 * pour eviter d'envoyer un POST qui sera rejete par les operateurs.
 */
export function buildIndexNowPayload(
  input: BuildIndexNowPayloadInput,
): IndexNowPayload {
  if (!isValidIndexNowKey(input.key)) {
    throw new Error("Invalid IndexNow key");
  }
  let location: URL;
  try {
    location = new URL(input.keyLocation);
  } catch {
    throw new Error("Invalid IndexNow keyLocation URL");
  }
  if (location.protocol !== "https:") {
    throw new Error("IndexNow keyLocation must use https");
  }

  const urls = filterIndexNowUrls(input.urls, input.host).slice(
    0,
    MAX_URLS_PER_REQUEST,
  );
  if (urls.length === 0) {
    throw new Error("IndexNow urlList is empty after filtering");
  }

  return {
    host: input.host,
    key: input.key,
    keyLocation: input.keyLocation,
    urlList: urls,
  };
}
