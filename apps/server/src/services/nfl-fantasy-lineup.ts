/**
 * Service NFL Fantasy Lineup — Phase 2.D.
 *
 * Gestion du lineup hebdo d'une entry :
 *
 *   getLineup       fetch lineup + starters d'une (entry, week)
 *   setLineup       upsert lineup avec starters + captain/vice
 *   lockLineups     bulk lock toutes les lineups d'une week (cron kickoff)
 *   isLineupLocked  helper read-only
 *
 * Regles V1 :
 *   - Tous les starters doivent etre dans le NflFantasyRoster de l'entry
 *   - Pas de doublons playerId dans les starters
 *   - captainId et viceCaptainId doivent etre dans les starters et
 *     differents l'un de l'autre
 *   - 11 starters obligatoires (taille validee mais configurable via opts)
 *   - Le lineup ne peut etre modifie une fois `lockedAt` set
 *
 * Cote phase 2.E, `settleNflFantasyWeek` lit ces lineups + leurs
 * starters pour calculer le SPP par matchup.
 */

import type { NflFantasyLineup, NflFantasyLineupStarter } from "@prisma/client";

import { prisma } from "../prisma";

// ────────────────────────────────────────────────────────────────────
// Erreur typee
// ────────────────────────────────────────────────────────────────────

export type NflFantasyLineupErrorCode =
  | "ENTRY_NOT_FOUND"
  | "LINEUP_LOCKED"
  | "INVALID_STARTERS"
  | "PLAYER_NOT_ON_ROSTER"
  | "DUPLICATE_PLAYER"
  | "CAPTAIN_NOT_IN_STARTERS"
  | "VICE_NOT_IN_STARTERS"
  | "CAPTAIN_EQUALS_VICE"
  | "INVALID_LINEUP_SIZE";

export class NflFantasyLineupError extends Error {
  constructor(
    public readonly code: NflFantasyLineupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NflFantasyLineupError";
  }
}

// ────────────────────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────────────────────

export const DEFAULT_STARTERS_COUNT = 11;
export const CAPTAIN_MULTIPLIER = 1.5; // Q3
export const VICE_CAPTAIN_MULTIPLIER = 1.2; // Q3

// ────────────────────────────────────────────────────────────────────
// Types publics
// ────────────────────────────────────────────────────────────────────

export interface LineupStarterInput {
  readonly playerId: string;
  readonly bbPosition: string;
}

export interface SetLineupOpts {
  readonly entryId: string;
  readonly weekId: string;
  readonly starters: ReadonlyArray<LineupStarterInput>;
  readonly captainId: string | null;
  readonly viceCaptainId?: string | null;
  /**
   * Override de la taille requise. Default 11. Permet aux tests / V2
   * variantes (ex: 9 vs 13) de modifier sans changer le service.
   */
  readonly startersCount?: number;
}

export interface LineupWithStarters extends NflFantasyLineup {
  starters: NflFantasyLineupStarter[];
}

// ────────────────────────────────────────────────────────────────────
// Helpers purs
// ────────────────────────────────────────────────────────────────────

/**
 * Verifie la coherence captain/vice/starters. Pur, ne touche pas la DB.
 * @throws NflFantasyLineupError
 */
export function validateLineupStructure(opts: {
  starters: ReadonlyArray<LineupStarterInput>;
  captainId: string | null;
  viceCaptainId?: string | null;
  startersCount?: number;
}): void {
  const expectedSize = opts.startersCount ?? DEFAULT_STARTERS_COUNT;
  if (opts.starters.length !== expectedSize) {
    throw new NflFantasyLineupError(
      "INVALID_LINEUP_SIZE",
      `Lineup doit contenir exactement ${expectedSize} starters (recu ${opts.starters.length})`,
    );
  }

  const ids = new Set<string>();
  for (const s of opts.starters) {
    if (!s.playerId || !s.bbPosition) {
      throw new NflFantasyLineupError(
        "INVALID_STARTERS",
        "Chaque starter requiert playerId + bbPosition",
      );
    }
    if (ids.has(s.playerId)) {
      throw new NflFantasyLineupError(
        "DUPLICATE_PLAYER",
        `Player ${s.playerId} present plusieurs fois dans le lineup`,
      );
    }
    ids.add(s.playerId);
  }

  if (opts.captainId !== null && !ids.has(opts.captainId)) {
    throw new NflFantasyLineupError(
      "CAPTAIN_NOT_IN_STARTERS",
      `Captain ${opts.captainId} doit etre dans les starters`,
    );
  }

  if (
    opts.viceCaptainId != null &&
    opts.viceCaptainId !== "" &&
    !ids.has(opts.viceCaptainId)
  ) {
    throw new NflFantasyLineupError(
      "VICE_NOT_IN_STARTERS",
      `Vice-captain ${opts.viceCaptainId} doit etre dans les starters`,
    );
  }

  if (
    opts.captainId !== null &&
    opts.viceCaptainId != null &&
    opts.viceCaptainId !== "" &&
    opts.captainId === opts.viceCaptainId
  ) {
    throw new NflFantasyLineupError(
      "CAPTAIN_EQUALS_VICE",
      "Captain et vice-captain doivent etre differents",
    );
  }
}

