/**
 * Carriere NflFantasy d'un (entryId, playerId).
 *
 * Service simple :
 *   - `accumulateCareerSpp` : appele par settleNflFantasyWeek pour
 *     incrementer `sppCareer` lors d'un settle initial (chaque matchup
 *     est settle une seule fois cf. pattern Q.D.1, donc pas de
 *     risque de double-comptage).
 *   - `getCareerForEntry` : fetch des progressions par entry pour les
 *     pages "carriere du joueur" / future depense de SPP.
 *
 * La depense de SPP (consumeSpp -> unlock skill) est introduite par le
 * commit suivant (etape iii).
 */

import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../prisma";

export interface AccumulateOpts {
  readonly entryId: string;
  readonly playerId: string;
  readonly sppDelta: number;
}

type PrismaLike = PrismaClient | Prisma.TransactionClient;

/**
 * Construit l'operation Prisma `upsert` qui incremente `sppCareer`
 * d'un (entryId, playerId). Aucune execution — caller compose dans
 * une transaction existante ou execute directement.
 *
 * Pur en ce qu'il ne fait que retourner le builder Prisma. Le caller
 * decide de l'ordonnancement (cf. settleNflFantasyWeek inclut ces
 * upserts dans la transaction du matchup pour atomicite).
 */
export function buildAccumulateUpsert(
  client: PrismaLike,
  opts: AccumulateOpts,
) {
  return client.nflFantasyPlayerCareer.upsert({
    where: {
      entryId_playerId: { entryId: opts.entryId, playerId: opts.playerId },
    },
    create: {
      entryId: opts.entryId,
      playerId: opts.playerId,
      sppCareer: opts.sppDelta,
      sppSpent: 0,
      skillsUnlocked: [],
      statsBonus: {},
    },
    update: { sppCareer: { increment: opts.sppDelta } },
  });
}

/**
 * Convenience helper : execute l'upsert hors transaction (cas d'usage
 * back-office / scripts de backfill).
 */
export async function accumulateCareerSpp(
  opts: AccumulateOpts,
): Promise<void> {
  if (opts.sppDelta === 0) return;
  await buildAccumulateUpsert(prisma, opts);
}

export interface CareerRow {
  readonly id: string;
  readonly entryId: string;
  readonly playerId: string;
  readonly sppCareer: number;
  readonly sppSpent: number;
  readonly sppAvailable: number;
  readonly skillsUnlocked: readonly string[];
}

function parseSkillsUnlocked(raw: unknown): readonly string[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Mappe une row brute DB vers le shape API (sppAvailable derive). */
export function mapCareerRow(row: {
  id: string;
  entryId: string;
  playerId: string;
  sppCareer: number;
  sppSpent: number;
  skillsUnlocked: unknown;
}): CareerRow {
  return {
    id: row.id,
    entryId: row.entryId,
    playerId: row.playerId,
    sppCareer: row.sppCareer,
    sppSpent: row.sppSpent,
    sppAvailable: row.sppCareer - row.sppSpent,
    skillsUnlocked: parseSkillsUnlocked(row.skillsUnlocked),
  };
}

/** Liste des carrieres pour une entry (utile pour la page roster). */
export async function listCareersForEntry(
  entryId: string,
): Promise<readonly CareerRow[]> {
  const rows = await prisma.nflFantasyPlayerCareer.findMany({
    where: { entryId },
    select: {
      id: true,
      entryId: true,
      playerId: true,
      sppCareer: true,
      sppSpent: true,
      skillsUnlocked: true,
    },
  });
  return rows.map(mapCareerRow);
}

/** Carriere d'un joueur dans une entry, ou null. */
export async function getCareerForPlayer(opts: {
  entryId: string;
  playerId: string;
}): Promise<CareerRow | null> {
  const row = await prisma.nflFantasyPlayerCareer.findUnique({
    where: {
      entryId_playerId: { entryId: opts.entryId, playerId: opts.playerId },
    },
    select: {
      id: true,
      entryId: true,
      playerId: true,
      sppCareer: true,
      sppSpent: true,
      skillsUnlocked: true,
    },
  });
  return row ? mapCareerRow(row) : null;
}
