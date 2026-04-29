/**
 * Coach slug derivation (S26.3 — Profil coach sharable).
 *
 * Derives a stable, URL-safe slug from a free-form coach name.
 * Used to build public profile URLs `/coach/:slug` and to look up
 * users from a slug at the API layer.
 *
 * Stable means: pure (no I/O), deterministic, idempotent on its own
 * output. Two coaches with identical normalised names produce the
 * same slug — disambiguation (collision suffix) is the caller's
 * responsibility.
 */

/**
 * Manual replacements for ligatures that do not decompose under NFD
 * (e.g. `œ` -> `oe`, `æ` -> `ae`). Run before NFD normalisation so
 * the resulting ASCII letters survive the strip step.
 */
const LIGATURE_MAP: ReadonlyArray<readonly [RegExp, string]> = [
  [/œ/g, "oe"],
  [/Œ/g, "OE"],
  [/æ/g, "ae"],
  [/Æ/g, "AE"],
  [/ß/g, "ss"],
];

export function coachSlugFrom(name: string): string {
  let s = name;
  for (const [from, to] of LIGATURE_MAP) {
    s = s.replace(from, to);
  }
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks (accents)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // non-alnum runs -> single dash
    .replace(/^-+|-+$/g, ""); // trim leading/trailing dashes
}
