/**
 * Catalogue des thèmes de dés (Dé de Blocage + D6) — module PUR.
 *
 * Le RENDU d'un thème vit côté web (`apps/web/app/components/dice/themes`,
 * faces PNG de `public/images/dices/` + D6 dessiné aux couleurs du thème) ;
 * le serveur ne connaît que ce qui fait foi pour une préférence et un achat :
 * l'id, la collection, le prix, la mise en vente et les libellés.
 *
 * Ce catalogue COMPILÉ est le REPLI et la source du seed : la table
 * `DiceTheme` (éditable en admin) est lue en priorité par
 * `services/dice-theme-repository`, qui passe le catalogue RÉSOLU aux
 * fonctions ci-dessous (dernier paramètre, défaut = catalogue compilé). Les
 * ids doivent rester ceux du registre de rendu web — verrouillé par
 * `apps/web/app/components/dice/themes/catalogue-consistency.test.ts`.
 *
 * Prix en Crowns : `null` = gratuit, possédé par tout le monde. Un thème
 * payant n'est sélectionnable qu'une fois ACHETÉ (ou offert par un admin) :
 * `ownedPaidThemeIds` est lu en base par le service et passé ici.
 */

export const DEFAULT_DICE_THEME_ID = "nuffle" as const;

/** `classic` = déclinaisons du dé original ; `team` = aux couleurs d'un roster. */
export type DiceThemeCollection = "classic" | "team";

export const DICE_THEME_COLLECTIONS: readonly DiceThemeCollection[] = [
  "classic",
  "team",
];

export interface LocalizedText {
  readonly fr: string;
  readonly en: string;
}

export interface DiceThemeCatalogueEntry {
  readonly id: string;
  readonly collection: DiceThemeCollection;
  /** Prix en Crowns ; `null` = gratuit (possédé d'office). */
  readonly priceCrowns: number | null;
  /** Faux = retiré de la vente (les acheteurs le gardent). */
  readonly enabled: boolean;
  readonly sortOrder: number;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
}

/** Prix par défaut d'une déclinaison du dé original. */
export const DEFAULT_CLASSIC_PRICE_CROWNS = 250;
/** Prix par défaut d'un thème d'équipe. */
export const DEFAULT_TEAM_PRICE_CROWNS = 400;

const CLASSIC_THEMES: ReadonlyArray<
  Pick<DiceThemeCatalogueEntry, "id" | "priceCrowns" | "name" | "description">
> = [
  {
    id: DEFAULT_DICE_THEME_ID,
    priceCrowns: null,
    name: { fr: "Original · Or & charbon", en: "Original · Gold & charcoal" },
    description: {
      fr: "Or sur charbon — le dé original de Nuffle Arena.",
      en: "Gold on charcoal — the original Nuffle Arena die.",
    },
  },
  {
    id: "acier-bleu",
    priceCrowns: DEFAULT_CLASSIC_PRICE_CROWNS,
    name: { fr: "Acier bleu", en: "Blue Steel" },
    description: {
      fr: "Argent sur marine, liseré bleu acier.",
      en: "Silver on navy with a steel-blue edge.",
    },
  },
  {
    id: "chaos-rouge",
    priceCrowns: DEFAULT_CLASSIC_PRICE_CROWNS,
    name: { fr: "Chaos rouge", en: "Chaos Red" },
    description: {
      fr: "Ivoire sur bordeaux, pointes rouges du Chaos.",
      en: "Ivory on burgundy with Chaos-red spikes.",
    },
  },
  {
    id: "malepierre",
    priceCrowns: DEFAULT_CLASSIC_PRICE_CROWNS,
    name: { fr: "Malepierre", en: "Warpstone" },
    description: {
      fr: "Vert acide sur vert sombre, éclats de malepierre.",
      en: "Acid green on dark green, warpstone shards.",
    },
  },
  {
    id: "glace",
    priceCrowns: DEFAULT_CLASSIC_PRICE_CROWNS,
    name: { fr: "Glace", en: "Ice" },
    description: {
      fr: "Bleu marine sur glace pâle, angles cyan.",
      en: "Navy on pale ice with cyan corners.",
    },
  },
];

