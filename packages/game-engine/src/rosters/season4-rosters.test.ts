/**
 * S27.5 — Tests pour le skeleton Saison 4 BB3.
 *
 * Verifie :
 *  - le ruleset `season_4` est exporte et selectionnable,
 *  - `SEASON_FOUR_ROSTERS` est vide tant que GW n'a pas publie les
 *    rosters officiels (regression test : si quelqu'un ajoute un
 *    roster S4, ce test echouera et il faudra documenter le contenu),
 *  - `STAR_PLAYERS_BY_RULESET.season_4` clone S3 sans partager de
 *    reference (modifier S4 ne doit pas affecter S3 ni S2).
 */

import { describe, it, expect } from "vitest";
import {
  RULESETS,
  TEAM_ROSTERS_BY_RULESET,
  type Ruleset,
} from "./positions";
import { SEASON_FOUR_ROSTERS } from "./season4-rosters";
import { STAR_PLAYERS_BY_RULESET } from "./star-players";

describe("S27.5 — skeleton Saison 4 BB3", () => {
  it("le ruleset 'season_4' est expose dans la liste RULESETS", () => {
    expect(RULESETS).toContain("season_4");
  });

  it("le type Ruleset accepte 'season_4'", () => {
    const r: Ruleset = "season_4";
    expect(r).toBe("season_4");
  });

  it("SEASON_FOUR_ROSTERS est vide en attendant les rosters officiels", () => {
    expect(Object.keys(SEASON_FOUR_ROSTERS)).toHaveLength(0);
  });

  it("TEAM_ROSTERS_BY_RULESET expose une entree season_4 pointant sur SEASON_FOUR_ROSTERS", () => {
    expect(TEAM_ROSTERS_BY_RULESET.season_4).toBe(SEASON_FOUR_ROSTERS);
  });

  it("STAR_PLAYERS_BY_RULESET expose une entree season_4 non vide (clone de S3)", () => {
    const s4 = STAR_PLAYERS_BY_RULESET.season_4;
    const s3 = STAR_PLAYERS_BY_RULESET.season_3;
    expect(Object.keys(s4).length).toBeGreaterThan(0);
    expect(Object.keys(s4).length).toBe(Object.keys(s3).length);
  });

  it("les Star Players S4 sont des clones profonds de S3 (pas de reference partagee)", () => {
    const s4 = STAR_PLAYERS_BY_RULESET.season_4;
    const s3 = STAR_PLAYERS_BY_RULESET.season_3;
    // Pour chaque slug, les objets star players doivent avoir la meme
    // valeur, mais ne pas etre la meme reference (le clone protege
    // contre une mutation involontaire des saisons existantes).
    for (const slug of Object.keys(s4)) {
      expect(s4[slug]).toEqual(s3[slug]);
      expect(s4[slug]).not.toBe(s3[slug]);
      expect(s4[slug].hirableBy).not.toBe(s3[slug].hirableBy);
    }
  });

  it("muter un Star Player S4 ne propage pas a S3 ni S2", () => {
    const s4 = STAR_PLAYERS_BY_RULESET.season_4;
    const s3 = STAR_PLAYERS_BY_RULESET.season_3;
    const s2 = STAR_PLAYERS_BY_RULESET.season_2;

    const slug = Object.keys(s4)[0];
    expect(slug).toBeDefined();

    const originalS3Cost = s3[slug].cost;
    const originalS2Cost = s2[slug]?.cost;

    s4[slug].cost = 999_999;

    expect(s3[slug].cost).toBe(originalS3Cost);
    if (originalS2Cost !== undefined) {
      expect(s2[slug].cost).toBe(originalS2Cost);
    }
  });
});
