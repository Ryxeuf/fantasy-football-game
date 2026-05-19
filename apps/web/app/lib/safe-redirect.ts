/**
 * Audit round 11 (HIGH/open-redirect) — helper partage pour valider
 * la cible d'un `?redirect=` parametre.
 *
 * N'autorise que les chemins internes commencant par `/` qui ne
 * peuvent pas etre interpretes comme des URLs externes ou des
 * protocol-relative URLs. Tout autre input retombe sur le fallback.
 *
 * Avant ce helper, `/auth/sync` et `/admin/sync` redirigeaient
 * inconditionnellement vers `searchParams.get("redirect")`, ce qui
 * permettait a un attaquant de forger
 * `https://app.com/auth/sync?redirect=https://evil.com` et de
 * recuperer la victime apres login sur un domaine arbitraire.
 */
export function sanitizeRedirect(
  raw: string | null,
  fallback: string,
): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (raw.startsWith("/\\")) return fallback;
  return raw;
}
