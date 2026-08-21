/**
 * Correctif fiches Star Players — le POUVOIR (règle spéciale) ne doit plus
 * apparaître dans la liste « Compétences et Traits » : il possède sa section
 * dédiée sur les fiches.
 *
 * Le retrait est fait à l'AFFICHAGE (utils `getStarPlayerSkill*`), pas dans
 * les données : le moteur de match porte le slug du pouvoir dans
 * `player.skills` (cf. `skills/star-player-rules.ts`) et ce contrat est
 * verrouillé ici aussi.
 */

import { describe, it, expect } from "vitest";
import { STAR_PLAYERS_BY_RULESET } from "./star-players";
import {
  formatStarPlayerSkills,
  getStarPlayerSkillDisplayNames,
  getStarPlayerSkillSlugs,
  parseStarPlayerSkills,
} from "./star-players-utils";
import {
  STAR_PLAYER_RULE_SLUGS,
  isStarPlayerRule,
} from "../skills/star-player-rules";
import { getSkillBySlug } from "../skills/index";

/** Porteurs de pouvoir attendus dans les DONNÉES (contrat moteur). */
const EXPECTED_CARRIERS: Record<string, Record<string, string>> = {
  season_2: {
    akhorne_the_squirrel: "blind-rage",
    anqi_panqi: "coup-sauvage",
    deeproot_strongbranch: "reliable",
    griff_oberwald: "consummate-professional",
    grim_ironjaw: "slayer",
    lord_borak: "lord-of-chaos",
    mighty_zug: "casse-os",
    morg_n_thorg: "la-baliste",
    roxanna_darknail: "pirouette",
    varag_ghoul_chewer: "crushing-blow",
  },
  season_3: {
    akhorne_the_squirrel: "blind-rage",
    anqi_panqi: "coup-sauvage",
    griff_oberwald: "consummate-professional",
    grim_ironjaw: "slayer",
    lord_borak: "lord-of-chaos",
    morg_n_thorg: "la-baliste",
    varag_ghoul_chewer: "crushing-blow",
  },
};

describe("Star Players — pouvoir exclu de la liste Compétences et Traits", () => {
  for (const [ruleset, catalogue] of Object.entries(STAR_PLAYERS_BY_RULESET)) {
    describe(`catalogue ${ruleset}`, () => {
      it("aucun slug de pouvoir dans les slugs d'affichage", () => {
        for (const sp of Object.values(catalogue)) {
          const offenders = getStarPlayerSkillSlugs(sp).filter((s) =>
            isStarPlayerRule(s),
          );
          expect(offenders, `${sp.slug}: ${offenders.join(", ")}`).toEqual([]);
        }
      });

      it("aucun nom de pouvoir dans les libellés d'affichage", () => {
        const powerNames = new Set<string>();
        for (const slug of STAR_PLAYER_RULE_SLUGS) {
          const def = getSkillBySlug(slug);
          if (def) {
            powerNames.add(def.nameFr);
            powerNames.add(def.nameEn);
          }
        }
        for (const sp of Object.values(catalogue)) {
          const offenders = getStarPlayerSkillDisplayNames(sp).filter((n) =>
            powerNames.has(n),
          );
          expect(offenders, `${sp.slug}: ${offenders.join(", ")}`).toEqual([]);
        }
      });

      it("formatStarPlayerSkills exclut aussi le pouvoir (slugs = définitions)", () => {
        for (const sp of Object.values(catalogue)) {
          const { slugs } = formatStarPlayerSkills(sp);
          expect(slugs.filter((s) => isStarPlayerRule(s))).toEqual([]);
        }
      });

      it("contrat moteur intact : le slug du pouvoir reste dans les DONNÉES", () => {
        const expected = EXPECTED_CARRIERS[ruleset] ?? {};
        for (const [spSlug, powerSlug] of Object.entries(expected)) {
          const sp = catalogue[spSlug];
          expect(sp, `fiche introuvable : ${spSlug}`).toBeDefined();
          expect(
            parseStarPlayerSkills(sp.skills),
            `${spSlug} doit garder ${powerSlug} dans ses données`,
          ).toContain(powerSlug);
        }
      });
    });
  }
});
