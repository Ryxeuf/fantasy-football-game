import { describe, it, expect } from "vitest";
import { TEAM_ROSTERS_BY_RULESET, RULESETS } from "./positions";
import { TEAM_SPECIAL_RULES_BY_SLUG } from "./team-special-rules";

/**
 * Non-régression : assignation des règles spéciales d'équipe aux rosters.
 *
 * Source de vérité du contenu : docs/roster-bb-2025/*.md (ligne "Règles
 * spéciales :"). Ces tests figent le mapping pour éviter typos / régressions,
 * et garantissent que toute valeur `specialRules` renseignée ne contient que
 * des slugs connus du catalogue (sinon ils seraient silencieusement ignorés à
 * l'affichage et au calcul des PSP).
 */

/** Sentinelle historique tolérée (= aucune règle), ignorée à la résolution. */
const SENTINELS = new Set(["none", "neant", "aucune"]);

function parseSlugs(raw: string): string[] {
  return raw
    .split(/[,\s]+/g)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

describe("Assignation des règles spéciales d'équipe", () => {
  it("toute valeur specialRules ne référence que des slugs connus", () => {
    for (const ruleset of RULESETS) {
      const map = TEAM_ROSTERS_BY_RULESET[ruleset];
      for (const [slug, roster] of Object.entries(map)) {
        if (!roster.specialRules) continue;
        for (const token of parseSlugs(roster.specialRules)) {
          if (SENTINELS.has(token)) continue;
          expect(
            TEAM_SPECIAL_RULES_BY_SLUG[token],
            `${ruleset}/${slug}: slug de règle spéciale inconnu "${token}"`,
          ).toBeTruthy();
        }
      }
    }
  });

  it("les équipes 'Bagarreurs Brutaux' portent bien la règle (impact PSP)", () => {
    // Équipes attendues avec bagarreurs_brutaux (source docs BB2025 saison 3).
    const expected = ["khorne", "nurgle", "ogre", "black_orc", "orc", "dwarf"];
    const map = TEAM_ROSTERS_BY_RULESET.season_3;
    for (const slug of expected) {
      const roster = map[slug];
      expect(roster, `roster season_3 manquant: ${slug}`).toBeTruthy();
      expect(
        parseSlugs(roster.specialRules ?? ""),
        `${slug} devrait avoir bagarreurs_brutaux`,
      ).toContain("bagarreurs_brutaux");
    }
  });

  it("snotling cumule chantage, vil prix et déferlement", () => {
    const snotling = TEAM_ROSTERS_BY_RULESET.season_3.snotling;
    expect(parseSlugs(snotling.specialRules ?? "")).toEqual(
      expect.arrayContaining([
        "chantage_et_corruption",
        "trois_quarts_a_vil_prix",
        "deferlement",
      ]),
    );
  });

  it("une équipe sans règle (ex: skaven) n'a pas de specialRules actif", () => {
    const skaven = TEAM_ROSTERS_BY_RULESET.season_3.skaven;
    const tokens = parseSlugs(skaven.specialRules ?? "").filter(
      (t) => !SENTINELS.has(t),
    );
    expect(tokens).toEqual([]);
  });
});
