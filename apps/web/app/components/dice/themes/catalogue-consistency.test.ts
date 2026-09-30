/**
 * Le catalogue des thèmes de dés vit à trois endroits qui doivent rester
 * cohérents :
 *  1. `apps/server/src/services/dice-theme-catalogue.ts` — ids + prix, fait
 *     foi pour la possession et la sélection ;
 *  2. `themes/catalogue.ts` — miroir web (ids + prix + libellés) ;
 *  3. `themes/registry.ts` — le RENDU de chaque thème.
 *
 * Un thème vendu sans rendu retomberait silencieusement sur le défaut ; un
 * rendu hors catalogue ne serait jamais proposé.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DICE_THEME_ID as SERVER_DEFAULT,
  DICE_THEME_CATALOGUE as SERVER_CATALOGUE,
} from "../../../../../server/src/services/dice-theme-catalogue";
import { DEFAULT_DICE_THEME_ID, DICE_THEME_CATALOGUE } from "./catalogue";
import { DICE_THEME_RENDERERS, getDiceThemeRenderer } from "./registry";

describe("catalogue des thèmes de dés", () => {
  it("même thème par défaut que le serveur", () => {
    expect(DEFAULT_DICE_THEME_ID).toBe(SERVER_DEFAULT);
  });

  it("mêmes ids et mêmes prix que le serveur", () => {
    const web = DICE_THEME_CATALOGUE.map((t) => ({ id: t.id, priceCrowns: t.priceCrowns }));
    const server = SERVER_CATALOGUE.map((t) => ({ id: t.id, priceCrowns: t.priceCrowns }));
    expect(web).toEqual(server);
  });

  it("chaque thème du catalogue a un rendu, et réciproquement", () => {
    const catalogueIds = DICE_THEME_CATALOGUE.map((t) => t.id).sort();
    expect(Object.keys(DICE_THEME_RENDERERS).sort()).toEqual(catalogueIds);
    for (const id of catalogueIds) {
      expect(DICE_THEME_RENDERERS[id].id).toBe(id);
    }
  });

  it("chaque thème a un nom et une description FR/EN", () => {
    for (const t of DICE_THEME_CATALOGUE) {
      expect(t.name.fr && t.name.en && t.description.fr && t.description.en).toBeTruthy();
    }
  });

  it("id inconnu ou absent => rendu par défaut", () => {
    expect(getDiceThemeRenderer("ghost").id).toBe(DEFAULT_DICE_THEME_ID);
    expect(getDiceThemeRenderer(null).id).toBe(DEFAULT_DICE_THEME_ID);
    expect(getDiceThemeRenderer(undefined).id).toBe(DEFAULT_DICE_THEME_ID);
  });
});
