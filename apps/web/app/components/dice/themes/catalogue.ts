/**
 * Catalogue des thèmes de dés côté web : ids, prix, libellés.
 *
 * MIROIR de `apps/server/src/services/dice-theme-catalogue.ts` (ids + prix),
 * verrouillé par `catalogue-consistency.test.ts`. Le serveur fait foi pour
 * la possession et la sélection ; le web s'en sert pour afficher le
 * catalogue et pour se replier sans réseau (flag OFF, visiteur anonyme).
 */

export const DEFAULT_DICE_THEME_ID = "nuffle" as const;

export interface DiceThemeCatalogueEntry {
  readonly id: string;
  /** Prix en Crowns ; `null` = gratuit (possédé d'office). */
  readonly priceCrowns: number | null;
  readonly name: { readonly fr: string; readonly en: string };
  readonly description: { readonly fr: string; readonly en: string };
}

export const DICE_THEME_CATALOGUE: ReadonlyArray<DiceThemeCatalogueEntry> = [
  {
    id: DEFAULT_DICE_THEME_ID,
    priceCrowns: null,
    name: { fr: "Nuffle", en: "Nuffle" },
    description: {
      fr: "Gravure or sur jeton sombre — le thème d'origine.",
      en: "Gold engraving on a dark token — the original theme.",
    },
  },
];