/** Les 31 thèmes d'équipe du pack `nuffle-des-31-equipes`, par nom français. */
const TEAM_THEMES: ReadonlyArray<{ readonly id: string; readonly name: LocalizedText }> = [
  { id: "alliance-vieux-monde", name: { fr: "Alliance du Vieux Monde", en: "Old World Alliance" } },
  { id: "amazones", name: { fr: "Amazones", en: "Amazons" } },
  { id: "bas-fonds", name: { fr: "Bas-Fonds", en: "Underworld Denizens" } },
  { id: "bretonniens", name: { fr: "Bretonniens", en: "Bretonnians" } },
  { id: "elfes-noirs", name: { fr: "Elfes noirs", en: "Dark Elves" } },
  { id: "elfes-sylvains", name: { fr: "Elfes sylvains", en: "Wood Elves" } },
  { id: "elus-chaos", name: { fr: "Élus du Chaos", en: "Chaos Chosen" } },
  { id: "gnomes", name: { fr: "Gnomes", en: "Gnomes" } },
  { id: "gobelins", name: { fr: "Gobelins", en: "Goblins" } },
  { id: "halflings", name: { fr: "Halflings", en: "Halflings" } },
  { id: "hauts-elfes", name: { fr: "Hauts elfes", en: "High Elves" } },
  { id: "hommes-lezards", name: { fr: "Hommes-Lézards", en: "Lizardmen" } },
  { id: "necromantiques", name: { fr: "Horreurs nécromantiques", en: "Necromantic Horror" } },
  { id: "humains", name: { fr: "Humains", en: "Humans" } },
  { id: "khorne", name: { fr: "Khorne", en: "Khorne" } },
  { id: "morts-ambulants", name: { fr: "Morts ambulants", en: "Shambling Undead" } },
  { id: "nains", name: { fr: "Nains", en: "Dwarves" } },
  { id: "nains-chaos", name: { fr: "Nains du Chaos", en: "Chaos Dwarves" } },
  { id: "noblesse-imperiale", name: { fr: "Noblesse impériale", en: "Imperial Nobility" } },
  { id: "nordiques", name: { fr: "Nordiques", en: "Norse" } },
  { id: "nurgle", name: { fr: "Nurgle", en: "Nurgle" } },
  { id: "ogres", name: { fr: "Ogres", en: "Ogres" } },
  { id: "orques", name: { fr: "Orques", en: "Orcs" } },
  { id: "orques-noirs", name: { fr: "Orques Noirs", en: "Black Orcs" } },
  { id: "renegats-chaos", name: { fr: "Renégats du Chaos", en: "Chaos Renegades" } },
  { id: "rois-tombes", name: { fr: "Rois des tombes", en: "Tomb Kings" } },
  { id: "skavens", name: { fr: "Skavens", en: "Skaven" } },
  { id: "slann", name: { fr: "Slanns", en: "Slann" } },
  { id: "snotlings", name: { fr: "Snotlings", en: "Snotlings" } },
  { id: "union-elfique", name: { fr: "Union elfique", en: "Elven Union" } },
  { id: "vampires", name: { fr: "Vampires", en: "Vampires" } },
];

/** Écart de `sortOrder` entre collections : les classiques passent devant. */
const TEAM_SORT_OFFSET = 100;

export const DICE_THEME_CATALOGUE: ReadonlyArray<DiceThemeCatalogueEntry> = [
  ...CLASSIC_THEMES.map((t, i) => ({
    ...t,
    collection: "classic" as const,
    enabled: true,
    sortOrder: i,
  })),
  ...TEAM_THEMES.map((t, i) => ({
    id: t.id,
    collection: "team" as const,
    priceCrowns: DEFAULT_TEAM_PRICE_CROWNS,
    enabled: true,
    sortOrder: TEAM_SORT_OFFSET + i,
    name: t.name,
    description: {
      fr: `Aux couleurs de l'équipe ${t.name.fr}.`,
      en: `In ${t.name.en} team colours.`,
    },
  })),
];

export type DiceThemeCatalogue = ReadonlyArray<DiceThemeCatalogueEntry>;

export function findDiceTheme(
  id: string,
  catalogue: DiceThemeCatalogue = DICE_THEME_CATALOGUE,
): DiceThemeCatalogueEntry | undefined {
  return catalogue.find((t) => t.id === id);
}

