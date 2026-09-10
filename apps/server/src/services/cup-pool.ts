/**
 * Poules d'une coupe : des groupes d'inscrits qui s'affrontent entre eux.
 *
 * Miroir de `league-pool`, à trois différences près, toutes dictées par ce
 * qu'est une coupe :
 *
 *  1. **Autorisation** : les coupes passent un `CupActor { userId, isAdmin }`
 *     au service (cf. `cup-rounds`), là où les ligues vérifient le créateur
 *     au niveau de la route. On suit la convention de la maison.
 *  2. **Fenêtre d'édition** : une ligue fige ses poules dès que la saison
 *     démarre. Une coupe n'a pas de statut équivalent — ce qui fige ses
 *     poules, c'est la PREMIÈRE RONDE : les appariements en sont dérivés, les
 *     rejouer après coup produirait un classement incohérent avec l'histoire
 *     déjà écrite. Le garde-fou lit donc l'existence d'une ronde, pas un
 *     statut.
 *  3. **Ordre déterministe** de l'attribution automatique : `CupParticipant`
 *     n'a ni `status` ni `joinedAt` — on trie sur `createdAt` (l'ordre
 *     d'inscription), puis sur l'id pour départager deux inscriptions dans la
 *     même milliseconde.
 */

import { prisma } from "../prisma";
import type { CupActor } from "./cup-rounds";

export type CupPoolErrorCode =
  | "cup_not_found"
  | "forbidden"
  | "cup_started"
  | "cup_closed"
  | "pool_not_found"
  | "pool_name_taken"
  | "pool_not_empty"
  | "participant_not_found"
  | "participant_not_in_cup";

export class CupPoolError extends Error {
  constructor(
    public readonly code: CupPoolErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CupPoolError";
  }
}

/** Nom de poule : non vide, borné, unique dans la coupe. */
function validateName(raw: string): string {
  const name = raw.trim();
  if (name.length === 0) {
    throw new CupPoolError("pool_name_taken", "Le nom de la poule est requis");
  }
  if (name.length > 60) {
    throw new CupPoolError(
      "pool_name_taken",
      "Le nom de la poule ne peut pas dépasser 60 caractères",
    );
  }
  return name;
}

/** Quota de qualifiés : entier borné, jamais négatif. */
function clampQualifies(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return 0;
  return Math.min(128, Math.max(0, Math.floor(raw)));
}

interface CupHeader {
  id: string;
  creatorId: string;
  status: string;
}

async function loadCup(cupId: string): Promise<CupHeader> {
  const cup = (await prisma.cup.findUnique({
    where: { id: cupId },
    select: { id: true, creatorId: true, status: true },
  })) as CupHeader | null;
  if (!cup) throw new CupPoolError("cup_not_found", "Coupe introuvable");
  return cup;
}

function ensureCommissioner(cup: CupHeader, actor: CupActor): void {
  if (cup.creatorId !== actor.userId && !actor.isAdmin) {
    throw new CupPoolError(
      "forbidden",
      "Seul le créateur de la coupe (ou un administrateur) gère les poules",
    );
  }
}

/**
 * Fenêtre d'édition des poules. Une ronde générée a déjà apparié les équipes
 * POULE PAR POULE : rouvrir la composition après coup rendrait le classement
 * incohérent avec les rencontres déjà jouées.
 */
async function ensurePoolsEditable(cup: CupHeader): Promise<void> {
  if (cup.status === "terminee" || cup.status === "archivee") {
    throw new CupPoolError(
      "cup_closed",
      "Coupe terminée : les poules ne sont plus modifiables",
    );
  }
  const rounds = await prisma.cupRound.count({ where: { cupId: cup.id } });
  if (rounds > 0) {
    throw new CupPoolError(
      "cup_started",
      "Une ronde a déjà été générée : les poules ne sont plus modifiables",
    );
  }
}

export interface CupPoolView {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly color: string | null;
  readonly qualifiesForPlayoffs: number;
  readonly participantCount: number;
}

