/**
 * Catalogue des thèmes de dés (Dé de Blocage + D6) — module PUR.
 *
 * Le RENDU d'un thème vit côté web (`apps/web/app/components/dice/themes`) ;
 * le serveur ne connaît que ce qui fait foi pour une préférence : l'id, le
 * prix et le thème par défaut. Miroir web verrouillé par
 * `apps/web/app/components/dice/themes/catalogue-consistency.test.ts`.
 *
 * Prix en Crowns : `null` = gratuit, possédé par tout le monde. Un thème
 * payant ne sera sélectionnable qu'une fois ACHETÉ — l'achat n'existe pas
 * encore (pas de puits de Crowns hors Pro League), d'où `ownedPaidThemeIds`
 * passé en argument : le jour où il existe, le service le lit en base et le
 * passe ici, sans que la règle change.
 */

export const DEFAULT_DICE_THEME_ID = "nuffle" as const;

export interface DiceThemeCatalogueEntry {
  readonly id: string;
  /** Prix en Crowns ; `null` = gratuit (possédé d'office). */
  readonly priceCrowns: number | null;
}

export const DICE_THEME_CATALOGUE: ReadonlyArray<DiceThemeCatalogueEntry> = [
  { id: DEFAULT_DICE_THEME_ID, priceCrowns: null },
];

export function findDiceTheme(
  id: string,
): DiceThemeCatalogueEntry | undefined {
  return DICE_THEME_CATALOGUE.find((t) => t.id === id);
}

/** Ids des thèmes utilisables : les gratuits + les payants achetés connus. */
export function ownedDiceThemeIds(
  ownedPaidThemeIds: readonly string[] = [],
): readonly string[] {
  const bought = new Set(ownedPaidThemeIds);
  return DICE_THEME_CATALOGUE.filter(
    (t) => t.priceCrowns === null || bought.has(t.id),
  ).map((t) => t.id);
}

/**
 * Thème EFFECTIF d'une préférence stockée : repli sur le défaut si rien
 * n'est stocké (`null` = jamais choisi), si le thème a disparu du catalogue
 * ou s'il n'est plus possédé. Jamais d'erreur à la lecture.
 */
export function effectiveDiceThemeId(
  stored: string | null | undefined,
  ownedPaidThemeIds: readonly string[] = [],
): string {
  if (!stored) return DEFAULT_DICE_THEME_ID;
  return ownedDiceThemeIds(ownedPaidThemeIds).includes(stored)
    ? stored
    : DEFAULT_DICE_THEME_ID;
}

export type DiceThemeSelectionRefusal = "unknown-theme" | "theme-not-owned";

/** `null` si le thème peut être choisi, sinon la raison du refus. */
export function diceThemeSelectionRefusal(
  id: string,
  ownedPaidThemeIds: readonly string[] = [],
): DiceThemeSelectionRefusal | null {
  if (!findDiceTheme(id)) return "unknown-theme";
  if (!ownedDiceThemeIds(ownedPaidThemeIds).includes(id)) {
    return "theme-not-owned";
  }
  return null;
}
