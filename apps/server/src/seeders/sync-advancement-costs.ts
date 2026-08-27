/**
 * Amorçage du barème d'avancement par édition (lot 6.2).
 *
 * `AdvancementCost` / `CharacteristicValue` / `RulesetConfig` sont lues en
 * priorité par `services/advancement-schedule-repository` ; sans ligne, le
 * barème compilé (Saison 3) s'applique — c'est le comportement d'avant le
 * lot, pour toutes les éditions.
 *
 * ⚠️ SAISON 2 : l'arbitrage du 2026-08-27 demande de faire VALIDER les
 * valeurs du livre 2020 avant de les seeder. Elles sont transcrites ici
 * (`SEASON_2_SCHEDULE`) mais **ne sont pas seedées par défaut** : tant qu'un
 * humain ne les a pas confirmées, une équipe Saison 2 continue de tomber sur
 * le repli compilé, exactement comme aujourd'hui. `rulesets: ["season_2"]`
 * (ou l'action « réinitialiser » de la console) les pose explicitement.
 *
 * « Create-if-missing » : une ligne existante n'est jamais réécrite sans
 * `force` — une correction saisie en admin survit au déploiement suivant.
 */

import {
  CHARACTERISTIC_VALUE_INCREASE,
  DEFAULT_ADVANCEMENT_SCHEDULE,
  ELITE_SKILL_SURCHARGE,
  type CharacteristicKind,
  type Ruleset,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import {
  invalidateAdvancementScheduleCache,
  TYPE_TO_KIND,
} from "../services/advancement-schedule-repository";

/** Barème d'une édition, sous la forme stockée en base. */
export interface SeedSchedule {
  /** kind → coûts PSP des paliers 1..6. */
  readonly sppCost: Readonly<Record<string, readonly number[]>>;
  /** kind → surcoût de VE (po). */
  readonly surcharge: Readonly<Record<string, number>>;
  readonly characteristicSurcharge: Readonly<
    Record<CharacteristicKind, number>
  >;
  readonly eliteSkillSurcharge: number;
}

/** Saison 3 : la transcription compilée, telle qu'appliquée aujourd'hui. */
export const SEASON_3_SCHEDULE: SeedSchedule = {
  sppCost: Object.entries(DEFAULT_ADVANCEMENT_SCHEDULE.sppCost).reduce<
    Record<string, readonly number[]>
  >((acc, [type, table]) => {
    const kind = TYPE_TO_KIND[type];
    if (kind) acc[kind] = table.slice(1);
    return acc;
  }, {}),
  surcharge: Object.entries(DEFAULT_ADVANCEMENT_SCHEDULE.surcharge).reduce<
    Record<string, number>
  >((acc, [type, value]) => {
    const kind = TYPE_TO_KIND[type];
    if (kind) acc[kind] = value;
    return acc;
  }, {}),
  characteristicSurcharge: CHARACTERISTIC_VALUE_INCREASE,
  eliteSkillSurcharge: ELITE_SKILL_SURCHARGE,
};

/**
 * Saison 2 — livre 2020. Valeurs À VALIDER avant seed (cf. en-tête) : la
 * secondaire choisie démarre à 12 (et non 10), l'amélioration de
 * caractéristique suit la colonne 18/20/24/28/32/40, et la « secondaire au
 * hasard » existe encore, à 20 000 po de surcoût.
 */
export const SEASON_2_SCHEDULE: SeedSchedule = {
  sppCost: {
    random_primary: [3, 4, 6, 8, 10, 15],
    primary: [6, 8, 12, 16, 20, 30],
    random_secondary: [6, 8, 12, 16, 20, 30],
    secondary: [12, 14, 18, 22, 26, 40],
    characteristic: [18, 20, 24, 28, 32, 40],
  },
  surcharge: {
    random_primary: 10000,
    primary: 20000,
    random_secondary: 20000,
    secondary: 40000,
  },
  characteristicSurcharge: {
    av: 10000,
    ma: 20000,
    pa: 20000,
    ag: 40000,
    st: 80000,
  },
  eliteSkillSurcharge: 0,
};

export const SCHEDULES: Readonly<Record<Ruleset, SeedSchedule>> = {
  season_2: SEASON_2_SCHEDULE,
  season_3: SEASON_3_SCHEDULE,
};

export interface SyncAdvancementCostsOptions {
  /** `false` (défaut) = dry-run : on renvoie ce qui serait écrit. */
  readonly write?: boolean;
  /** Réécrit les lignes existantes depuis le barème transcrit. */
  readonly force?: boolean;
  /**
   * Éditions à seeder. Défaut : `["season_3"]` — la Saison 2 attend sa
   * validation (cf. en-tête), et sans ligne son comportement est inchangé.
   */
  readonly rulesets?: readonly Ruleset[];
}

export interface SyncAdvancementCostsResult {
  readonly write: boolean;
  readonly rulesets: readonly Ruleset[];
  readonly costsCreated: number;
  readonly costsUpdated: number;
  readonly costsSkipped: number;
  readonly characteristicsCreated: number;
  readonly characteristicsUpdated: number;
  readonly characteristicsSkipped: number;
  readonly configsCreated: number;
  readonly configsUpdated: number;
  readonly configsSkipped: number;
}

const DEFAULT_RULESETS: readonly Ruleset[] = ["season_3"];

export async function syncAdvancementCosts(
  options: SyncAdvancementCostsOptions = {},
): Promise<SyncAdvancementCostsResult> {
  const write = options.write === true;
  const force = options.force === true;
  const rulesets = options.rulesets ?? DEFAULT_RULESETS;

  let costsCreated = 0;
  let costsUpdated = 0;
  let costsSkipped = 0;
  let characteristicsCreated = 0;
  let characteristicsUpdated = 0;
  let characteristicsSkipped = 0;
  let configsCreated = 0;
  let configsUpdated = 0;
  let configsSkipped = 0;

  for (const ruleset of rulesets) {
    const schedule = SCHEDULES[ruleset];
    if (!schedule) continue;

    for (const [kind, table] of Object.entries(schedule.sppCost)) {
      for (const [index, sppCost] of table.entries()) {
        const step = index + 1;
        const data = {
          sppCost,
          teamValueSurcharge: schedule.surcharge[kind] ?? 0,
        };
        const existing = await prisma.advancementCost.findUnique({
          where: {
            ruleset_kind_step: { ruleset, kind: kind as never, step },
          },
          select: { id: true },
        });
        if (!existing) {
          costsCreated++;
          if (write) {
            await prisma.advancementCost.create({
              data: { ruleset, kind: kind as never, step, ...data },
            });
          }
        } else if (force) {
          costsUpdated++;
          if (write) {
            await prisma.advancementCost.update({
              where: { id: existing.id },
              data,
            });
          }
        } else {
          costsSkipped++;
        }
      }
    }

    for (const [stat, surcharge] of Object.entries(
      schedule.characteristicSurcharge,
    )) {
      const existing = await prisma.characteristicValue.findUnique({
        where: { ruleset_stat: { ruleset, stat } },
        select: { id: true },
      });
      if (!existing) {
        characteristicsCreated++;
        if (write) {
          await prisma.characteristicValue.create({
            data: { ruleset, stat, surcharge },
          });
        }
      } else if (force) {
        characteristicsUpdated++;
        if (write) {
          await prisma.characteristicValue.update({
            where: { id: existing.id },
            data: { surcharge },
          });
        }
      } else {
        characteristicsSkipped++;
      }
    }

    const existingConfig = await prisma.rulesetConfig.findUnique({
      where: { ruleset },
      select: { id: true },
    });
    if (!existingConfig) {
      configsCreated++;
      if (write) {
        await prisma.rulesetConfig.create({
          data: {
            ruleset,
            eliteSkillSurcharge: schedule.eliteSkillSurcharge,
          },
        });
      }
    } else if (force) {
      configsUpdated++;
      if (write) {
        await prisma.rulesetConfig.update({
          where: { id: existingConfig.id },
          data: { eliteSkillSurcharge: schedule.eliteSkillSurcharge },
        });
      }
    } else {
      configsSkipped++;
    }
  }

  if (
    write &&
    costsCreated + costsUpdated + characteristicsCreated +
      characteristicsUpdated + configsCreated + configsUpdated >
      0
  ) {
    invalidateAdvancementScheduleCache();
  }

  return {
    write,
    rulesets,
    costsCreated,
    costsUpdated,
    costsSkipped,
    characteristicsCreated,
    characteristicsUpdated,
    characteristicsSkipped,
    configsCreated,
    configsUpdated,
    configsSkipped,
  };
}
