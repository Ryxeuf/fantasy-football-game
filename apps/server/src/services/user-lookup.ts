/**
 * S26.4a — Resolveur `@username -> userId`.
 *
 * Permet a `sendFriendRequest` (S26.4) d'accepter un nom de coach
 * (eventuellement prefixe `@`) au lieu d'un userId interne — UX
 * standard des reseaux sociaux. La recherche est :
 *   - case-insensitive (deux coachs ne peuvent differer que par la
 *     casse en pratique, le coachName ayant un index unique cote
 *     register).
 *   - filtree sur `valid: true` + `privateProfile: false` : un coach
 *     en mode prive (S26.3i) ne doit pas etre adressable via son
 *     pseudo public.
 */

import { prisma } from "../prisma";

export interface CoachLookupResult {
  id: string;
  coachName: string;
}

export async function findUserByCoachName(
  raw: string,
): Promise<CoachLookupResult | null> {
  const normalized = raw.trim().replace(/^@+/, "").trim();
  if (normalized.length === 0) return null;

  const user = (await (prisma as unknown as {
    user: {
      findFirst: (args: unknown) => Promise<CoachLookupResult | null>;
    };
  }).user.findFirst({
    where: {
      valid: true,
      privateProfile: false,
      coachName: { equals: normalized, mode: "insensitive" },
    },
    select: { id: true, coachName: true },
  })) as CoachLookupResult | null;

  return user;
}

const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;

/**
 * S26.4c — Recherche par sous-chaine pour l'autocomplete UI.
 *
 * Filtre `valid + privateProfile=false` (RGPD), match `contains`
 * insensible a la casse. Limite plafonnee a 50 pour eviter de
 * dumper toute la base via une requete vide.
 */
export async function searchUsersByCoachName(
  raw: string,
  limit: number = DEFAULT_SEARCH_LIMIT,
): Promise<CoachLookupResult[]> {
  const normalized = raw.trim().replace(/^@+/, "").trim();
  if (normalized.length === 0) return [];

  const cappedLimit = Math.min(Math.max(1, Math.floor(limit)), MAX_SEARCH_LIMIT);

  const rows = (await (prisma as unknown as {
    user: {
      findMany: (args: unknown) => Promise<CoachLookupResult[]>;
    };
  }).user.findMany({
    where: {
      valid: true,
      privateProfile: false,
      coachName: { contains: normalized, mode: "insensitive" },
    },
    select: { id: true, coachName: true },
    orderBy: { coachName: "asc" },
    take: cappedLimit,
  })) as CoachLookupResult[];

  return rows;
}
