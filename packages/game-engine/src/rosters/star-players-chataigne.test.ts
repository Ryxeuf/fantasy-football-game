/**
 * Correctif fiches Star Players — « Châtaigne » sans modificateur.
 *
 * Les cartes 2025 donnent la compétence « Châtaigne » (sans (+1)/(+2)) aux
 * star players. Le repo affichait « Coup Puissant (+1) » / « Coup Puissant
 * (+2) » (fiches résumées, et parfois détaillées via le seed). Ce test
 * verrouille :
 *  - le libellé FR du slug `mighty-blow-1` (« Châtaigne », sans modificateur) ;
 *  - l'absence de variante `mighty-blow-2` (et de l'ancien `mighty-blow`)
 *    sur toutes les fiches star players ;
 *  - l'absence de « Coup Puissant » dans les libellés affichés et les règles
 *    spéciales FR.
 */

import { describe, it, expect } from "vitest";
import { STAR_PLAYERS_BY_RULESET } from "./star-players";
import {
  getStarPlayerSkillDisplayNames,
  parseStarPlayerSkills,
} from "./star-players-utils";
import { getSkillBySlug } from "../skills/index";

describe("Star Players — Châtaigne sans modificateur", () => {
  it("le slug mighty-blow-1 s'affiche « Châtaigne » en FR", () => {
    expect(getSkillBySlug("mighty-blow-1")?.nameFr).toBe("Châtaigne");
  });

  for (const [ruleset, catalogue] of Object.entries(STAR_PLAYERS_BY_RULESET)) {
    describe(`catalogue ${ruleset}`, () => {
      it("aucune fiche ne porte mighty-blow-2 ni l'ancien mighty-blow", () => {
        const offenders = Object.values(catalogue)
          .filter((sp) => {
            const slugs = parseStarPlayerSkills(sp.skills);
            return slugs.includes("mighty-blow-2") || slugs.includes("mighty-blow");
          })
          .map((sp) => sp.slug);
        expect(offenders).toEqual([]);
      });

      it("aucun libellé de compétence affiché ne contient « Coup Puissant » ni « Châtaigne (+N) »", () => {
        for (const sp of Object.values(catalogue)) {
          const names = getStarPlayerSkillDisplayNames(sp);
          const offenders = names.filter(
            (n) => /coup puissant/i.test(n) || /châtaigne\s*\(\+/i.test(n),
          );
          expect(offenders, `${sp.slug}: ${offenders.join(", ")}`).toEqual([]);
        }
      });

      it("aucune règle spéciale FR ne mentionne « Coup Puissant »", () => {
        const offenders = Object.values(catalogue)
          .filter((sp) => /coup puissant/i.test(sp.specialRule ?? ""))
          .map((sp) => sp.slug);
        expect(offenders).toEqual([]);
      });
    });
  }

  it("Morg 'n' Thorg porte Châtaigne (mighty-blow-1) dans les deux catalogues", () => {
    for (const catalogue of Object.values(STAR_PLAYERS_BY_RULESET)) {
      const morg = catalogue["morg_n_thorg"];
      expect(morg).toBeDefined();
      expect(parseStarPlayerSkills(morg.skills)).toContain("mighty-blow-1");
    }
  });
});
