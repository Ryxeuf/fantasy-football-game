/**
 * Sprint R — Lot R.D.3 : NAF (Naffinity Federation) integration.
 *
 * Permet aux coaches d'afficher leurs resultats de tournois Blood Bowl
 * IRL sur leur profil Nuffle Arena. Opt-in via `User.nafName` : le user
 * renseigne son identifiant NAF (case-sensitive), le service fetch les
 * stats via API NAF et les expose sur `/coach/:slug/naf-stats`.
 *
 * NAF API
 * -------
 * Le site officiel www.thenaf.net expose des endpoints de recherche
 * tournois et joueurs en HTML (pas REST natif). Pour l'instant, ce
 * service implemente un **fetcher abstrait** (`fetchNafStatsFn`) qui
 * peut etre mocke en test et plug a un parser HTML reel quand le
 * besoin produit est confirme.
 *
 * Strategie cache
 * ---------------
 * Pas de cache DB pour le MVP. Fetch direct avec timeout 5s. Si NAF
 * indisponible → retourne `null`. Le caller peut afficher "stats
 * indisponibles" sans bloquer la page profil.
 *
 * Feature flag
 * ------------
 * La route publique consulte `isEnabled("naf_integration")`. Si OFF,
 * retourne 404 (cf. route `coach.ts`). Permet de hide la feature
 * tant que NAF API n'est pas branche.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

const NAF_API_BASE =
  process.env.NAF_API_URL ?? "https://www.thenaf.net/index.php";
const FETCH_TIMEOUT_MS = 5_000;

export interface NafTournamentResult {
  /** Date du tournoi (ISO YYYY-MM-DD). */
  readonly date: string;
  readonly name: string;
  /** Nombre de matches joues. */
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  /** Position finale (rank 1-N). null si stat manquante. */
  readonly position: number | null;
}

export interface NafCoachStats {
  readonly nafName: string;
  readonly tournaments: readonly NafTournamentResult[];
  readonly totalMatches: number;
  readonly totalWins: number;
  /** Date de la derniere fetch reussie. */
  readonly fetchedAt: string;
}

/**
 * Type de la fonction fetch NAF, injectable pour tests. Retourne null
 * en cas d'erreur reseau / parser. Le caller decide d'afficher un
 * fallback.
 */
export type FetchNafStatsFn = (
  nafName: string,
  signal: AbortSignal,
) => Promise<NafCoachStats | null>;

/**
 * Default fetcher : appelle l'endpoint NAF + parse la response.
 *
 * Implementation MVP : on tente un GET sur l'URL search NAF avec un
 * timeout 5s. Le parsing reel du HTML n'est pas implemente ici
 * (necessite un parser HTML cote serveur). Pour l'instant on retourne
 * null si la response n'est pas un JSON deja structure.
 *
 * Quand NAF expose une vraie API REST (ou un cron node parser), il
 * suffira d'enrichir ce fetcher.
 */
export const defaultFetchNafStats: FetchNafStatsFn = async (nafName, signal) => {
  try {
    const url = new URL(NAF_API_BASE);
    url.searchParams.set("module", "NAF");
    url.searchParams.set("type", "search");
    url.searchParams.set("func", "coaches");
    url.searchParams.set("name", nafName);
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      // Le site NAF retourne du HTML. Sans parser, on ne peut pas
      // extraire. Return null pour ne pas crash le profil.
      return null;
    }
    const data = (await res.json()) as unknown;
    if (typeof data !== "object" || data === null) return null;
    return null; // TODO: parser quand format NAF API confirme
  } catch (e: unknown) {
    if ((e as { name?: string })?.name === "AbortError") return null;
    const msg = e instanceof Error ? e.message : "unknown";
    serverLog.warn(`[naf-sync] fetch failed for nafName=${nafName}: ${msg}`);
    return null;
  }
};

/**
 * Fetch les stats NAF d'un user opt-in. Retourne null si :
 *   - User inexistant
 *   - User n'a pas opt-in (nafName = null)
 *   - NAF API indisponible / format invalide
 */
export async function getNafStatsForUser(
  userId: string,
  fetcher: FetchNafStatsFn = defaultFetchNafStats,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<NafCoachStats | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { nafName: true },
  });
  if (!user || !user.nafName) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(user.nafName as string, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Valide qu'un nafName est syntaxiquement plausible avant persistance.
 * Le NAF accepte des noms latins, chiffres, espaces et quelques chars.
 * On reste large : 2-64 chars, characters printables ASCII + lettres
 * accentuees.
 */
export function isValidNafName(name: string): boolean {
  if (name.length < 2 || name.length > 64) return false;
  // Reject ASCII control chars (codes 0-31 + 127). Otherwise tout passe.
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    if (code < 32 || code === 127) return false;
  }
  return true;
}
