/**
 * Catalogue des thèmes de dés — servi par la BASE (`DiceTheme`).
 *
 * Même posture que `inducement-repository` : la base fait foi pour ce que
 * l'admin édite (libellés, prix, mise en vente, ordre), le catalogue compilé
 * (`DICE_THEME_CATALOGUE`) est le REPLI et la source du seed. Le slug reste
 * un contrat de code : une ligne dont le slug n'existe pas au catalogue
 * compilé n'a pas de rendu côté web, elle est donc ignorée (et journalisée).
 *
 * Une ligne incohérente n'est jamais servie à moitié : prix négatif ou non
 * entier ⇒ la ligne est ignorée et l'entrée compilée s'applique. Le thème
 * par défaut reste GRATUIT et EN SERVICE quoi qu'en dise la base — sinon un
 * coach sans achat n'aurait plus aucun dé à dessiner.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import {
  DEFAULT_DICE_THEME_ID,
  DICE_THEME_CATALOGUE,
  DICE_THEME_COLLECTIONS,
  sortDiceThemes,
  type DiceThemeCatalogue,
  type DiceThemeCatalogueEntry,
  type DiceThemeCollection,
} from "./dice-theme-catalogue";

const TTL_MS = process.env.NODE_ENV === "production" ? 5 * 60 * 1000 : 0;

let cache: { value: DiceThemeCatalogue; expiresAt: number } | null = null;
/**
 * Génération du cache : une lecture partie AVANT une invalidation ne doit pas
 * réécrire le cache après elle (sinon une édition admin resterait invisible
 * pendant tout le TTL).
 */
let generation = 0;

/** À appeler après toute écriture admin sur `DiceTheme`. */
export function invalidateDiceThemeCache(): void {
  cache = null;
  generation += 1;
}

/** Ligne de la table, telle que sélectionnée ci-dessous. */
export interface DiceThemeRow {
  slug: string;
  collection: string;
  nameFr: string;
  nameEn: string;
  descriptionFr?: string | null;
  descriptionEn?: string | null;
  priceCrowns?: number | null;
  enabled: boolean;
  sortOrder: number;
}

function isCollection(raw: string): raw is DiceThemeCollection {
  return (DICE_THEME_COLLECTIONS as readonly string[]).includes(raw);
}

/**
 * Ligne → entrée du catalogue, en partant de l'entrée compilée de même slug
 * (`null` si la ligne est inutilisable). Les libellés vides retombent sur le
 * compilé ; le défaut est forcé gratuit et en service.
 */
export function rowToEntry(
  row: DiceThemeRow,
  compiled: DiceThemeCatalogueEntry,
): DiceThemeCatalogueEntry | null {
  const price = row.priceCrowns ?? null;
  if (price !== null && (!Number.isInteger(price) || price < 0)) return null;
  const isDefault = row.slug === DEFAULT_DICE_THEME_ID;
  return {
    id: compiled.id,
    collection: isCollection(row.collection) ? row.collection : compiled.collection,
    priceCrowns: isDefault ? null : price,
    enabled: isDefault ? true : row.enabled,
    sortOrder: Number.isInteger(row.sortOrder) ? row.sortOrder : compiled.sortOrder,
    name: {
      fr: row.nameFr.trim() || compiled.name.fr,
      en: row.nameEn.trim() || compiled.name.en,
    },
    description: {
      fr: row.descriptionFr?.trim() || compiled.description.fr,
      en: row.descriptionEn?.trim() || compiled.description.en,
    },
  };
}

/**
 * Fusion PURE : chaque entrée compilée est remplacée par sa ligne si elle est
 * valide. Une entrée compilée sans ligne reste servie (table partiellement
 * seedée) ; une ligne au slug inconnu est ignorée.
 */
export function mergeDiceThemeRows(
  rows: readonly DiceThemeRow[],
  compiled: DiceThemeCatalogue = DICE_THEME_CATALOGUE,
  onIgnored: (slug: string, reason: string) => void = () => {},
): DiceThemeCatalogue {
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  for (const r of rows) {
    if (!compiled.some((c) => c.id === r.slug)) onIgnored(r.slug, "slug inconnu du rendu");
  }
  return sortDiceThemes(
    compiled.map((entry) => {
      const row = bySlug.get(entry.id);
      if (!row) return entry;
      const merged = rowToEntry(row, entry);
      if (!merged) {
        onIgnored(row.slug, "ligne incohérente (prix)");
        return entry;
      }
      return merged;
    }),
  );
}

const SELECT = {
  slug: true,
  collection: true,
  nameFr: true,
  nameEn: true,
  descriptionFr: true,
  descriptionEn: true,
  priceCrowns: true,
  enabled: true,
  sortOrder: true,
} as const;

/**
 * Catalogue résolu (base d'abord). Ne lève jamais : une lecture en échec sert
 * le catalogue compilé — un dé doit toujours pouvoir se dessiner.
 */
export async function loadDiceThemeCatalogue(): Promise<DiceThemeCatalogue> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const startedAt = generation;
  try {
    const rows = (await prisma.diceTheme.findMany({ select: SELECT })) as DiceThemeRow[];
    const value = mergeDiceThemeRows(rows, DICE_THEME_CATALOGUE, (slug, reason) =>
      serverLog.error(`[dice-theme] ligne DiceTheme '${slug}' ignorée : ${reason}`),
    );
    if (startedAt === generation) {
      cache = { value, expiresAt: Date.now() + TTL_MS };
    }
    return value;
  } catch (e: unknown) {
    // Repli NON mis en cache : une base momentanément indisponible ne doit
    // pas servir le compilé (prix et mises en vente admin ignorés) pendant
    // tout le TTL.
    serverLog.error("[dice-theme] lecture du catalogue en base échouée, repli compilé", e);
    return DICE_THEME_CATALOGUE;
  }
}

/** Colonnes d'une entrée compilée (seed, réinitialisation admin). */
export function entryToRow(entry: DiceThemeCatalogueEntry): Omit<DiceThemeRow, "slug"> {
  return {
    collection: entry.collection,
    nameFr: entry.name.fr,
    nameEn: entry.name.en,
    descriptionFr: entry.description.fr,
    descriptionEn: entry.description.en,
    priceCrowns: entry.priceCrowns,
    enabled: entry.enabled,
    sortOrder: entry.sortOrder,
  };
}
