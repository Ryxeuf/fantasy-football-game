/**
 * Barème d'avancement — servi par la BASE, PAR ÉDITION (lot 6.2).
 *
 * `utils/advancements.ts` décrit la Saison 3 et était appliqué à TOUTES les
 * équipes : une équipe Saison 2 payait ses compétences aux coûts PSP de la
 * Saison 3 et voyait sa VE augmenter selon les surcoûts S3. Le barème est
 * maintenant une donnée par édition (`AdvancementCost`, `CharacteristicValue`,
 * `RulesetConfig`), résolue ici et passée au moteur, qui reste pur.
 *
 * Même posture que les autres référentiels : la base fait foi, le barème
 * compilé est le REPLI journalisé — sans ligne pour une édition, le
 * comportement est EXACTEMENT celui d'avant le lot (aucun backfill requis).
 */

import {
  DEFAULT_ADVANCEMENT_SCHEDULE,
  DEFAULT_RULESET,
  type AdvancementSchedule,
  type CharacteristicKind,
  type Ruleset,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

const TTL_MS = process.env.NODE_ENV === "production" ? 5 * 60 * 1000 : 0;

const cache = new Map<string, { value: AdvancementSchedule; expiresAt: number }>();

/** À appeler après toute écriture admin sur le barème. */
export function invalidateAdvancementScheduleCache(): void {
  cache.clear();
}

/**
 * `AdvancementKind` (base, snake_case) ↔ `AdvancementType` (moteur,
 * kebab-case). Les deux vocabulaires existaient déjà ; on ne renomme ni l'un
 * ni l'autre, on traduit à la frontière.
 */
const KIND_TO_TYPE: Readonly<Record<string, string>> = {
  primary: "primary",
  secondary: "secondary",
  random_primary: "random-primary",
  random_secondary: "random-secondary",
  characteristic: "characteristic",
};

export const TYPE_TO_KIND: Readonly<Record<string, string>> = Object.entries(
  KIND_TO_TYPE,
).reduce<Record<string, string>>((acc, [kind, type]) => {
  acc[type] = kind;
  return acc;
}, {});

const STATS: readonly CharacteristicKind[] = ["ma", "st", "ag", "pa", "av"];

export interface AdvancementCostRow {
  kind: string;
  step: number;
  sppCost: number;
  teamValueSurcharge: number;
}

export interface CharacteristicValueRow {
  stat: string;
  surcharge: number;
}

/**
 * Construit un barème depuis les lignes de la base.
 *
 * Une COLONNE incomplète (un palier manquant) fait retomber CE type sur la
 * table compilée : servir un barème à trous rendrait un avancement gratuit ou
 * ferait diverger deux écrans sur le même joueur. 100 % pur, testable sans
 * Prisma.
 */
export function buildSchedule(
  costs: readonly AdvancementCostRow[],
  characteristics: readonly CharacteristicValueRow[],
  eliteSkillSurcharge: number | null | undefined,
): AdvancementSchedule {
  const sppCost: Record<string, readonly number[]> = {
    ...DEFAULT_ADVANCEMENT_SCHEDULE.sppCost,
  };
  const surcharge: Record<string, number> = {
    ...DEFAULT_ADVANCEMENT_SCHEDULE.surcharge,
  };

  const byKind = new Map<string, AdvancementCostRow[]>();
  for (const row of costs) {
    const list = byKind.get(row.kind) ?? [];
    list.push(row);
    byKind.set(row.kind, list);
  }

  for (const [kind, rows] of byKind) {
    const type = KIND_TO_TYPE[kind];
    if (!type) continue;
    const table = [0, 0, 0, 0, 0, 0, 0];
    let complete = true;
    for (let step = 1; step <= 6; step++) {
      const row = rows.find((r) => r.step === step);
      if (!row) {
        complete = false;
        break;
      }
      table[step] = row.sppCost;
    }
    if (!complete) {
      serverLog.warn(
        `[advancement-schedule] barème incomplet pour « ${kind} » — repli sur la table compilée`,
      );
      continue;
    }
    sppCost[type] = table;
    // Le surcoût de VE ne dépend pas du palier : on prend celui du 1er.
    const first = rows.find((r) => r.step === 1);
    if (first && type !== "characteristic") {
      surcharge[type] = first.teamValueSurcharge;
    }
  }

  const characteristicSurcharge = {
    ...DEFAULT_ADVANCEMENT_SCHEDULE.characteristicSurcharge,
  };
  for (const row of characteristics) {
    if (!STATS.includes(row.stat as CharacteristicKind)) continue;
    if (!Number.isInteger(row.surcharge) || row.surcharge < 0) continue;
    characteristicSurcharge[row.stat as CharacteristicKind] = row.surcharge;
  }

  return {
    sppCost,
    surcharge,
    characteristicSurcharge,
    eliteSkillSurcharge:
      typeof eliteSkillSurcharge === "number" && eliteSkillSurcharge >= 0
        ? eliteSkillSurcharge
        : DEFAULT_ADVANCEMENT_SCHEDULE.eliteSkillSurcharge,
  };
}

/**
 * Barème résolu d'une édition. Ne lève jamais : toute lecture en échec sert
 * le barème compilé, sinon une validation de feuille de match tomberait sur
 * une base indisponible.
 */
export async function loadAdvancementSchedule(
  ruleset: Ruleset = DEFAULT_RULESET,
): Promise<AdvancementSchedule> {
  const cached = cache.get(ruleset);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value = DEFAULT_ADVANCEMENT_SCHEDULE;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as unknown as Record<string, any>;
    const [costs, characteristics, config] = await Promise.all([
      db.advancementCost?.findMany({
        where: { ruleset },
        select: {
          kind: true,
          step: true,
          sppCost: true,
          teamValueSurcharge: true,
        },
      }),
      db.characteristicValue?.findMany({
        where: { ruleset },
        select: { stat: true, surcharge: true },
      }),
      db.rulesetConfig?.findUnique({
        where: { ruleset },
        select: { eliteSkillSurcharge: true },
      }),
    ]);

    const hasCosts = Array.isArray(costs) && costs.length > 0;
    const hasChars = Array.isArray(characteristics) && characteristics.length > 0;
    if (hasCosts || hasChars || config) {
      value = buildSchedule(
        hasCosts ? costs : [],
        hasChars ? characteristics : [],
        config?.eliteSkillSurcharge,
      );
    } else {
      serverLog.warn(
        `[advancement-schedule] aucun barème en base pour ${ruleset} — repli sur la table compilée`,
      );
    }
  } catch (e: unknown) {
    serverLog.error(
      `[advancement-schedule] lecture en base impossible (${ruleset}) — repli compilé`,
      e,
    );
  }

  cache.set(ruleset, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

/**
 * Barème de l'édition d'une ÉQUIPE. Raccourci pour les services qui n'ont
 * que le `teamId` sous la main. Tolérant : équipe introuvable ou base
 * indisponible ⇒ barème par défaut.
 */
export async function loadScheduleForTeam(
  teamId: string | null | undefined,
): Promise<AdvancementSchedule> {
  if (!teamId) return loadAdvancementSchedule();
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { ruleset: true },
    });
    return loadAdvancementSchedule((team?.ruleset as Ruleset) ?? undefined);
  } catch {
    return loadAdvancementSchedule();
  }
}
