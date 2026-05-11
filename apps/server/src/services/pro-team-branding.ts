/**
 * Service pur — branding ProTeam.
 *
 * Helpers pour parser/serialiser le champ `meta` (Json libre, format
 * arbitraire historiquement) et appliquer un patch branding partiel
 * sans ecraser les autres entrees meta (skills inheritance, fanbase,
 * etc.).
 *
 * `meta` peut etre : objet natif (PG), string serialisee (sqlite mirror),
 * null, ou autre. Le parser est tolerant et renvoie `{}` en fallback.
 */

export interface ProTeamMeta {
  motto?: string | null;
  headline?: string | null;
  [key: string]: unknown;
}

export function parseProTeamMeta(raw: unknown): ProTeamMeta {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as ProTeamMeta;
      }
      return {};
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as ProTeamMeta;
  }
  return {};
}

export interface BrandingPatch {
  motto?: string | null;
  headline?: string | null;
}

/** Applique un patch motto/headline sans ecraser les autres entrees meta.
 *  Une valeur `null` efface explicitement la cle. Une valeur `undefined`
 *  ou non fournie laisse l'existant tel quel. */
export function applyBrandingMeta(
  current: unknown,
  patch: BrandingPatch,
): ProTeamMeta {
  const merged: ProTeamMeta = { ...parseProTeamMeta(current) };

  if ("motto" in patch) {
    if (patch.motto === null) {
      delete merged.motto;
    } else if (patch.motto !== undefined) {
      merged.motto = patch.motto;
    }
  }

  if ("headline" in patch) {
    if (patch.headline === null) {
      delete merged.headline;
    } else if (patch.headline !== undefined) {
      merged.headline = patch.headline;
    }
  }

  return merged;
}
