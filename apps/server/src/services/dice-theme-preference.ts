/**
 * Préférence de thème de dés d'un coach (`User.diceTheme`).
 *
 * `null` en base = jamais choisi => thème par défaut. La colonne est
 * nullable parce que `prisma/migrations/` est gitignoré (prod = `db push`) :
 * aucun backfill possible, l'absence doit rester lisible comme absence.
 *
 * Achats : pas encore de Crowns hors Pro League. `ownedPaidThemeIds` est
 * donc vide pour tout le monde ; le jour où l'achat existe, c'est ICI qu'on
 * le lit (une seule fonction à changer : `loadOwnedPaidThemeIds`).
 */

import { prisma } from "../prisma";
import {
  DEFAULT_DICE_THEME_ID,
  DICE_THEME_CATALOGUE,
  diceThemeSelectionRefusal,
  effectiveDiceThemeId,
  ownedDiceThemeIds,
  type DiceThemeSelectionRefusal,
} from "./dice-theme-catalogue";

export class DiceThemeError extends Error {
  constructor(
    public readonly code: DiceThemeSelectionRefusal | "user-not-found",
    message: string,
  ) {
    super(message);
    this.name = "DiceThemeError";
  }
}

export interface DiceThemeOptionView {
  readonly id: string;
  readonly priceCrowns: number | null;
  readonly owned: boolean;
}

export interface DiceThemePreferenceView {
  /** Thème EFFECTIF (repli sur le défaut). */
  readonly themeId: string;
  readonly defaultThemeId: string;
  readonly themes: readonly DiceThemeOptionView[];
}

async function loadOwnedPaidThemeIds(_userId: string): Promise<string[]> {
  return [];
}

function toView(
  stored: string | null,
  ownedPaid: readonly string[],
): DiceThemePreferenceView {
  const owned = new Set(ownedDiceThemeIds(ownedPaid));
  return {
    themeId: effectiveDiceThemeId(stored, ownedPaid),
    defaultThemeId: DEFAULT_DICE_THEME_ID,
    themes: DICE_THEME_CATALOGUE.map((t) => ({
      id: t.id,
      priceCrowns: t.priceCrowns,
      owned: owned.has(t.id),
    })),
  };
}

export async function getDiceThemePreference(
  userId: string,
): Promise<DiceThemePreferenceView> {
  const [row, ownedPaid] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { diceTheme: true } }),
    loadOwnedPaidThemeIds(userId),
  ]);
  return toView(row?.diceTheme ?? null, ownedPaid);
}

export async function setDiceThemePreference(
  userId: string,
  themeId: string,
): Promise<DiceThemePreferenceView> {
  const ownedPaid = await loadOwnedPaidThemeIds(userId);
  const refusal = diceThemeSelectionRefusal(themeId, ownedPaid);
  if (refusal === "unknown-theme") {
    throw new DiceThemeError(refusal, "Thème de dés inconnu");
  }
  if (refusal === "theme-not-owned") {
    throw new DiceThemeError(refusal, "Thème de dés non possédé");
  }
  const { count } = await prisma.user.updateMany({
    where: { id: userId },
    data: { diceTheme: themeId },
  });
  if (count !== 1) {
    throw new DiceThemeError("user-not-found", "Utilisateur introuvable");
  }
  return toView(themeId, ownedPaid);
}