type PoolRow = {
  id: string;
  name: string;
  order: number;
  color: string | null;
  qualifiesForPlayoffs: number;
  _count?: { participants: number };
};

function toView(row: PoolRow): CupPoolView {
  return {
    id: row.id,
    name: row.name,
    order: row.order,
    color: row.color,
    qualifiesForPlayoffs: row.qualifiesForPlayoffs,
    participantCount: row._count?.participants ?? 0,
  };
}

/** Poules d'une coupe, ordonnées. Lecture publique (aucun garde-fou). */
export async function listCupPools(cupId: string): Promise<CupPoolView[]> {
  const rows = (await prisma.cupPool.findMany({
    where: { cupId },
    orderBy: { order: "asc" },
    include: { _count: { select: { participants: true } } },
  })) as PoolRow[];
  return rows.map(toView);
}

export interface CreateCupPoolInput {
  readonly cupId: string;
  readonly actor: CupActor;
  readonly name: string;
  readonly qualifiesForPlayoffs?: number;
  readonly color?: string | null;
  readonly order?: number;
}

export async function createCupPool(
  input: CreateCupPoolInput,
): Promise<CupPoolView> {
  const cup = await loadCup(input.cupId);
  ensureCommissioner(cup, input.actor);
  await ensurePoolsEditable(cup);
  const name = validateName(input.name);

  const existing = await prisma.cupPool.findFirst({
    where: { cupId: cup.id, name },
    select: { id: true },
  });
  if (existing) {
    throw new CupPoolError(
      "pool_name_taken",
      `Une poule « ${name} » existe déjà dans cette coupe`,
    );
  }

  // Ordre auto : à la suite, pour que la création n'impose pas de réfléchir
  // à un rang. Le commissaire peut le corriger ensuite.
  let order = input.order;
  if (order === undefined) {
    const max = (await prisma.cupPool.aggregate({
      where: { cupId: cup.id },
      _max: { order: true },
    })) as { _max: { order: number | null } };
    order = max._max.order === null ? 0 : max._max.order + 1;
  }

  const created = (await prisma.cupPool.create({
    data: {
      cupId: cup.id,
      name,
      order,
      color: input.color ?? null,
      qualifiesForPlayoffs: clampQualifies(input.qualifiesForPlayoffs),
    },
  })) as PoolRow;
  return toView(created);
}

export interface UpdateCupPoolInput {
  readonly poolId: string;
  readonly actor: CupActor;
  readonly name?: string;
  readonly qualifiesForPlayoffs?: number;
  readonly color?: string | null;
  readonly order?: number;
}

export async function updateCupPool(
  input: UpdateCupPoolInput,
): Promise<CupPoolView> {
  const pool = (await prisma.cupPool.findUnique({
    where: { id: input.poolId },
    select: { id: true, cupId: true, name: true },
  })) as { id: string; cupId: string; name: string } | null;
  if (!pool) throw new CupPoolError("pool_not_found", "Poule introuvable");

  const cup = await loadCup(pool.cupId);
  ensureCommissioner(cup, input.actor);
  // Le QUOTA de qualifiés reste modifiable une fois la coupe lancée : il ne
  // change aucun appariement déjà joué, seulement la lecture du bracket à
  // venir. Le reste (nom, ordre, couleur) est cosmétique et suit la même
  // règle. Seule la COMPOSITION est figée par la première ronde.
  if (cup.status === "terminee" || cup.status === "archivee") {
    throw new CupPoolError(
      "cup_closed",
      "Coupe terminée : les poules ne sont plus modifiables",
    );
  }

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = validateName(input.name);
    if (name !== pool.name) {
      const clash = await prisma.cupPool.findFirst({
        where: { cupId: pool.cupId, name, id: { not: pool.id } },
        select: { id: true },
      });
      if (clash) {
        throw new CupPoolError(
          "pool_name_taken",
          `Une poule « ${name} » existe déjà dans cette coupe`,
        );
      }
    }
    data.name = name;
  }
  if (input.qualifiesForPlayoffs !== undefined) {
    data.qualifiesForPlayoffs = clampQualifies(input.qualifiesForPlayoffs);
  }
  if (input.color !== undefined) data.color = input.color;
  if (input.order !== undefined) data.order = input.order;

  const updated = (await prisma.cupPool.update({
    where: { id: pool.id },
    data,
    include: { _count: { select: { participants: true } } },
  })) as PoolRow;
  return toView(updated);
}

