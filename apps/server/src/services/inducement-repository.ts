/**
 * Catalogue des Coups de Pouce — servi par la BASE (lot 6.1).
 *
 * Prix, plafonds, remises et conditions d'achat vivaient dans
 * `core/inducements.ts`, conditions comprises (des fonctions TypeScript) :
 * corriger un prix demandait un déploiement, et le match en ligne, le match
 * local et la feuille de ligue lisaient tous le même catalogue figé.
 *
 * Même posture que `tournament-ruleset-repository` : la base fait foi, le
 * catalogue compilé est le REPLI journalisé (table vide avant le premier
 * seed, base indisponible, miroir SQLite réduit) et la source du seed. Le
 * catalogue résolu est passé au moteur via `InducementContext.catalogue` —
 * le moteur ne lit pas Prisma.
 */

import {
  DEFAULT_RULESET,
  INDUCEMENT_CATALOGUE,
  type InducementCatalogue,
  type InducementDefinition,
  type Ruleset,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

const TTL_MS = process.env.NODE_ENV === "production" ? 5 * 60 * 1000 : 0;

const cache = new Map<string, { value: InducementCatalogue; expiresAt: number }>();

/** À appeler après toute écriture admin sur `Inducement`. */
export function invalidateInducementCache(): void {
  cache.clear();
}

/** Ligne de la table, telle que sélectionnée ci-dessous. */
export interface InducementRow {
  slug: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn?: string | null;
  baseCost: number;
  maxQuantity: number;
  discountRule?: string | null;
  discountRoster?: string | null;
  discountCost?: number | null;
  ruleMaxRule?: string | null;
  ruleMaxQuantity?: number | null;
  requiresAnyRule?: string | null;
  requiresRoster?: string | null;
  requiresApothecary?: boolean | null;
  variableCost?: boolean | null;
}

/** CSV tolérant (virgules et/ou espaces), vide ⇒ liste vide. */
export function parseRuleCsv(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[,\s]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Ligne → définition du moteur. Une ligne incohérente est REFUSÉE plutôt que
 * servie à moitié : un plafond nul ou un coût négatif ferait silencieusement
 * disparaître un coup de pouce du panier ou offrirait de l'argent.
 */
export function rowToDefinition(row: InducementRow): InducementDefinition | null {
  if (!row.slug || !row.nameFr) return null;
  if (!Number.isInteger(row.baseCost) || row.baseCost < 0) return null;
  if (!Number.isInteger(row.maxQuantity) || row.maxQuantity < 1) return null;

  const requiresAnyRule = parseRuleCsv(row.requiresAnyRule);
  const discountCost =
    typeof row.discountCost === "number" && row.discountCost >= 0
      ? row.discountCost
      : undefined;

  return {
    slug: row.slug,
    displayName: row.nameEn || row.nameFr,
    displayNameFr: row.nameFr,
    baseCost: row.baseCost,
    maxQuantity: row.maxQuantity,
    description: row.descriptionFr ?? "",
    ...(row.discountRule && discountCost !== undefined
      ? { discountRule: row.discountRule, discountCost }
      : {}),
    ...(row.discountRoster && discountCost !== undefined
      ? { discountRoster: row.discountRoster, discountCost }
      : {}),
    ...(row.ruleMaxRule &&
    typeof row.ruleMaxQuantity === "number" &&
    row.ruleMaxQuantity > 0
      ? {
          ruleMaxQuantity: { rule: row.ruleMaxRule, max: row.ruleMaxQuantity },
        }
      : {}),
    ...(requiresAnyRule.length > 0 ? { requiresAnyRule } : {}),
    ...(row.requiresRoster ? { requiresRoster: row.requiresRoster } : {}),
    ...(row.requiresApothecary ? { requiresApothecary: true } : {}),
    ...(row.variableCost ? { variableCost: true } : {}),
  };
}

const SELECT = {
  slug: true,
  nameFr: true,
  nameEn: true,
  descriptionFr: true,
  descriptionEn: true,
  baseCost: true,
  maxQuantity: true,
  discountRule: true,
  discountRoster: true,
  discountCost: true,
  ruleMaxRule: true,
  ruleMaxQuantity: true,
  requiresAnyRule: true,
  requiresRoster: true,
  requiresApothecary: true,
  variableCost: true,
} as const;

/**
 * Catalogue résolu pour une édition, prêt pour `InducementContext.catalogue`.
 * Ne lève jamais : toute lecture en échec sert le catalogue compilé, sinon la
 * phase de coups de pouce d'un match tomberait sur une base indisponible.
 */
export async function loadInducementCatalogue(
  ruleset: Ruleset = DEFAULT_RULESET,
): Promise<InducementCatalogue> {
  const cached = cache.get(ruleset);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value: InducementCatalogue = INDUCEMENT_CATALOGUE;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (prisma as unknown as { inducement?: any }).inducement;
    const rows: InducementRow[] | undefined = await model?.findMany({
      where: { ruleset, enabled: true },
      select: SELECT,
      orderBy: [{ sortOrder: "asc" }, { nameFr: "asc" }],
    });
    if (Array.isArray(rows) && rows.length > 0) {
      const defs: InducementDefinition[] = [];
      for (const row of rows) {
        const def = rowToDefinition(row);
        if (!def) {
          serverLog.error(
            `[inducements] ligne invalide ignorée : ${row?.slug ?? "(sans slug)"} (${ruleset})`,
          );
          continue;
        }
        defs.push(def);
      }
      if (defs.length > 0) value = defs;
    } else {
      serverLog.warn(
        `[inducements] table vide pour ${ruleset} — repli catalogue compilé`,
      );
    }
  } catch (e: unknown) {
    serverLog.error(
      `[inducements] lecture en base impossible (${ruleset}) — repli catalogue compilé`,
      e,
    );
  }

  cache.set(ruleset, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}
