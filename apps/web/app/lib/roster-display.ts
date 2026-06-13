/**
 * Helpers d'affichage pour les rosters partagés.
 *
 * Les équipes utilisateur ne stockent que le slug de race (ex.
 * "imperial_nobility") et les Star Players que leur slug
 * ("griff_oberwald"). Faute de nom localisé dans le payload public, on
 * prettifie le slug en Title Case — suffisant pour l'affichage et l'OG.
 */

export function prettifySlug(slug: string): string {
  if (!slug) return "";
  return slug
    .split(/[_-]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Parse tolérant d'un champ `skills` (array natif, JSON string, ou null). */
export function parseSkillList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}
