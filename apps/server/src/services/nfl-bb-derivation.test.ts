/**
 * Tests : dérivation des attributs BB depuis (BbRace, BbPosition).
 * Couvre :
 *  - mappings connus (stats + skills lus depuis SEASON_THREE_ROSTERS),
 *  - fallback `null` pour combinaisons non mappées,
 *  - couverture par race (chaque race a au moins ses positions canoniques).
 */

import { describe, it, expect } from "vitest";
import {
  deriveBbAttributes,
  countDerivationMappings,
} from "./nfl-bb-derivation";

describe("deriveBbAttributes", () => {
  it("dérive Skaven/Thrower depuis skaven_lanceur_skaven (S3)", () => {
    const out = deriveBbAttributes("Skaven", "Thrower");
    expect(out).not.toBeNull();
    expect(out?.sourceSlug).toBe("skaven_lanceur_skaven");
    // Source S3 : ma 7, st 3, ag 3, pa 2, av 8 (Lanceur Skaven).
    expect(out?.stats.st).toBe(3);
    expect(out?.stats.ag).toBe(3);
    expect(out?.stats.pa).toBe(2);
    expect(out?.skills).toContain("pass");
  });

  it("dérive Skaven/RatOgre (big guy)", () => {
    const out = deriveBbAttributes("Skaven", "RatOgre");
    expect(out?.sourceSlug).toBe("skaven_rat_ogre");
    expect(out?.stats.st).toBeGreaterThanOrEqual(5);
    // Rat Ogre a Sauvagerie Animale (big guy).
    expect(out?.skills.length).toBeGreaterThan(0);
  });

  it("dérive Human/Ogre depuis human_ogre (avec Solitaire 3+ post-errata)", () => {
    const out = deriveBbAttributes("Human", "Ogre");
    expect(out?.sourceSlug).toBe("human_ogre");
    expect(out?.stats.st).toBe(5);
  });

  it("dérive Dwarf/Trollslayer (Tueur de Trolls)", () => {
    const out = deriveBbAttributes("Dwarf", "Trollslayer");
    expect(out?.sourceSlug).toBe("dwarf_tueur_de_trolls");
    expect(out?.skills).toContain("frenzy");
  });

  it("dérive Necromantic/Werewolf depuis loup_garou", () => {
    const out = deriveBbAttributes("Necromantic", "Werewolf");
    expect(out?.sourceSlug).toBe("necromantic_horror_loup_garou");
    expect(out?.stats.ma).toBeGreaterThanOrEqual(7);
  });

  it("retourne null pour une combinaison non mappée (Skaven/Catcher)", () => {
    // Skaven n'a pas de "Catcher" en BB ; nflPosition WR mappe vers
    // GutterRunner. Si quelqu'un demande Skaven/Catcher : pas de mapping.
    expect(deriveBbAttributes("Skaven", "Catcher")).toBeNull();
  });

  it("retourne null pour une race + position incompatibles (Dwarf/RatOgre)", () => {
    expect(deriveBbAttributes("Dwarf", "RatOgre")).toBeNull();
  });

  it("Norse mappe Thrower/Catcher/Runner vers la Valkyrie (pas de Thrower S3 dédié)", () => {
    const t = deriveBbAttributes("Norse", "Thrower");
    const c = deriveBbAttributes("Norse", "Catcher");
    const r = deriveBbAttributes("Norse", "Runner");
    expect(t?.sourceSlug).toBe("norse_valkyrie");
    expect(c?.sourceSlug).toBe("norse_valkyrie");
    expect(r?.sourceSlug).toBe("norse_valkyrie");
  });

  it("toutes les 8 races BB ont leur Lineman/équivalent mappé", () => {
    // Linemen / postes de base par race.
    const baseByRace = {
      Skaven: "Lineman",
      WoodElf: "Lineman",
      Orc: "Lineman",
      Human: "Lineman",
      Norse: "Lineman",
      Dwarf: "Blocker",
      Khorne: "Bloodseeker",
      Necromantic: "Zombie",
    } as const;
    for (const [race, pos] of Object.entries(baseByRace)) {
      const out = deriveBbAttributes(
        race as keyof typeof baseByRace,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pos as any,
      );
      expect(out, `${race}/${pos}`).not.toBeNull();
    }
  });

  it("countDerivationMappings est cohérent avec le nombre attendu", () => {
    // 5+5+6+5+7+5+4+5 = 42 entrées au moment de l'écriture.
    expect(countDerivationMappings()).toBeGreaterThanOrEqual(40);
  });
});
