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

export interface SetMatchOfTheWeekInput {
  matchId: string;
  note: string | null;
}

/**
 * S27.1g — Pick admin du match du moment.
 *
 * Refuse :
 *  - matchId inconnu (404 cote handler).
 *  - match non public (anti-fuite : on ne featured jamais un match prive).
 *  - match non termine ('completed') : un teaser sur un match en cours
 *    n'aurait pas de sens (pas de score final).
 *
 * Sinon : ecrit `featuredAt=now()` + `featuredNote` (peut etre null).
 * Pas de "unfeature" ici : l'effet est obtenu en featurant un autre
 * match (cf. service `getCurrentMatchOfTheWeek` qui prend le plus
 * recent).
 */
export async function setMatchOfTheWeek(
  input: SetMatchOfTheWeekInput,
): Promise<{ id: string; featuredAt: Date | null; featuredNote: string | null }> {
  const match = (await (prisma as unknown as {
    localMatch: {
      findUnique: (args: unknown) => Promise<
        | { id: string; isPublic: boolean; status: string }
        | null
      >;
    };
  }).localMatch.findUnique({
    where: { id: input.matchId },
    select: { id: true, isPublic: true, status: true },
  })) as { id: string; isPublic: boolean; status: string } | null;

  if (!match) {
    throw new Error(`Match introuvable: ${input.matchId}`);
  }
  if (!match.isPublic) {
    throw new Error("Le match doit etre public pour etre featured");
  }
  if (match.status !== "completed") {
    throw new Error(
      `Le match doit etre completed pour etre featured (status=${match.status})`,
    );
  }

  return (await (prisma as unknown as {
    localMatch: {
      update: (args: unknown) => Promise<{
        id: string;
        featuredAt: Date | null;
        featuredNote: string | null;
      }>;
    };
  }).localMatch.update({
    where: { id: input.matchId },
    data: {
      featuredAt: new Date(),
      featuredNote: input.note,
    },
    select: { id: true, featuredAt: true, featuredNote: true },
  })) as { id: string; featuredAt: Date | null; featuredNote: string | null };
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
