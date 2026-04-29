/**
 * S26.3 — Profil coach public sharable.
 *
 * Service `getCoachPublicProfile(slug)` qui resoud un slug d'URL en
 * profil public. Le slug est derive du `coachName` via
 * `coachSlugFrom` (S26.3a). En cas de collision (deux comptes
 * identiques apres normalisation), le plus ancien compte (createdAt
 * croissant) gagne — convention deterministe.
 *
 * Donnees publiques uniquement : pseudo, ELO, statut supporter,
 * date d'inscription. Pas d'email, pas de roles internes.
 *
 * RGPD : un futur opt-in `private profile` permettra a un coach de
 * cacher son profil public — applique au niveau du `where` Prisma
 * dans une slice ulterieure (S26.3c).
 */

import { prisma } from "../prisma";
import { coachSlugFrom } from "../utils/coach-slug";
import { isSupporter } from "./kofi";

export interface CoachPublicProfile {
  id: string;
  slug: string;
  coachName: string;
  eloRating: number;
  isSupporter: boolean;
  supporterTier: string | null;
  /** ISO 8601 timestamp of the User.createdAt. */
  memberSince: string;
}

interface CandidateUser {
  id: string;
  coachName: string;
  eloRating: number;
  patreon: boolean;
  supporterActiveUntil: Date | null;
  supporterTier: string | null;
  createdAt: Date;
}

export async function getCoachPublicProfile(
  slug: string,
  now: Date = new Date(),
): Promise<CoachPublicProfile | null> {
  const normalised = slug.trim();
  if (normalised.length === 0) return null;

  const candidates = (await (prisma as unknown as {
    user: {
      findMany: (args: unknown) => Promise<CandidateUser[]>;
    };
  }).user.findMany({
    where: { valid: true },
    select: {
      id: true,
      coachName: true,
      eloRating: true,
      patreon: true,
      supporterActiveUntil: true,
      supporterTier: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })) as CandidateUser[];

  const match = candidates.find(
    (u) => coachSlugFrom(u.coachName) === normalised,
  );
  if (!match) return null;

  return {
    id: match.id,
    slug: coachSlugFrom(match.coachName),
    coachName: match.coachName,
    eloRating: match.eloRating,
    isSupporter: isSupporter(
      {
        patreon: match.patreon,
        supporterActiveUntil: match.supporterActiveUntil,
      },
      now,
    ),
    supporterTier: match.supporterTier,
    memberSince: match.createdAt.toISOString(),
  };
}
