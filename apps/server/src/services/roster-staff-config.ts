/**
 * Résolution de la config staff d'un roster pour un format donné.
 *
 * Source unique côté serveur : lit le modèle Prisma `RosterStaffConfig`
 * (saisi en admin par roster × format) et, à défaut de ligne, retombe sur
 * `defaultStaffConfig` (dérivé des constantes historiques du package pur).
 * Les montants retournés sont en **po entiers** (cohérent avec le modèle DB
 * et `team-value-calculator`).
 *
 * Consommé par les handlers de construction/achat d'équipe et par les routes
 * qui exposent la config au web.
 */

import { prisma } from "../prisma";
import {
  defaultStaffConfig,
  type GameFormat,
  type RosterStaffConfig,
} from "@bb/game-engine";
import type { Ruleset } from "@prisma/client";

const STAFF_SELECT = {
  rerollCost: true,
  maxRerolls: true,
  apothecaryAllowed: true,
  apothecaryCost: true,
  maxCheerleaders: true,
  cheerleaderCost: true,
  maxAssistants: true,
  assistantCost: true,
  maxDedicatedFans: true,
  dedicatedFanCost: true,
} as const;

type StaffRow = { [K in keyof typeof STAFF_SELECT]: number | boolean };

function mapRow(row: StaffRow): RosterStaffConfig {
  return {
    rerollCost: row.rerollCost as number,
    maxRerolls: row.maxRerolls as number,
    apothecaryAllowed: row.apothecaryAllowed as boolean,
    apothecaryCost: row.apothecaryCost as number,
    maxCheerleaders: row.maxCheerleaders as number,
    cheerleaderCost: row.cheerleaderCost as number,
    maxAssistants: row.maxAssistants as number,
    assistantCost: row.assistantCost as number,
    maxDedicatedFans: row.maxDedicatedFans as number,
    dedicatedFanCost: row.dedicatedFanCost as number,
  };
}

/** Config staff résolue à partir d'un `rosterId` (clé DB). */
export async function resolveStaffConfigByRosterId(
  rosterId: string,
  format: GameFormat,
): Promise<RosterStaffConfig> {
  const row = await prisma.rosterStaffConfig.findUnique({
    where: { rosterId_format: { rosterId, format } },
    select: STAFF_SELECT,
  });
  if (row) return mapRow(row as StaffRow);

  // Pas de ligne : dérive le défaut depuis le slug du roster.
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    select: { slug: true },
  });
  return defaultStaffConfig(roster?.slug ?? "", format);
}

/** Config staff résolue à partir d'un `slug` + `ruleset` (ce que les handlers ont). */
export async function resolveStaffConfigBySlug(
  slug: string,
  ruleset: Ruleset,
  format: GameFormat,
): Promise<RosterStaffConfig> {
  const roster = await prisma.roster.findUnique({
    where: { slug_ruleset: { slug, ruleset } },
    select: { id: true, slug: true },
  });
  if (!roster) return defaultStaffConfig(slug, format);

  const row = await prisma.rosterStaffConfig.findUnique({
    where: { rosterId_format: { rosterId: roster.id, format } },
    select: STAFF_SELECT,
  });
  return row ? mapRow(row as StaffRow) : defaultStaffConfig(roster.slug, format);
}
