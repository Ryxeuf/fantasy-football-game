/**
 * S27.1f — Service "Match-of-the-week" (lecture).
 *
 * Retourne le `LocalMatch` le plus recemment pick par un admin via
 * `featuredAt`. Restreint aux matchs publics : un pick admin n'est
 * pas une raison de fuiter un match prive (defense en profondeur).
 *
 * L'endpoint admin pick (POST) sera couvert dans une slice ulterieure.
 * Cette PR livre la foundation lecture utilisable des aujourd'hui par
 * la home / la page cups landing pour un teaser "Match du moment".
 */

import { prisma } from "../prisma";

export interface FeaturedMatch {
  id: string;
  name: string | null;
  featuredAt: Date;
  featuredNote: string | null;
  cupId: string | null;
  scoreTeamA: number | null;
  scoreTeamB: number | null;
  teamA: { id: string; name: string } | null;
  teamB: { id: string; name: string } | null;
}

export async function getCurrentMatchOfTheWeek(): Promise<FeaturedMatch | null> {
  const row = (await (prisma as unknown as {
    localMatch: {
      findFirst: (args: unknown) => Promise<FeaturedMatch | null>;
    };
  }).localMatch.findFirst({
    where: { featuredAt: { not: null }, isPublic: true },
    orderBy: { featuredAt: "desc" },
    select: {
      id: true,
      name: true,
      featuredAt: true,
      featuredNote: true,
      cupId: true,
      scoreTeamA: true,
      scoreTeamB: true,
      teamA: { select: { id: true, name: true } },
      teamB: { select: { id: true, name: true } },
    },
  })) as FeaturedMatch | null;

  return row;
}