// ────────────────────────────────────────────────────────────────────
// API
// ────────────────────────────────────────────────────────────────────

/**
 * Fetch lineup + starters d'une (entry, week). Retourne null si pas
 * encore cree (lineup hebdo libre tant qu'aucun setLineup).
 */
export async function getLineup(opts: {
  entryId: string;
  weekId: string;
}): Promise<LineupWithStarters | null> {
  return prisma.nflFantasyLineup.findUnique({
    where: { entryId_weekId: { entryId: opts.entryId, weekId: opts.weekId } },
    include: { starters: true },
  });
}

/**
 * Upsert le lineup d'une (entry, week).
 *
 *   - Valide structure (taille, doublons, captain/vice presents)
 *   - Verifie que tous les starters sont sur le roster de l'entry
 *   - Refuse si lineup deja locked
 *   - Remplace integralement les starters (atomique via transaction)
 *
 * @throws NflFantasyLineupError pour toutes les violations
 */
export async function setLineup(opts: SetLineupOpts): Promise<LineupWithStarters> {
  validateLineupStructure(opts);

  const entry = await prisma.nflFantasyEntry.findUnique({
    where: { id: opts.entryId },
  });
  if (!entry) {
    throw new NflFantasyLineupError(
      "ENTRY_NOT_FOUND",
      `Entry ${opts.entryId} introuvable`,
    );
  }

  const existing = await prisma.nflFantasyLineup.findUnique({
    where: { entryId_weekId: { entryId: opts.entryId, weekId: opts.weekId } },
  });
  if (existing?.lockedAt) {
    throw new NflFantasyLineupError(
      "LINEUP_LOCKED",
      `Lineup (entry ${opts.entryId}, week ${opts.weekId}) deja locked au ${existing.lockedAt.toISOString()}`,
    );
  }

  // Verifie que tous les starters sont sur le roster
  const rosterRows = await prisma.nflFantasyRoster.findMany({
    where: {
      entryId: opts.entryId,
      playerId: { in: opts.starters.map((s) => s.playerId) },
    },
    select: { playerId: true },
  });
  const onRoster = new Set(rosterRows.map((r) => r.playerId));
  for (const s of opts.starters) {
    if (!onRoster.has(s.playerId)) {
      throw new NflFantasyLineupError(
        "PLAYER_NOT_ON_ROSTER",
        `Player ${s.playerId} pas sur le roster de l'entry ${opts.entryId}`,
      );
    }
  }

  // Upsert atomique du lineup + remplacement des starters
  const lineupId = existing?.id;
  const startersData = opts.starters.map((s) => ({
    playerId: s.playerId,
    bbPosition: s.bbPosition,
    isCaptain: opts.captainId === s.playerId,
    isViceCaptain:
      opts.viceCaptainId != null && opts.viceCaptainId === s.playerId,
  }));

  if (lineupId) {
    await prisma.$transaction([
      prisma.nflFantasyLineupStarter.deleteMany({ where: { lineupId } }),
      prisma.nflFantasyLineup.update({
        where: { id: lineupId },
        data: {
          captainId: opts.captainId,
          viceCaptainId: opts.viceCaptainId ?? null,
        },
      }),
      prisma.nflFantasyLineupStarter.createMany({
        data: startersData.map((s) => ({ ...s, lineupId })),
      }),
    ]);
  } else {
    await prisma.nflFantasyLineup.create({
      data: {
        entryId: opts.entryId,
        weekId: opts.weekId,
        captainId: opts.captainId,
        viceCaptainId: opts.viceCaptainId ?? null,
        starters: { create: startersData },
      },
    });
  }

  const out = await prisma.nflFantasyLineup.findUnique({
    where: { entryId_weekId: { entryId: opts.entryId, weekId: opts.weekId } },
    include: { starters: true },
  });
  if (!out) {
    // Devrait etre impossible (on vient de l'upsert), mais Prisma type
    // exige le null check.
    throw new NflFantasyLineupError(
      "ENTRY_NOT_FOUND",
      "lineup upsert incoherent",
    );
  }
  return out;
}

/**
 * Lock toutes les lineups d'une week qui ne sont pas encore lockees.
 * Idempotent (les lineups deja lockees restent inchangees).
 *
 * Appelle typiquement par le cron Sunday 17:00 ET (kickoff games).
 */
export async function lockLineups(weekId: string): Promise<{ locked: number }> {
  const now = new Date();
  const result = await prisma.nflFantasyLineup.updateMany({
    where: { weekId, lockedAt: null },
    data: { lockedAt: now },
  });
  return { locked: result.count };
}

/**
 * Helper read-only.
 */
export async function isLineupLocked(opts: {
  entryId: string;
  weekId: string;
}): Promise<boolean> {
  const lineup = await prisma.nflFantasyLineup.findUnique({
    where: { entryId_weekId: { entryId: opts.entryId, weekId: opts.weekId } },
    select: { lockedAt: true },
  });
  return lineup?.lockedAt != null;
}
