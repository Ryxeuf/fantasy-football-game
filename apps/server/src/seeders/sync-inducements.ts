/**
 * Amorçage de la table `Inducement` depuis le catalogue du moteur (lot 6.1).
 *
 * `INDUCEMENT_CATALOGUE` reste la transcription de référence du livre et le
 * REPLI ; la base en est la copie ÉDITABLE, désormais lue en priorité par
 * `services/inducement-repository`.
 *
 * « Create-if-missing » : une ligne déjà présente n'est JAMAIS réécrite —
 * un prix corrigé en admin survit au déploiement suivant. `force: true`
 * réinitialise explicitement depuis le catalogue du moteur.
 *
 * Le catalogue compilé décrit la Saison 3 (édition courante du livre) : c'est
 * la seule édition seedée par défaut. Une Saison 2 éditée à la main reste
 * intacte, et sans ligne S2 le repli compilé s'applique — même comportement
 * qu'avant le lot.
 */

import {
  INDUCEMENT_CATALOGUE,
  type InducementDefinition,
  type Ruleset,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { invalidateInducementCache } from "../services/inducement-repository";

/** Édition décrite par le catalogue compilé. */
const CATALOGUE_RULESET: Ruleset = "season_3";

export interface SyncInducementsOptions {
  /** `false` (défaut) = dry-run : on renvoie ce qui serait écrit. */
  readonly write?: boolean;
  /** Réécrit les lignes existantes depuis le catalogue du moteur. */
  readonly force?: boolean;
  /** Édition ciblée (défaut : celle du catalogue compilé). */
  readonly ruleset?: Ruleset;
}

export interface SyncInducementsResult {
  readonly write: boolean;
  readonly created: readonly string[];
  readonly updated: readonly string[];
  readonly skipped: readonly string[];
}

/** Définition du moteur → colonnes de la table. */
export function definitionToRow(
  def: InducementDefinition,
  sortOrder: number,
): Record<string, unknown> {
  return {
    nameFr: def.displayNameFr,
    nameEn: def.displayName,
    descriptionFr: def.description,
    descriptionEn: null,
    baseCost: def.baseCost,
    maxQuantity: def.maxQuantity,
    discountRule: def.discountRule ?? null,
    discountRoster: def.discountRoster ?? null,
    discountCost: def.discountCost ?? null,
    ruleMaxRule: def.ruleMaxQuantity?.rule ?? null,
    ruleMaxQuantity: def.ruleMaxQuantity?.max ?? null,
    requiresAnyRule: def.requiresAnyRule?.join(",") ?? null,
    requiresRoster: def.requiresRoster ?? null,
    requiresApothecary: def.requiresApothecary ?? false,
    variableCost: def.variableCost ?? false,
    sortOrder,
  };
}

export async function syncInducements(
  options: SyncInducementsOptions = {},
): Promise<SyncInducementsResult> {
  const write = options.write === true;
  const ruleset = options.ruleset ?? CATALOGUE_RULESET;
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  for (const [index, def] of INDUCEMENT_CATALOGUE.entries()) {
    const data = definitionToRow(def, index);
    const existing = await prisma.inducement.findUnique({
      where: { slug_ruleset: { slug: def.slug, ruleset } },
      select: { id: true },
    });

    if (!existing) {
      created.push(def.slug);
      if (write) {
        await prisma.inducement.create({
          data: { slug: def.slug, ruleset, ...data } as never,
        });
      }
      continue;
    }
    if (options.force) {
      updated.push(def.slug);
      if (write) {
        await prisma.inducement.update({
          where: { id: existing.id },
          data: data as never,
        });
      }
      continue;
    }
    skipped.push(def.slug);
  }

  if (write && (created.length > 0 || updated.length > 0)) {
    invalidateInducementCache();
  }

  return { write, created, updated, skipped };
}
