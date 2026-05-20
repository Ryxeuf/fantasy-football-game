/**
 * Service NFL Fantasy Roster — Phase 2.D (minimal).
 *
 * Gestion CRUD du roster d'une entry. Volontairement minimal : le
 * draft (snake / auction / free) sera un service dedie Phase 2.D'.
 * Ici on expose juste add / remove / get + update totalTV.
 *
 * Pattern : idempotent (upsert/skip si deja present), erreurs typees.
 * Pas de validation de "cap salarial" en V1 (Q7 freemium tout gratuit).
 */

import type { NflFantasyRoster } from "@prisma/client";

import { prisma } from "../prisma";

// ────────────────────────────────────────────────────────────────────
// Erreur typee
// ────────────────────────────────────────────────────────────────────

export type NflFantasyRosterErrorCode =
  | "ENTRY_NOT_FOUND"
  | "PLAYER_NOT_FOUND"
  | "PLAYER_ALREADY_ON_ROSTER"
  | "PLAYER_NOT_ON_ROSTER";

export class NflFantasyRosterError extends Error {
  constructor(
    public readonly code: NflFantasyRosterErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NflFantasyRosterError";
  }
}

// ────────────────────────────────────────────────────────────────────
// Types publics
// ────────────────────────────────────────────────────────────────────

export type AcquisitionMode = "draft" | "mercato" | "trade" | "free_agent";

export interface AddPlayerOpts {
  readonly entryId: string;
  readonly playerId: string;
  readonly acquiredVia?: AcquisitionMode;
  readonly tvCost?: number;
}

// ────────────────────────────────────────────────────────────────────
// API
// ────────────────────────────────────────────────────────────────────

/**
 * Ajoute un joueur au roster d'une entry. Throws si entry / player
 * absent ou si deja sur le roster. Met a jour totalTV cote entry.
 */
export async function addPlayerToRoster(
  opts: AddPlayerOpts,
): Promise<NflFantasyRoster> {
  const entry = await prisma.nflFantasyEntry.findUnique({
    where: { id: opts.entryId },
  });
  if (!entry) {
    throw new NflFantasyRosterError(
      "ENTRY_NOT_FOUND",
      `Entry ${opts.entryId} introuvable`,
    );
  }

  const player = await prisma.nflPlayer.findUnique({
    where: { id: opts.playerId },
  });
  if (!player) {
    throw new NflFantasyRosterError(
      "PLAYER_NOT_FOUND",
      `NflPlayer ${opts.playerId} introuvable`,
    );
  }

  const existing = await prisma.nflFantasyRoster.findUnique({
    where: {
      entryId_playerId: { entryId: opts.entryId, playerId: opts.playerId },
    },
  });
  if (existing) {
    throw new NflFantasyRosterError(
      "PLAYER_ALREADY_ON_ROSTER",
      `Player ${opts.playerId} deja sur le roster de l'entry ${opts.entryId}`,
    );
  }

  const tvCost = opts.tvCost ?? 0;
  const acquiredVia = opts.acquiredVia ?? "draft";

  const [, row] = await prisma.$transaction([
    prisma.nflFantasyEntry.update({
      where: { id: opts.entryId },
      data: { totalTV: { increment: tvCost } },
    }),
    prisma.nflFantasyRoster.create({
      data: {
        entryId: opts.entryId,
        playerId: opts.playerId,
        acquiredVia,
        tvCost,
      },
    }),
  ]);
  return row;
}

/**
 * Retire un joueur du roster (mercato / cut). Met a jour totalTV.
 */
export async function removePlayerFromRoster(opts: {
  entryId: string;
  playerId: string;
}): Promise<void> {
  const row = await prisma.nflFantasyRoster.findUnique({
    where: {
      entryId_playerId: { entryId: opts.entryId, playerId: opts.playerId },
    },
  });
  if (!row) {
    throw new NflFantasyRosterError(
      "PLAYER_NOT_ON_ROSTER",
      `Player ${opts.playerId} pas sur le roster de l'entry ${opts.entryId}`,
    );
  }

  await prisma.$transaction([
    prisma.nflFantasyRoster.delete({ where: { id: row.id } }),
    prisma.nflFantasyEntry.update({
      where: { id: opts.entryId },
      data: { totalTV: { decrement: row.tvCost } },
    }),
  ]);
}

/**
 * Liste le roster d'une entry, tri par acquiredAt asc.
 */
export async function getRoster(entryId: string): Promise<NflFantasyRoster[]> {
  return prisma.nflFantasyRoster.findMany({
    where: { entryId },
    orderBy: { acquiredAt: "asc" },
  });
}

/**
 * True si le joueur est present sur le roster de l'entry.
 */
export async function isPlayerOnRoster(
  entryId: string,
  playerId: string,
): Promise<boolean> {
  const row = await prisma.nflFantasyRoster.findUnique({
    where: { entryId_playerId: { entryId, playerId } },
  });
  return row !== null;
}