/** Vrai si le thème se possède sans achat (gratuit ET en service). */
export function isFreeDiceTheme(entry: DiceThemeCatalogueEntry): boolean {
  return entry.priceCrowns === null && entry.enabled;
}

/**
 * Ids des thèmes utilisables : les gratuits en service + ceux ACQUIS (achat
 * ou cadeau admin), même retirés de la vente depuis — un thème acheté reste
 * à son acheteur. Un id acquis absent du catalogue est ignoré (pas de rendu).
 */
export function ownedDiceThemeIds(
  ownedPaidThemeIds: readonly string[] = [],
  catalogue: DiceThemeCatalogue = DICE_THEME_CATALOGUE,
): readonly string[] {
  const acquired = new Set(ownedPaidThemeIds);
  return catalogue
    .filter((t) => isFreeDiceTheme(t) || acquired.has(t.id))
    .map((t) => t.id);
}

/**
 * Thème EFFECTIF d'une préférence stockée : repli sur le défaut si rien
 * n'est stocké (`null` = jamais choisi), si le thème a disparu du catalogue
 * ou s'il n'est plus possédé. Jamais d'erreur à la lecture.
 */
export function effectiveDiceThemeId(
  stored: string | null | undefined,
  ownedPaidThemeIds: readonly string[] = [],
  catalogue: DiceThemeCatalogue = DICE_THEME_CATALOGUE,
): string {
  if (!stored) return DEFAULT_DICE_THEME_ID;
  return ownedDiceThemeIds(ownedPaidThemeIds, catalogue).includes(stored)
    ? stored
    : DEFAULT_DICE_THEME_ID;
}

export type DiceThemeSelectionRefusal = "unknown-theme" | "theme-not-owned";

/** `null` si le thème peut être choisi, sinon la raison du refus. */
export function diceThemeSelectionRefusal(
  id: string,
  ownedPaidThemeIds: readonly string[] = [],
  catalogue: DiceThemeCatalogue = DICE_THEME_CATALOGUE,
): DiceThemeSelectionRefusal | null {
  if (!findDiceTheme(id, catalogue)) return "unknown-theme";
  if (!ownedDiceThemeIds(ownedPaidThemeIds, catalogue).includes(id)) {
    return "theme-not-owned";
  }
  return null;
}

export type DiceThemePurchaseRefusal =
  | "unknown-theme"
  | "theme-not-for-sale"
  | "theme-already-owned"
  | "insufficient-funds";

/**
 * `null` si le thème peut être acheté avec `balance` Crowns, sinon la raison
 * du refus. Un thème gratuit est « déjà possédé » ; un thème retiré de la
 * vente ne s'achète plus. Le contrôle de solde est REJOUÉ en base au moment
 * du débit (décrément conditionnel) : celui-ci ne sert qu'à répondre vite.
 */
export function diceThemePurchaseRefusal(
  id: string,
  ownedPaidThemeIds: readonly string[],
  balance: number,
  catalogue: DiceThemeCatalogue = DICE_THEME_CATALOGUE,
): DiceThemePurchaseRefusal | null {
  const entry = findDiceTheme(id, catalogue);
  if (!entry) return "unknown-theme";
  if (ownedDiceThemeIds(ownedPaidThemeIds, catalogue).includes(id)) {
    return "theme-already-owned";
  }
  if (!entry.enabled || entry.priceCrowns === null) return "theme-not-for-sale";
  if (balance < entry.priceCrowns) return "insufficient-funds";
  return null;
}

/**
 * Thèmes visibles dans la boutique d'un coach : ceux en vente + ceux qu'il
 * possède (un thème retiré reste affiché à son acheteur). Ordre du catalogue.
 */
export function visibleDiceThemes(
  ownedPaidThemeIds: readonly string[] = [],
  catalogue: DiceThemeCatalogue = DICE_THEME_CATALOGUE,
): DiceThemeCatalogue {
  const owned = new Set(ownedDiceThemeIds(ownedPaidThemeIds, catalogue));
  return sortDiceThemes(catalogue.filter((t) => t.enabled || owned.has(t.id)));
}

/** Tri canonique : `sortOrder`, puis nom français. Ne mute pas l'entrée. */
export function sortDiceThemes(catalogue: DiceThemeCatalogue): DiceThemeCatalogue {
  return [...catalogue].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.fr.localeCompare(b.name.fr, "fr"),
  );
}
