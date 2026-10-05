/**
 * Amorçage de la table `DiceTheme` depuis le catalogue compilé
 * (`services/dice-theme-catalogue`).
 *
 * « Create-if-missing » : une ligne déjà présente n'est JAMAIS réécrite — un
 * prix ou un libellé corrigé en admin survit au déploiement suivant.
 * `force: true` réinitialise explicitement depuis le catalogue compilé.
 */

import { prisma } from "../prisma";
import { DICE_THEME_CATALOGUE } from "../services/dice-theme-catalogue";
import {
  entryToRow,
  invalidateDiceThemeCache,
} from "../services/dice-theme-repository";

export interface SyncDiceThemesOptions {
  /** `false` (défaut) = dry-run : on renvoie ce qui serait écrit. */
  readonly write?: boolean;
  /** Réécrit les lignes existantes depuis le catalogue compilé. */
  readonly force?: boolean;
}

export interface SyncDiceThemesResult {
  readonly write: boolean;
  readonly created: readonly string[];
  readonly updated: readonly string[];
  readonly skipped: readonly string[];
}

export async function syncDiceThemes(
  options: SyncDiceThemesOptions = {},
): Promise<SyncDiceThemesResult> {
  const write = options.write === true;
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  const existing = new Set(
    (
      (await prisma.diceTheme.findMany({ select: { slug: true } })) as Array<{ slug: string }>
    ).map((r) => r.slug),
  );

  for (const entry of DICE_THEME_CATALOGUE) {
    const data = entryToRow(entry);
    if (!existing.has(entry.id)) {
      created.push(entry.id);
      if (write) await prisma.diceTheme.create({ data: { slug: entry.id, ...data } });
      continue;
    }
    if (options.force) {
      updated.push(entry.id);
      if (write) await prisma.diceTheme.update({ where: { slug: entry.id }, data });
      continue;
    }
    skipped.push(entry.id);
  }

  if (write && (created.length > 0 || updated.length > 0)) {
    invalidateDiceThemeCache();
  }
  return { write, created, updated, skipped };
}
