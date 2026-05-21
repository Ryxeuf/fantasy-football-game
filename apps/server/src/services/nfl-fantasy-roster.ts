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

import type { NflFantasyRoster, NflPlayer } from "@prisma/client";

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
 * View pour l'UI : roster + infos NflPlayer joints en JS (NflFantasyRoster
 * n'a pas de FK Prisma vers NflPlayer en V1, on fait le merge cote service).
 *
 * Q8 : on n'expose JAMAIS NflPlayer.realName cote API ; le frontend voit
 * uniquement `pseudonym`. Le champ `realNameDisplay` est expose pour que
 * l'UI sache si elle peut afficher le vrai nom (pivot futur licence NIL).
 * Tant que `realNameDisplay = false`, le `realName` reste interne au backend.
 */
export interface RosterPlayerView {
  rosterId: string;
  acquiredVia: string;
  acquiredAt: Date;
  tvCost: number;
  /** Player info pseudonymisee (pas de realName ici). */
  player: {
    id: NflPlayer["id"];
    pseudonym: NflPlayer["pseudonym"];
    realNameDisplay: NflPlayer["realNameDisplay"];
    teamCode: NflPlayer["teamCode"];
    nflPosition: NflPlayer["nflPosition"];
    bbPosition: NflPlayer["bbPosition"];
    jerseyNumber: NflPlayer["jerseyNumber"];
    status: NflPlayer["status"];
  } | null;
}

export async function getRosterWithPlayers(
  entryId: string,
): Promise<RosterPlayerView[]> {
  const roster: ReadonlyArray<NflFantasyRoster> =
    await prisma.nflFantasyRoster.findMany({
      where: { entryId },
      orderBy: { acquiredAt: "asc" },
    });
  if (roster.length === 0) return [];

  type RosterPlayerRow = Pick<
    NflPlayer,
    | "id"
    | "pseudonym"
    | "realNameDisplay"
    | "teamCode"
    | "nflPosition"
    | "bbPosition"
    | "jerseyNumber"
    | "status"
  >;
  const players: ReadonlyArray<RosterPlayerRow> =
    await prisma.nflPlayer.findMany({
      where: { id: { in: roster.map((r) => r.playerId) } },
      select: {
        id: true,
        pseudonym: true,
        realNameDisplay: true,
        teamCode: true,
        nflPosition: true,
        bbPosition: true,
        jerseyNumber: true,
        status: true,
      },
    });
  const byId = new Map<string, RosterPlayerRow>(
    players.map((p) => [p.id, p] as const),
  );

  return roster.map((r) => ({
    rosterId: r.id,
    acquiredVia: r.acquiredVia,
    acquiredAt: r.acquiredAt,
    tvCost: r.tvCost,
    player: byId.get(r.playerId) ?? null,
  }));
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
