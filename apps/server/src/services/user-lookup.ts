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
