/**
 * SCRIPT DE CONTRÔLE — 50 Star Players « Legends 2025 ».
 *
 * Compare champ à champ le catalogue Saison 3 (`STAR_PLAYERS_BY_RULESET`) à la
 * référence figée du PDF gratuit GW « Blood Bowl — Star Players! (Legends) »
 * (2025), dépouillé carte par carte. Attendu : 0 écart.
 *
 * Il ne s'agit pas d'un test de comportement mais d'un ratchet de données :
 * toute dérive future d'un coût, d'une caractéristique, d'une compétence,
 * d'une ligue ou d'une règle spéciale échoue ici, avec le nom de la fiche et
 * la page du PDF.
 *
 * Deux conventions du repo sont vérifiées telles quelles (elles ne sont pas
 * des écarts) :
 *  - PAIRES : la carte donne un prix POUR LA PAIRE ; le catalogue le porte sur
 *    le primaire (`cost`) et met le partenaire à `cost: 0`, la valeur de la
 *    carte étant portée par `pairCost` sur LES DEUX fiches (cf. lot G).
 *  - RÈGLE SPÉCIALE : stockée « Nom : texte » en FR, « Nom: texte » en EN.
 *
 * La contrepartie côté BASE DE DONNÉES est le dry-run de
 * `apps/server/src/scripts/sync-star-players.ts`, qui doit afficher
 * « 0 écart » après application.
 */

import { describe, it, expect } from "vitest";
import { STAR_PLAYERS_BY_RULESET } from "./star-players";
import reference from "./star-players-legends-2025.reference.json";

/**
 * Slugs historiques : le site (et la base) portent un slug plus long pour deux
 * fiches. On ne renomme rien — ce serait un changement d'URL — donc la
 * référence garde le slug public et le contrôle passe par cette table.
 */
const SLUG_ALIASES: Record<string, string> = {
  gretchen_wachter_the_blood_bowl_widow: "gretchen_wachter",
  grombrindal_the_white_dwarf: "grombrindal",
};

/** Nom de ligue de la carte -> règle régionale du catalogue. */
const LEAGUE_TO_RULE: Record<string, string> = {
  "Any Team": "all",
  "Badlands Brawl": "badlands_brawl",
  "Chaos Clash": "chaos_clash",
  "Elven Kingdoms League": "elven_kingdoms_league",
  "Favoured of Hashut": "favoured_of_hashut",
  "Favoured of Khorne": "favoured_of_khorne",
  "Favoured of Nurgle": "favoured_of_nurgle",
  "Halfling Thimble Cup": "halfling_thimble_cup",
  "Lustrian Superleague": "lustrian_superleague",
  "Old World Classic": "old_world_classic",
  "Sylvanian Spotlight": "sylvanian_spotlight",
  "Underworld Challenge": "underworld_challenge",
  "Woodland League": "woodland_league",
  "Worlds Edge Superleague": "worlds_edge_superleague",
};

/** « 3+ » -> 3, « - » -> null (le joueur ne peut pas passer). */
function targetValue(raw: string | number): number | null {
  if (raw === "-" || raw === null || raw === undefined) return null;
  return parseInt(String(raw), 10);
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

const CATALOGUE = STAR_PLAYERS_BY_RULESET.season_3;

describe("Star Players « Legends 2025 » — conformité au PDF GW", () => {
  it("la référence couvre bien les 50 cartes du PDF", () => {
    expect(reference.star_players).toHaveLength(50);
    expect(reference.count).toBe(50);
  });

  for (const card of reference.star_players) {
    const slug = SLUG_ALIASES[card.site_slug] ?? card.site_slug;
    const label = `${card.name} (p.${card.source_page})`;

    describe(label, () => {
      const player = CATALOGUE[slug];

      it("existe dans le catalogue Saison 3", () => {
        expect(player, `slug introuvable : ${slug}`).toBeDefined();
      });

      it("coût conforme à la carte", () => {
        // Paire : la carte donne le prix des deux, porté par `pairCost`.
        const actual = player.pairCost ?? player.cost;
        expect(actual).toBe(card.cost);
      });

      it("MA/ST/AG/PA/AV conformes à la carte", () => {
        expect({
          MA: player.ma,
          ST: player.st,
          AG: player.ag,
          PA: player.pa ?? null,
          AV: player.av,
        }).toEqual({
          MA: targetValue(card.stats.MA),
          ST: targetValue(card.stats.ST),
          AG: targetValue(card.stats.AG),
          PA: targetValue(card.stats.PA),
          AV: targetValue(card.stats.AV),
        });
      });

      it("compétences conformes à la carte (par slug)", () => {
        const actual = sortedUnique(
          player.skills
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        );
        expect(actual).toEqual(sortedUnique(card.skill_slugs as string[]));
      });

      it("ligues conformes à la carte", () => {
        const expected = sortedUnique(
          card.plays_for.map((league) => {
            const rule = LEAGUE_TO_RULE[league];
            expect(rule, `ligue inconnue : ${league}`).toBeDefined();
            return rule;
          }),
        );
        expect(sortedUnique(player.hirableBy)).toEqual(expected);
      });

      it("règle spéciale conforme à la carte (FR et EN)", () => {
        expect(player.specialRule).toBe(
          `${card.special_rule.name_fr} : ${card.special_rule.text_fr}`,
        );
        expect(player.specialRuleEn).toBe(
          `${card.special_rule.name}: ${card.special_rule.text}`,
        );
      });
    });
  }

  it("aucune compétence orpheline : tous les slugs référencés existent", async () => {
    const { SKILLS_DEFINITIONS } = await import("../skills/index");
    const known = new Set(SKILLS_DEFINITIONS.map((s) => s.slug));
    const missing: string[] = [];
    for (const card of reference.star_players) {
      for (const skillSlug of card.skill_slugs as string[]) {
        if (!known.has(skillSlug)) missing.push(skillSlug);
      }
    }
    expect(missing).toEqual([]);
  });

  it("les Star Players du livre de règles restent hors périmètre", () => {
    // Le PDF Legends ne les contient pas : ils ne doivent pas bouger.
    // 18 et non 19 : Josef Bugman n'est PAS une fiche du catalogue, il est
    // modélisé comme coup de pouce « Staff Célèbre » (cf. core/inducements.ts)
    // — la règle du livre interdit d'ailleurs de l'engager aussi en Star
    // Player. Une éventuelle ligne en base pour lui est hors périmètre : le
    // sync ne supprime jamais de fiche.
    const legendSlugs = new Set(
      reference.star_players.map((c) => SLUG_ALIASES[c.site_slug] ?? c.site_slug),
    );
    const rulebook = Object.keys(CATALOGUE).filter((s) => !legendSlugs.has(s));
    expect(rulebook).toHaveLength(18);
    expect(rulebook).toContain("griff_oberwald");
    expect(rulebook).toContain("morg_n_thorg");
  });
});
