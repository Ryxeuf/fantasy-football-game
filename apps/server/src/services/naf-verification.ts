/**
 * Vérification d'un numéro NAF auprès de l'annuaire public
 * (`member.thenaf.net`, fiche coach). Décision du propriétaire : la
 * vérification est AUTOMATIQUE à l'enregistrement du numéro.
 *
 * - Seul le numéro part vers la NAF (aucune autre donnée du coach), avec un
 *   User-Agent générique.
 * - Timeout court (5 s) : un annuaire lent ne bloque pas le profil, le
 *   numéro est alors enregistré « en attente de vérification ».
 * - La fiche doit porter EXACTEMENT le numéro demandé : une redirection vers
 *   un autre coach ne vaut pas vérification.
 *
 * Le `fetcher` est injectable : les tests n'appellent jamais le réseau.
 */

import { parseNafCoachPage } from "./naf-coach-page";

export const DEFAULT_NAF_MEMBER_URL = "https://member.thenaf.net/index.php";
export const NAF_FETCH_TIMEOUT_MS = 5_000;
const USER_AGENT = "NuffleArena";

/** Sous-ensemble de `fetch` dont on a besoin (injectable en test). */
export type NafFetcher = (
  url: string,
  init: { readonly signal: AbortSignal; readonly headers: Record<string, string> },
) => Promise<{ readonly ok: boolean; readonly status: number; text(): Promise<string> }>;

export type NafVerification =
  | {
      readonly status: "verified";
      readonly nafNumber: number;
      readonly nafName: string;
      readonly nation?: string;
    }
  | { readonly status: "not_found" }
  | {
      /** Annuaire injoignable, lent ou illisible : rien n'est tranché. */
      readonly status: "unavailable";
      readonly reason: "network" | "http" | "unparseable" | "number_mismatch";
    };

/** Numéro NAF : 1 à 7 chiffres (le format de l'annuaire). */
export function isValidNafNumber(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 9_999_999;
}

/** URL de base, surchargeable par `NAF_MEMBER_URL` (lue à l'appel). */
export function nafMemberBaseUrl(): string {
  const fromEnv = process.env.NAF_MEMBER_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_NAF_MEMBER_URL;
}

/** Fiche coach publique d'un numéro (aussi servie au web pour le lien). */
export function nafCoachPageUrl(nafNumber: number, base = nafMemberBaseUrl()): string {
  const url = new URL(base);
  url.searchParams.set("module", "NAF");
  url.searchParams.set("type", "coachpage");
  url.searchParams.set("coach", String(nafNumber));
  return url.toString();
}

const defaultFetcher: NafFetcher = (url, init) => fetch(url, init);

export async function verifyNafNumber(
  nafNumber: number,
  fetcher: NafFetcher = defaultFetcher,
  options: { readonly timeoutMs?: number; readonly baseUrl?: string } = {},
): Promise<NafVerification> {
  if (!isValidNafNumber(nafNumber)) return { status: "not_found" };

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? NAF_FETCH_TIMEOUT_MS,
  );
  let html: string;
  try {
    const res = await fetcher(nafCoachPageUrl(nafNumber, options.baseUrl), {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    });
    if (!res.ok) return { status: "unavailable", reason: "http" };
    html = await res.text();
  } catch {
    return { status: "unavailable", reason: "network" };
  } finally {
    clearTimeout(timer);
  }

  const page = parseNafCoachPage(html);
  if (page.status === "not_found") return { status: "not_found" };
  if (page.status === "unparseable") {
    return { status: "unavailable", reason: "unparseable" };
  }
  if (page.nafNumber !== nafNumber) {
    return { status: "unavailable", reason: "number_mismatch" };
  }
  return {
    status: "verified",
    nafNumber: page.nafNumber,
    nafName: page.nafName,
    ...(page.nation ? { nation: page.nation } : {}),
  };
}
