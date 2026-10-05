/**
 * Le catalogue des thèmes de dés vit à deux endroits qui doivent rester
 * cohérents :
 *  1. `apps/server/src/services/dice-theme-catalogue.ts` — ids, prix,
 *     libellés : fait foi pour la possession, l'achat et la sélection (la
 *     table `DiceTheme` le surcharge, mais n'ajoute jamais d'id) ;
 *  2. `@bb/ui/dice` (`DICE_SKINS`) → `themes/registry.ts` — le RENDU de
 *     chaque thème (faces PNG + palette des dés numériques).
 *
 * Un thème vendu sans rendu retomberait silencieusement sur le défaut ; un
 * rendu hors catalogue ne serait jamais proposé.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DICE_THEME_ID as SERVER_DEFAULT,
  DICE_THEME_CATALOGUE as SERVER_CATALOGUE,
  DICE_THEME_TX_REF_PREFIX as SERVER_TX_REF_PREFIX,
} from "../../../../../server/src/services/dice-theme-catalogue";
import { DICE_THEME_TX_REF_PREFIX } from "../../../lib/crowns";
import { DEFAULT_DICE_THEME_ID, DICE_THEME_RENDERERS, getDiceThemeRenderer } from "./registry";

describe("catalogue des thèmes de dés", () => {
  it("même thème par défaut que le serveur", () => {
    expect(DEFAULT_DICE_THEME_ID).toBe(SERVER_DEFAULT);
  });

  it("chaque thème du catalogue serveur a un rendu, et réciproquement", () => {
    const catalogueIds = SERVER_CATALOGUE.map((t) => t.id).sort();
    expect(Object.keys(DICE_THEME_RENDERERS).sort()).toEqual(catalogueIds);
    for (const id of catalogueIds) {
      expect(DICE_THEME_RENDERERS[id].id).toBe(id);
    }
  });

  it("36 thèmes : le dé original, 4 déclinaisons, 31 équipes", () => {
    expect(SERVER_CATALOGUE).toHaveLength(36);
    expect(SERVER_CATALOGUE.filter((t) => t.collection === "classic")).toHaveLength(5);
    expect(SERVER_CATALOGUE.filter((t) => t.collection === "team")).toHaveLength(31);
  });

  it("id inconnu ou absent => rendu par défaut", () => {
    expect(getDiceThemeRenderer("ghost").id).toBe(DEFAULT_DICE_THEME_ID);
    expect(getDiceThemeRenderer(null).id).toBe(DEFAULT_DICE_THEME_ID);
    expect(getDiceThemeRenderer(undefined).id).toBe(DEFAULT_DICE_THEME_ID);
  });

  it("même préfixe de référence d'achat que le serveur (historique des Crowns)", () => {
    expect(DICE_THEME_TX_REF_PREFIX).toBe(SERVER_TX_REF_PREFIX);
  });
});
