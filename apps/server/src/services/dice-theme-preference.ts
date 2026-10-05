/**
 * Thème de dés d'un coach : préférence (`User.diceTheme`), thèmes acquis
 * (`UserDiceTheme`) et achat en Crowns.
 *
 * `null` en base = jamais choisi => thème par défaut. La colonne est
 * nullable parce que `prisma/migrations/` est gitignoré (prod = `db push`) :
 * aucun backfill possible, l'absence doit rester lisible comme absence.
 *
 * Les Crowns sont celles du wallet existant (`ProWallet` + journal
 * `ProTransaction`) : un achat est un débit `SINK` (« dépense cosmétique »,
 * réf. `dice-theme:<id>`) écrit dans la MÊME transaction que la ligne
 * `UserDiceTheme`. Le débit est un décrément CONDITIONNEL (`crowns >= prix`)
 * — deux achats simultanés ne peuvent pas passer le solde sous zéro — et
 * l'unicité (coach, thème) refuse un double achat du même thème.
 */

import { prisma } from "../prisma";
import { getBalance, ensureWalletExists } from "./pro-wallet";
import {
  DEFAULT_DICE_THEME_ID,
  diceThemePurchaseRefusal,
  diceThemeSelectionRefusal,
  effectiveDiceThemeId,
  findDiceTheme,
  ownedDiceThemeIds,
  visibleDiceThemes,
  type DiceThemeCatalogue,
  type DiceThemeCollection,
  type DiceThemePurchaseRefusal,
  type DiceThemeSelectionRefusal,
  type LocalizedText,
} from "./dice-theme-catalogue";
import { loadDiceThemeCatalogue } from "./dice-theme-repository";

export type DiceThemeErrorCode =
  | DiceThemeSelectionRefusal
  | DiceThemePurchaseRefusal
  | "user-not-found";

export class DiceThemeError extends Error {
  constructor(
    public readonly code: DiceThemeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DiceThemeError";
  }
}

const MESSAGES: Record<DiceThemeErrorCode, string> = {
  "unknown-theme": "Thème de dés inconnu",
  "theme-not-owned": "Thème de dés non possédé",
  "theme-not-for-sale": "Ce thème de dés n'est pas en vente",
  "theme-already-owned": "Thème de dés déjà possédé",
  "insufficient-funds": "Solde de Crowns insuffisant",
  "user-not-found": "Utilisateur introuvable",
};

export function diceThemeError(code: DiceThemeErrorCode): DiceThemeError {
  return new DiceThemeError(code, MESSAGES[code]);
}

/** Préfixe de la référence d'un achat dans le journal des Crowns. */
export const DICE_THEME_TX_REF_PREFIX = "dice-theme:";

export interface DiceThemeOptionView {
  readonly id: string;
  readonly collection: DiceThemeCollection;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly priceCrowns: number | null;
  readonly owned: boolean;
  /** En vente et non possédé (indépendant du solde). */
  readonly forSale: boolean;
}

export interface DiceThemePreferenceView {
  /** Thème EFFECTIF (repli sur le défaut). */
  readonly themeId: string;
  readonly defaultThemeId: string;
  readonly themes: readonly DiceThemeOptionView[];
}

export interface DiceThemePurchaseView extends DiceThemePreferenceView {
  /** Solde de Crowns après l'achat. */
  readonly balance: number;
}

/** Ids des thèmes acquis (achat ou cadeau), présents ou non au catalogue. */
export async function loadOwnedPaidThemeIds(userId: string): Promise<string[]> {
  const rows: Array<{ themeId: string }> = await prisma.userDiceTheme.findMany({
    where: { userId },
    select: { themeId: true },
  });
  return rows.map((r) => r.themeId);
}

