/**
 * Règles régionales DÉCLARÉES par un roster.
 *
 * `Roster.regionalRules` (colonne texte, éditable depuis la console admin)
 * est la source de vérité des Ligues d'un roster : c'est elle que servent la
 * fiche publique `/teams/[slug]` et la console admin. Quand elle est vide, on
 * retombe sur le catalogue du moteur (`getRegionalRulesForTeam`) — le seed
 * n'écrit la colonne que pour les définitions qui la portent.
 *
 * Ce module centralise cette résolution pour que TOUS les consommateurs
 * partent de la même liste. Sans ça, la fiche du roster et le choix de Ligue
 * proposé à la création divergent dès qu'un admin édite la colonne (bug
 * observé sur les Halflings : la fiche affiche 2 Ligues, la création en
 * proposait 3).
 *
 * 100 % pur (pas de Prisma) : les appelants qui n'ont que le slug du roster
 * passent par `getRosterFromDb` (`utils/roster-helpers`), qui expose la liste
 * résolue dans `RosterPayload.regionalRules`.
 */

import { getRegionalRulesForTeam, type Ruleset } from "@bb/game-engine";

/**
 * Parse tolérant d'un champ "liste de slugs" stocké en base : tableau natif
 * (PG), chaîne JSON sérialisée (sqlite mirror), CSV libre, ou null/undefined.
 * Sert pour `Roster.specialRules` (souvent null ou texte libre tel que "NONE")
 * et `Roster.regionalRules` (JSON array de slugs de ligues régionales).
 */
export function parseSlugList(raw: unknown): string[] {
  const fromArray = (arr: unknown[]): string[] =>
    arr
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim());
  if (Array.isArray(raw)) return fromArray(raw);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return fromArray(parsed);
      if (typeof parsed === "string" && parsed.trim().length > 0) {
        return [parsed.trim()];
      }
    } catch {
      // Pas du JSON : on retombe sur un split CSV.
    }
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
}

/**
 * Ligues regionales EFFECTIVES d'un roster, telles que le reste de l'app les
 * applique : la valeur en base quand elle est renseignee, sinon le defaut du
 * catalogue game-engine pour ce couple roster/ruleset.
 *
 * Sans ce repli, l'admin affichait des cases vides pour la quasi-totalite
 * des rosters : le seed n'ecrit `Roster.regionalRules` que pour les
 * definitions qui le portent (1 seul roster en season_3), toutes les autres
 * restant NULL alors que les pages publiques affichent bien des ligues.
 *
 * `source` dit d'ou vient la liste, pour que l'admin puisse signaler qu'un
 * enregistrement va materialiser le defaut en base.
 */
export function effectiveRegionalRules(
  raw: unknown,
  rosterSlug: string,
  ruleset: string,
): { rules: string[]; source: "db" | "roster-defaults" } {
  const fromDb = parseSlugList(raw);
  if (fromDb.length > 0) return { rules: fromDb, source: "db" };
  return {
    rules: getRegionalRulesForTeam(rosterSlug, ruleset as Ruleset),
    source: "roster-defaults",
  };
}
