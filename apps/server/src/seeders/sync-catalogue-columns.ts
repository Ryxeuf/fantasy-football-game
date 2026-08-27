/**
 * Lot 6a — amorçage des colonnes de catalogue AJOUTÉES au schéma :
 * `Position.displayNameEn`, `Roster.maxBigGuys`, `StarPlayer.pairWithSlug`,
 * et la catégorie `StarPlayerRule` sur les 10 pouvoirs de Star Player.
 *
 * `prisma/migrations/` est gitignoré et la prod applique le schéma par
 * `prisma db push` : aucun backfill de migration n'est possible (cf. CLAUDE.md).
 * Ces colonnes sont donc NULLABLES — les lectures retombent sur le catalogue
 * compilé tant qu'elles ne sont pas renseignées — et ce seeder les remplit au
 * déploiement, en mode « create-if-missing » :
 *
 *  - une valeur DÉJÀ posée n'est jamais réécrite (une correction admin survit
 *    au déploiement suivant) ;
 *  - la catégorie des pouvoirs de Star Player n'est reprise que si elle vaut
 *    encore l'ancienne valeur historique (`Trait`), pour la même raison.
 *
 * `write: false` (défaut) = rapport de diff, aucune écriture.
 */

import {
  bigGuyLimitForRoster,
  getPositionNameEn,
  RULESETS,
  STAR_PLAYER_PAIR_PARTNERS,
  STAR_PLAYER_RULE_CATEGORY,
  STAR_PLAYER_RULE_SLUGS,
  type Ruleset,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

/** Catégorie historique des pouvoirs de Star Player, avant le lot 6.6. */
const LEGACY_STAR_RULE_CATEGORY = "Trait";

export interface SyncCatalogueColumnsOptions {
  /** `false` (défaut) = dry-run : on renvoie ce qui serait écrit. */
  readonly write?: boolean;
}

export interface SyncCatalogueColumnsResult {
  readonly write: boolean;
  /** Postes dont `displayNameEn` a été (ou serait) renseigné. */
  readonly positionNames: number;
  /** Rosters dont `maxBigGuys` a été (ou serait) renseigné. */
  readonly bigGuyLimits: number;
  /** Star Players dont `pairWithSlug` a été (ou serait) renseigné. */
  readonly starPairs: number;
  /** Compétences repassées en catégorie `StarPlayerRule`. */
  readonly starRuleCategories: number;
}

/** `Position.displayNameEn` — nom anglais officiel du poste. */
async function syncPositionNames(write: boolean): Promise<number> {
  const rows = (await prisma.position.findMany({
    where: { displayNameEn: null },
    select: { id: true, slug: true },
  })) as Array<{ id: string; slug: string }>;

  let touched = 0;
  for (const row of rows) {
    const nameEn = getPositionNameEn(row.slug);
    if (!nameEn) continue;
    touched++;
    if (write) {
      await prisma.position.update({
        where: { id: row.id },
        data: { displayNameEn: nameEn },
      });
    }
  }
  return touched;
}

/** `Roster.maxBigGuys` — plafond combiné de Gros Bras. */
async function syncBigGuyLimits(write: boolean): Promise<number> {
  const rows = (await prisma.roster.findMany({
    where: { maxBigGuys: null },
    select: { id: true, slug: true },
  })) as Array<{ id: string; slug: string }>;

  let touched = 0;
  for (const row of rows) {
    const limit = bigGuyLimitForRoster(row.slug);
    // `null` = pas de plafond combiné : on laisse la colonne nulle, qui
    // signifie exactement la même chose (et garde le repli moteur vrai).
    if (limit === null) continue;
    touched++;
    if (write) {
      await prisma.roster.update({
        where: { id: row.id },
        data: { maxBigGuys: limit },
      });
    }
  }
  return touched;
}

/** `StarPlayer.pairWithSlug` — partenaire obligatoire. */
async function syncStarPairs(write: boolean): Promise<number> {
  const model = (prisma as unknown as { starPlayer?: unknown }).starPlayer;
  if (!model) return 0;

  let touched = 0;
  for (const ruleset of RULESETS as readonly Ruleset[]) {
    for (const [slug, partner] of Object.entries(STAR_PLAYER_PAIR_PARTNERS)) {
      const existing = (await prisma.starPlayer.findUnique({
        where: { slug_ruleset: { slug, ruleset } },
        select: { id: true, pairWithSlug: true },
      })) as { id: string; pairWithSlug: string | null } | null;
      if (!existing || existing.pairWithSlug) continue;
      // Le partenaire doit exister dans la MÊME édition, sinon la paire
      // serait invalide (une star Saison 3 n'est pas engageable en Saison 2).
      const partnerRow = await prisma.starPlayer.findUnique({
        where: { slug_ruleset: { slug: partner, ruleset } },
        select: { id: true },
      });
      if (!partnerRow) continue;
      touched++;
      if (write) {
        await prisma.starPlayer.update({
          where: { id: existing.id },
          data: { pairWithSlug: partner },
        });
      }
    }
  }
  return touched;
}

/** `Skill.category` — les 10 pouvoirs de Star Player quittent « Trait ». */
async function syncStarRuleCategories(write: boolean): Promise<number> {
  const slugs = [...STAR_PLAYER_RULE_SLUGS];
  const rows = (await prisma.skill.findMany({
    where: { slug: { in: slugs }, category: LEGACY_STAR_RULE_CATEGORY },
    select: { id: true },
  })) as Array<{ id: string }>;

  if (write && rows.length > 0) {
    await prisma.skill.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { category: STAR_PLAYER_RULE_CATEGORY },
    });
  }
  return rows.length;
}

export async function syncCatalogueColumns(
  options: SyncCatalogueColumnsOptions = {},
): Promise<SyncCatalogueColumnsResult> {
  const write = options.write === true;
  const result = {
    write,
    positionNames: 0,
    bigGuyLimits: 0,
    starPairs: 0,
    starRuleCategories: 0,
  };

  // Chaque volet est isolé : une table absente (miroir SQLite réduit) ou une
  // colonne pas encore poussée ne doit pas faire échouer tout le seed.
  const steps: Array<[keyof SyncCatalogueColumnsResult, () => Promise<number>]> =
    [
      ["positionNames", () => syncPositionNames(write)],
      ["bigGuyLimits", () => syncBigGuyLimits(write)],
      ["starPairs", () => syncStarPairs(write)],
      ["starRuleCategories", () => syncStarRuleCategories(write)],
    ];
  for (const [key, run] of steps) {
    try {
      (result as Record<string, unknown>)[key] = await run();
    } catch (e: unknown) {
      serverLog.error(`[sync-catalogue-columns] étape ${key} ignorée`, e);
    }
  }

  return result;
}