/** Vue PURE d'une préférence : boutique visible, possession, mise en vente. */
export function toPreferenceView(
  stored: string | null,
  ownedPaid: readonly string[],
  catalogue: DiceThemeCatalogue,
): DiceThemePreferenceView {
  const owned = new Set(ownedDiceThemeIds(ownedPaid, catalogue));
  return {
    themeId: effectiveDiceThemeId(stored, ownedPaid, catalogue),
    defaultThemeId: DEFAULT_DICE_THEME_ID,
    themes: visibleDiceThemes(ownedPaid, catalogue).map((t) => ({
      id: t.id,
      collection: t.collection,
      name: t.name,
      description: t.description,
      priceCrowns: t.priceCrowns,
      owned: owned.has(t.id),
      forSale: !owned.has(t.id) && t.enabled && t.priceCrowns !== null,
    })),
  };
}

export async function getDiceThemePreference(
  userId: string,
): Promise<DiceThemePreferenceView> {
  const [row, ownedPaid, catalogue] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { diceTheme: true } }),
    loadOwnedPaidThemeIds(userId),
    loadDiceThemeCatalogue(),
  ]);
  return toPreferenceView(row?.diceTheme ?? null, ownedPaid, catalogue);
}

export async function setDiceThemePreference(
  userId: string,
  themeId: string,
): Promise<DiceThemePreferenceView> {
  const [ownedPaid, catalogue] = await Promise.all([
    loadOwnedPaidThemeIds(userId),
    loadDiceThemeCatalogue(),
  ]);
  const refusal = diceThemeSelectionRefusal(themeId, ownedPaid, catalogue);
  if (refusal) throw diceThemeError(refusal);
  const { count } = await prisma.user.updateMany({
    where: { id: userId },
    data: { diceTheme: themeId },
  });
  if (count !== 1) throw diceThemeError("user-not-found");
  return toPreferenceView(themeId, ownedPaid, catalogue);
}

/** Erreur Prisma de contrainte unique (P2002). */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: unknown }).code === "P2002"
  );
}

/**
 * Achète un thème avec des Crowns, puis l'ÉQUIPE (le coach vient de le
 * choisir). Débit, ligne d'acquisition, journal et préférence sont écrits
 * dans la même transaction : un échec n'en laisse aucun.
 */
export async function purchaseDiceTheme(
  userId: string,
  themeId: string,
): Promise<DiceThemePurchaseView> {
  const [ownedPaid, catalogue, balance] = await Promise.all([
    loadOwnedPaidThemeIds(userId),
    loadDiceThemeCatalogue(),
    getBalance(userId),
  ]);
  const refusal = diceThemePurchaseRefusal(themeId, ownedPaid, balance, catalogue);
  if (refusal) throw diceThemeError(refusal);
  // Le refus ci-dessus garantit un thème connu, en vente et payant.
  const price = findDiceTheme(themeId, catalogue)!.priceCrowns!;

  await ensureWalletExists(userId);
  let newBalance: number;
  try {
    newBalance = await prisma.$transaction(async (tx: typeof prisma) => {
      // Décrément CONDITIONNEL : rejoue le contrôle de solde dans la même
      // instruction SQL que l'écriture (pas de lecture-puis-écriture).
      const debited = await tx.proWallet.updateMany({
        where: { userId, crowns: { gte: price } },
        data: { crowns: { decrement: price } },
      });
      if (debited.count !== 1) throw diceThemeError("insufficient-funds");
      await tx.userDiceTheme.create({
        data: { userId, themeId, source: "purchase", priceCrowns: price },
      });
      await tx.proTransaction.create({
        data: {
          walletId: userId,
          type: "SINK",
          amount: -price,
          ref: `${DICE_THEME_TX_REF_PREFIX}${themeId}`,
        },
      });
      await tx.user.update({ where: { id: userId }, data: { diceTheme: themeId } });
      const wallet = await tx.proWallet.findUnique({
        where: { userId },
        select: { crowns: true },
      });
      return wallet?.crowns ?? 0;
    });
  } catch (e: unknown) {
    if (isUniqueViolation(e)) throw diceThemeError("theme-already-owned");
    throw e;
  }

  return {
    ...toPreferenceView(themeId, [...ownedPaid, themeId], catalogue),
    balance: newBalance,
  };
}
