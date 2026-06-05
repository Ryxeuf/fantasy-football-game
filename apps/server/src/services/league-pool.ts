/**
 * Lot C — Service de gestion des poules (groups) d'une saison.
 *
 * Une poule est une subdivision d'une saison : un sous-groupe de
 * participants qui joue son propre round-robin et qualifie ses N
 * premieres equipes en playoffs (`qualifiesForPlayoffs`).
 *
 * Comportement legacy preserve : une saison sans poule continue de
 * fonctionner comme avant (single-pool implicite). Quand la
 * premiere poule est creee, le commissaire assigne les participants
 * via `assignParticipantsToPools` ; le scheduler (`league-scheduler`)
 * sera adapte dans un sous-lot ulterieur pour generer un calendrier
 * par poule.
 *
 * Garde-fous :
 *   - Les poules ne peuvent etre modifiees qu'avant le demarrage
 *     de la saison (status='draft' ou 'scheduled').
 *   - Le nom doit etre unique au sein d'une saison.
 *   - L'assignation des participants verifie qu'ils appartiennent
 *     bien a la saison.
 */

import { prisma } from "../prisma";

export class LeaguePoolError extends Error {
  constructor(
    public readonly code:
      | "season_not_found"
      | "season_started"
      | "pool_not_found"
      | "pool_name_taken"
      | "pool_not_empty"
      | "participant_not_found"
      | "participant_not_in_season",
    message: string,
  ) {
    super(message);
    this.name = "LeaguePoolError";
  }
}

export interface CreatePoolInput {
  seasonId: string;
  name: string;
  qualifiesForPlayoffs?: number;
  color?: string | null;
  order?: number;
}

export interface UpdatePoolInput {
  poolId: string;
  name?: string;
  qualifiesForPlayoffs?: number;
  color?: string | null;
  order?: number;
}

const MAX_POOL_NAME_LENGTH = 60;
const MIN_QUALIFIES = 0;
const MAX_QUALIFIES = 128;

function validateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new LeaguePoolError(
      "pool_name_taken",
      "Le nom de la poule est obligatoire",
    );
  }
  if (trimmed.length > MAX_POOL_NAME_LENGTH) {
    throw new LeaguePoolError(
      "pool_name_taken",
      `Le nom de la poule ne peut depasser ${MAX_POOL_NAME_LENGTH} caracteres`,
    );
  }
  return trimmed;
}

function clampQualifies(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.min(MAX_QUALIFIES, Math.max(MIN_QUALIFIES, Math.floor(raw)));
}

async function ensureSeasonEditable(seasonId: string) {
  const season = await prisma.leagueSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, status: true },
  });
  if (!season) {
    throw new LeaguePoolError(
      "season_not_found",
      `Saison introuvable: ${seasonId}`,
    );
  }
  if (season.status !== "draft" && season.status !== "scheduled") {
    throw new LeaguePoolError(
      "season_started",
      "Saison demarree : les poules ne peuvent plus etre modifiees",
    );
  }
  return season;
}

/**
 * Crée une nouvelle poule pour la saison. L'ordre est attribue
 * automatiquement (max+1) si non fourni.
 */
