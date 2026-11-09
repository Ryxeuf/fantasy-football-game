/**
 * Compétences acquises par TIRAGE AU HASARD — lecture pure de
 * `TeamPlayer.advancements` (JSON de `PlayerAdvancement[]`).
 *
 * Une amélioration est « tirée » si elle porte `isRandom: true` ou si son
 * type commence par `random` (`random-primary` en Saison 3, `random-secondary`
 * hérité de la Saison 2). Seules les améliorations qui portent un `skillSlug`
 * comptent : une caractéristique (jet de D8) n'est pas une compétence.
 *
 * Parser tolérant (cf. CLAUDE.md) : la colonne arrive en chaîne JSON (miroir
 * SQLite, `GET /team/:id`), en tableau natif, `null` ou `undefined`. Une
 * donnée illisible rend une liste vide — l'affichage retombe alors sur la
 * simple distinction base / acquise.
 */

function toArray(raw: unknown): readonly unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isRandomAdvancement(entry: Record<string, unknown>): boolean {
  if (entry.isRandom === true) return true;
  return typeof entry.type === "string" && entry.type.startsWith("random");
}

/** Slugs (sans doublon, ordre de la carrière) des compétences tirées au hasard. */
export function randomSkillSlugs(advancementsRaw: unknown): readonly string[] {
  const out: string[] = [];
  for (const entry of toArray(advancementsRaw)) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const slug = record.skillSlug;
    if (typeof slug !== "string" || slug.trim() === "") continue;
    if (!isRandomAdvancement(record)) continue;
    if (!out.includes(slug)) out.push(slug);
  }
  return out;
}
