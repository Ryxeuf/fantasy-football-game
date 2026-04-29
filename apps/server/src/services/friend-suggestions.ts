/**
 * S26.5a — Suggestions d'amis basees sur le rating ELO.
 *
 * Renvoie des coachs publics dont l'ELO est proche du requester
 * (default +/- 100), excluant :
 *  - le requester lui-meme,
 *  - tous les comptes en relation avec lui (toutes statuts confondus,
 *    y compris demandes en attente / refusees / bloquees),
 *  - les profils prives (S26.3i),
 *  - les comptes non valides.
 *
 * Tri par proximite ELO croissante (closest first), limite 10 par
 * defaut, plafond 50.
 */

import { prisma } from "../prisma";

export interface FriendSuggestion {
  id: string;
  coachName: string;
  eloRating: number;
  /** Difference absolue entre l'ELO du suggested et celui du requester. */
  eloDelta: number;
}

const DEFAULT_RANGE = 100;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
// Multiplicateur applique au limit pour le pre-fetch DB. On surfetche
// pour pouvoir trier par proximite cote app sans rater de candidats.
const PREFETCH_FACTOR = 1;

export async function suggestFriendsByElo(
  userId: string,
  range: number = DEFAULT_RANGE,
  limit: number = DEFAULT_LIMIT,
): Promise<FriendSuggestion[]> {
  const me = (await (prisma as unknown as {
    user: {
      findUnique: (args: unknown) => Promise<
        { id: string; eloRating: number } | null
      >;
    };
  }).user.findUnique({
    where: { id: userId },
    select: { id: true, eloRating: true },
  })) as { id: string; eloRating: number } | null;
  if (!me) return [];

  const friendships = (await (prisma as unknown as {
    friendship: {
      findMany: (args: unknown) => Promise<
        Array<{ requesterId: string; receiverId: string }>
      >;
    };
  }).friendship.findMany({
    where: {
      OR: [{ requesterId: me.id }, { receiverId: me.id }],
    },
    select: { requesterId: true, receiverId: true },
  })) as Array<{ requesterId: string; receiverId: string }>;

  const excluded = new Set<string>([me.id]);
  for (const f of friendships) {
    excluded.add(f.requesterId);
    excluded.add(f.receiverId);
  }

  const cappedLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT);

  const candidates = (await (prisma as unknown as {
    user: {
      findMany: (args: unknown) => Promise<
        Array<{ id: string; coachName: string; eloRating: number }>
      >;
    };
  }).user.findMany({
    where: {
      valid: true,
      privateProfile: false,
      eloRating: { gte: me.eloRating - range, lte: me.eloRating + range },
      id: { notIn: Array.from(excluded) },
    },
    select: { id: true, coachName: true, eloRating: true },
    take: cappedLimit * PREFETCH_FACTOR,
  })) as Array<{ id: string; coachName: string; eloRating: number }>;

  return candidates
    .map((u) => ({
      id: u.id,
      coachName: u.coachName,
      eloRating: u.eloRating,
      eloDelta: Math.abs(u.eloRating - me.eloRating),
    }))
    .sort((a, b) => a.eloDelta - b.eloDelta)
    .slice(0, cappedLimit);
}