export async function createPool(input: CreatePoolInput) {
  await ensureSeasonEditable(input.seasonId);
  const name = validateName(input.name);

  // Doublon de nom.
  const existing = await prisma.leaguePool.findFirst({
    where: { seasonId: input.seasonId, name },
    select: { id: true },
  });
  if (existing) {
    throw new LeaguePoolError(
      "pool_name_taken",
      "Une poule portant ce nom existe deja",
    );
  }

  let order = input.order;
  if (order === undefined) {
    const last = await prisma.leaguePool.findFirst({
      where: { seasonId: input.seasonId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    order = (last?.order ?? -1) + 1;
  }

  return prisma.leaguePool.create({
    data: {
      seasonId: input.seasonId,
      name,
      order,
      color: input.color ?? null,
      qualifiesForPlayoffs: clampQualifies(input.qualifiesForPlayoffs),
    },
  });
}

/** Liste les poules d'une saison, ordonnees par `order` croissant. */
export async function listPoolsForSeason(seasonId: string) {
  return prisma.leaguePool.findMany({
    where: { seasonId },
    orderBy: { order: "asc" },
    include: {
      _count: { select: { participants: true } },
    },
  });
}

/** Met a jour une poule (nom, couleur, qualif, ordre). */
export async function updatePool(input: UpdatePoolInput) {
  const pool = await prisma.leaguePool.findUnique({
    where: { id: input.poolId },
    select: { id: true, seasonId: true, name: true },
  });
  if (!pool) {
    throw new LeaguePoolError(
      "pool_not_found",
      `Poule introuvable: ${input.poolId}`,
    );
  }
  await ensureSeasonEditable(pool.seasonId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};

  if (input.name !== undefined) {
    const newName = validateName(input.name);
    if (newName !== pool.name) {
      const dup = await prisma.leaguePool.findFirst({
        where: {
          seasonId: pool.seasonId,
          name: newName,
          id: { not: pool.id },
        },
        select: { id: true },
      });
      if (dup) {
        throw new LeaguePoolError(
          "pool_name_taken",
          "Une poule portant ce nom existe deja",
        );
      }
    }
    data.name = newName;
  }
  if (input.qualifiesForPlayoffs !== undefined) {
    data.qualifiesForPlayoffs = clampQualifies(input.qualifiesForPlayoffs);
  }
  if (input.color !== undefined) {
    data.color = input.color;
  }
  if (input.order !== undefined) {
    data.order = input.order;
  }

  return prisma.leaguePool.update({
    where: { id: input.poolId },
    data,
  });
}

/**
 * Supprime une poule — refuse si des participants y sont encore
 * affectes. Le commissaire doit d'abord les reassigner / desaffecter.
 */
export async function deletePool(input: { poolId: string }) {
  const pool = await prisma.leaguePool.findUnique({
    where: { id: input.poolId },
    select: {
      id: true,
      seasonId: true,
      _count: { select: { participants: true } },
    },
  });
  if (!pool) {
    throw new LeaguePoolError(
      "pool_not_found",
      `Poule introuvable: ${input.poolId}`,
    );
  }
  await ensureSeasonEditable(pool.seasonId);
  if (pool._count.participants > 0) {
    throw new LeaguePoolError(
      "pool_not_empty",
      "Poule non vide : reassignez ou retirez les participants avant suppression",
    );
  }
  await prisma.leaguePool.delete({ where: { id: input.poolId } });
  return { deleted: true };
}

export interface AssignmentSpec {
  /** ID du LeagueParticipant. */
  participantId: string;
  /** poolId cible ; null pour desaffecter de toute poule. */
  poolId: string | null;
}

/**
 * Assigne en masse des participants a des poules. Verifie que tous
 * les participants appartiennent bien a la saison cible. Les poules
 * referencees doivent appartenir a la meme saison.
 *
 * Atomique : utilise prisma.$transaction.
 */
export async function assignParticipantsToPools(input: {
  seasonId: string;
  assignments: ReadonlyArray<AssignmentSpec>;
}) {
  await ensureSeasonEditable(input.seasonId);

  if (input.assignments.length === 0) {
    return { updated: 0 };
  }

  const participantIds = input.assignments.map((a) => a.participantId);
  const participants = (await prisma.leagueParticipant.findMany({
    where: { id: { in: participantIds } },
    select: { id: true, seasonId: true },
  })) as Array<{ id: string; seasonId: string }>;
  const known = new Map<string, string>(
    participants.map((p) => [p.id, p.seasonId]),
  );

  for (const a of input.assignments) {
    const sid = known.get(a.participantId);
    if (!sid) {
      throw new LeaguePoolError(
        "participant_not_found",
        `Participant introuvable: ${a.participantId}`,
      );
    }
    if (sid !== input.seasonId) {
      throw new LeaguePoolError(
        "participant_not_in_season",
        `Participant ${a.participantId} hors de la saison ${input.seasonId}`,
      );
    }
  }

  // Validite des poolId references.
  const poolIds = Array.from(
    new Set(
      input.assignments
        .map((a) => a.poolId)
        .filter((p): p is string => typeof p === "string"),
    ),
  );
  if (poolIds.length > 0) {
    const pools = await prisma.leaguePool.findMany({
      where: { id: { in: poolIds } },
      select: { id: true, seasonId: true },
    });
    if (pools.length !== poolIds.length) {
      throw new LeaguePoolError("pool_not_found", "Une des poules est introuvable");
    }
    for (const p of pools) {
      if (p.seasonId !== input.seasonId) {
        throw new LeaguePoolError(
          "pool_not_found",
          "Une des poules n'appartient pas a la saison cible",
        );
      }
    }
  }

  // Update batch.
  await prisma.$transaction(
    input.assignments.map((a) =>
      prisma.leagueParticipant.update({
        where: { id: a.participantId },
        data: { poolId: a.poolId },
      }),
    ),
  );
  return { updated: input.assignments.length };
}

/**
 * Repartit equitablement les participants actifs sur les poules
 * disponibles en alternant "snake" (1->A, 2->B, 3->C, 4->C, 5->B,
 * 6->A...). Utilise l'ordre par `joinedAt ASC` pour le determinisme.
 *
 * No-op si aucune poule n'existe (le commissaire doit d'abord
 * creer ses poules).
 */
export async function autoAssignBySnakeDraft(input: { seasonId: string }) {
  await ensureSeasonEditable(input.seasonId);

  const pools = await prisma.leaguePool.findMany({
    where: { seasonId: input.seasonId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  if (pools.length === 0) {
    return { assigned: 0, note: "no-pools" };
  }

  const participants = (await prisma.leagueParticipant.findMany({
    where: { seasonId: input.seasonId, status: "active" },
    orderBy: { joinedAt: "asc" },
    select: { id: true },
  })) as Array<{ id: string }>;

  // Snake : 1->0, 2->1, 3->2, 4->2, 5->1, 6->0, 7->0, 8->1, ...
  const assignments: AssignmentSpec[] = participants.map((p: { id: string }, idx: number) => {
    const cycle = Math.floor(idx / pools.length);
    const stepInCycle = idx % pools.length;
    const poolIndex =
      cycle % 2 === 0 ? stepInCycle : pools.length - 1 - stepInCycle;
    return { participantId: p.id, poolId: pools[poolIndex].id };
  });

  await prisma.$transaction(
    assignments.map((a) =>
      prisma.leagueParticipant.update({
        where: { id: a.participantId },
        data: { poolId: a.poolId },
      }),
    ),
  );
  return { assigned: assignments.length };
}

/**
 * Helper pur (testable sans Prisma) : produit la repartition snake
 * sans toucher la DB. Utile pour preview UI / tests unitaires.
 */
export function computeSnakeDraftAssignment(
  participantIds: ReadonlyArray<string>,
  poolIds: ReadonlyArray<string>,
): AssignmentSpec[] {
  if (poolIds.length === 0) return [];
  return participantIds.map((pid, idx) => {
    const cycle = Math.floor(idx / poolIds.length);
    const stepInCycle = idx % poolIds.length;
    const poolIndex =
      cycle % 2 === 0 ? stepInCycle : poolIds.length - 1 - stepInCycle;
    return { participantId: pid, poolId: poolIds[poolIndex] };
  });
}
