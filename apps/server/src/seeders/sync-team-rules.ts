/**
 * Amorçage des catalogues `TeamSpecialRule` et `RegionalLeague` depuis les
 * catalogues du moteur (lot 6.5).
 *
 * Les deux tables existaient mais restaient vides en dehors d'un script
 * manuel Saison 3 : le produit servait les libellés compilés. Elles sont
 * maintenant lues en priorité (`services/team-rules-catalogue`), donc le
 * déploiement doit les peupler.
 *
 * « Create-if-missing » : une ligne déjà présente n'est JAMAIS réécrite —
 * une description corrigée en admin survit au déploiement suivant.
 * `force: true` réinitialise une ligne depuis le catalogue du moteur.
 */

import {
  REGIONAL_LEAGUES,
  RULESETS,
  TEAM_SPECIAL_RULES,
  type Ruleset,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { invalidateTeamRulesCatalogueCache } from "../services/team-rules-catalogue";

export interface SyncTeamRulesOptions {
  /** `false` (défaut) = dry-run : on renvoie ce qui serait écrit. */
  readonly write?: boolean;
  /** Réécrit les lignes existantes depuis le catalogue du moteur. */
  readonly force?: boolean;
  /** Limite l'opération à une édition. */
  readonly ruleset?: Ruleset;
}

export interface SyncTeamRulesResult {
  readonly write: boolean;
  readonly specialRules: { created: number; updated: number; skipped: number };
  readonly regionalLeagues: {
    created: number;
    updated: number;
    skipped: number;
  };
}

interface CatalogueRow {
  slug: string;
  nameFr: string;
  nameEn: string;
  description: string;
  descriptionEn?: string;
}

async function syncTable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  rows: readonly CatalogueRow[],
  rulesets: readonly Ruleset[],
  write: boolean,
  force: boolean,
): Promise<{ created: number; updated: number; skipped: number }> {
  const counts = { created: 0, updated: 0, skipped: 0 };
  for (const ruleset of rulesets) {
    for (const row of rows) {
      const data = {
        nameFr: row.nameFr,
        nameEn: row.nameEn,
        description: row.description,
        descriptionEn: row.descriptionEn ?? null,
      };
      const existing = await model.findUnique({
        where: { slug_ruleset: { slug: row.slug, ruleset } },
        select: { id: true },
      });
      if (!existing) {
        counts.created++;
        if (write) {
          await model.create({ data: { slug: row.slug, ruleset, ...data } });
        }
        continue;
      }
      if (force) {
        counts.updated++;
        if (write) await model.update({ where: { id: existing.id }, data });
        continue;
      }
      counts.skipped++;
    }
  }
  return counts;
}

export async function syncTeamRules(
  options: SyncTeamRulesOptions = {},
): Promise<SyncTeamRulesResult> {
  const write = options.write === true;
  const force = options.force === true;
  const rulesets = options.ruleset
    ? [options.ruleset]
    : (RULESETS as readonly Ruleset[]);

  const specialRules = await syncTable(
    prisma.teamSpecialRule,
    TEAM_SPECIAL_RULES,
    rulesets,
    write,
    force,
  );
  const regionalLeagues = await syncTable(
    prisma.regionalLeague,
    REGIONAL_LEAGUES,
    rulesets,
    write,
    force,
  );

  if (
    write &&
    specialRules.created + specialRules.updated
    + regionalLeagues.created + regionalLeagues.updated >
      0
  ) {
    invalidateTeamRulesCatalogueCache();
  }

  return { write, specialRules, regionalLeagues };
}