export async function deleteCupPool(input: {
  readonly poolId: string;
  readonly actor: CupActor;
}): Promise<{ deleted: true }> {
  const pool = (await prisma.cupPool.findUnique({
    where: { id: input.poolId },
    select: {
      id: true,
      cupId: true,
      _count: { select: { participants: true } },
    },
  })) as { id: string; cupId: string; _count: { participants: number } } | null;
  if (!pool) throw new CupPoolError("pool_not_found", "Poule introuvable");

  const cup = await loadCup(pool.cupId);
  ensureCommissioner(cup, input.actor);
  await ensurePoolsEditable(cup);

  if (pool._count.participants > 0) {
    throw new CupPoolError(
      "pool_not_empty",
      "Poule non vide : réaffectez ou retirez ses équipes avant de la supprimer",
    );
  }
  await prisma.cupPool.delete({ where: { id: pool.id } });
  return { deleted: true };
}

/** Une affectation. `poolId: null` retire l'équipe de sa poule. */
export interface CupPoolAssignment {
  readonly participantId: string;
  readonly poolId: string | null;
}

export async function assignCupPools(input: {
  readonly cupId: string;
  readonly actor: CupActor;
  readonly assignments: readonly CupPoolAssignment[];
}): Promise<{ updated: number }> {
  const cup = await loadCup(input.cupId);
  ensureCommissioner(cup, input.actor);
  await ensurePoolsEditable(cup);
  if (input.assignments.length === 0) return { updated: 0 };

  const participantIds = input.assignments.map((a) => a.participantId);
  const participants = (await prisma.cupParticipant.findMany({
    where: { id: { in: participantIds } },
    select: { id: true, cupId: true },
  })) as Array<{ id: string; cupId: string }>;
  const byId = new Map(participants.map((p) => [p.id, p]));
  for (const id of participantIds) {
    const found = byId.get(id);
    if (!found) {
      throw new CupPoolError(
        "participant_not_found",
        `Inscription introuvable : ${id}`,
      );
    }
    if (found.cupId !== cup.id) {
      throw new CupPoolError(
        "participant_not_in_cup",
        `L'inscription ${id} n'appartient pas à cette coupe`,
      );
    }
  }

  const poolIds = [
    ...new Set(
      input.assignments
        .map((a) => a.poolId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (poolIds.length > 0) {
    const pools = (await prisma.cupPool.findMany({
      where: { id: { in: poolIds } },
      select: { id: true, cupId: true },
    })) as Array<{ id: string; cupId: string }>;
    const poolById = new Map(pools.map((p) => [p.id, p]));
    for (const id of poolIds) {
      const pool = poolById.get(id);
      if (!pool || pool.cupId !== cup.id) {
        throw new CupPoolError(
          "pool_not_found",
          `Poule introuvable dans cette coupe : ${id}`,
        );
      }
    }
  }

  // Une seule transaction : une affectation partielle laisserait des équipes
  // dans une poule et d'autres hors poule, sans que rien ne le dise.
  await prisma.$transaction(
    input.assignments.map((a) =>
      prisma.cupParticipant.update({
        where: { id: a.participantId },
        data: { poolId: a.poolId },
      }),
    ),
  );
  return { updated: input.assignments.length };
}

/**
 * PUR — répartition « serpentin » : 1→A, 2→B, 3→B, 4→A, 5→A… Elle équilibre
 * les poules quel que soit le nombre d'inscrits et ne privilégie aucune
 * poule, contrairement à une distribution en round-robin simple où la
 * première poule reçoit systématiquement les premiers inscrits.
 */
export function computeSnakeAssignment(
  participantIds: readonly string[],
  poolIds: readonly string[],
): CupPoolAssignment[] {
  if (poolIds.length === 0) return [];
  return participantIds.map((participantId, idx) => {
    const cycle = Math.floor(idx / poolIds.length);
    const stepInCycle = idx % poolIds.length;
    const poolIndex =
      cycle % 2 === 0 ? stepInCycle : poolIds.length - 1 - stepInCycle;
    return { participantId, poolId: poolIds[poolIndex] };
  });
}

export async function autoAssignCupPools(input: {
  readonly cupId: string;
  readonly actor: CupActor;
}): Promise<{ assigned: number; note?: "no-pools" }> {
  const cup = await loadCup(input.cupId);
  ensureCommissioner(cup, input.actor);
  await ensurePoolsEditable(cup);

  const pools = (await prisma.cupPool.findMany({
    where: { cupId: cup.id },
    orderBy: { order: "asc" },
    select: { id: true },
  })) as Array<{ id: string }>;
  if (pools.length === 0) return { assigned: 0, note: "no-pools" };

  // `createdAt` puis `id` : deux inscriptions de la même milliseconde doivent
  // quand même produire une répartition reproductible.
  const participants = (await prisma.cupParticipant.findMany({
    where: { cupId: cup.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  })) as Array<{ id: string }>;

  const assignments = computeSnakeAssignment(
    participants.map((p) => p.id),
    pools.map((p) => p.id),
  );
  if (assignments.length === 0) return { assigned: 0 };

  await prisma.$transaction(
    assignments.map((a) =>
      prisma.cupParticipant.update({
        where: { id: a.participantId },
        data: { poolId: a.poolId },
      }),
    ),
  );
  return { assigned: assignments.length };
}

/** Classement d'une poule, servi à côté du classement général. */
export interface CupPoolStandings {
  readonly poolId: string;
  readonly poolName: string;
  readonly poolOrder: number;
  readonly qualifiesForPlayoffs: number;
  readonly standings: readonly CupStandingLike[];
}

/** Ce dont le regroupement a besoin d'une ligne de classement. */
export interface CupStandingLike {
  readonly teamId: string;
}

/**
 * PUR — répartit un classement DÉJÀ TRIÉ dans ses poules.
 *
 * On ne retrie pas : le classement général est calculé une fois, avec les
 * critères de départage de la coupe, et chaque poule en est une simple
 * projection. Deux tris séparés auraient pu diverger le jour où l'un des deux
 * oublierait un critère.
 *
 * Rend `[]` quand la coupe n'a pas de poule — l'appelant sert alors le seul
 * classement général. Les équipes sans poule sont regroupées en queue sous un
 * identifiant sentinelle : les taire reviendrait à les faire disparaître du
 * classement.
 */
export const UNASSIGNED_POOL_ID = "__unassigned__";

export function groupCupStandingsByPool<T extends CupStandingLike>(
  standings: readonly T[],
  pools: ReadonlyArray<{
    id: string;
    name: string;
    order: number;
    qualifiesForPlayoffs: number;
  }>,
  poolIdByTeamId: ReadonlyMap<string, string | null>,
): Array<Omit<CupPoolStandings, "standings"> & { standings: T[] }> {
  if (pools.length === 0) return [];

  const known = new Set(pools.map((p) => p.id));
  const groups = pools.map((pool) => ({
    poolId: pool.id,
    poolName: pool.name,
    poolOrder: pool.order,
    qualifiesForPlayoffs: pool.qualifiesForPlayoffs,
    standings: standings.filter(
      (row) => poolIdByTeamId.get(row.teamId) === pool.id,
    ),
  }));

  const orphans = standings.filter((row) => {
    const poolId = poolIdByTeamId.get(row.teamId) ?? null;
    return poolId === null || !known.has(poolId);
  });
  if (orphans.length > 0) {
    groups.push({
      poolId: UNASSIGNED_POOL_ID,
      poolName: "Non affectée",
      poolOrder: pools.length,
      qualifiesForPlayoffs: 0,
      standings: orphans,
    });
  }
  return groups;
}
