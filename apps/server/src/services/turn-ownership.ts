import type { PrismaClient } from "@prisma/client";

type TeamSide = "A" | "B";

/**
 * Mappe un userId vers son cote d'equipe (A ou B) dans un match.
 * Convention: premiere selection (createdAt ASC) = equipe A, deuxieme = equipe B.
 */
export async function getUserTeamSide(
  prisma: PrismaClient,
  matchId: string,
  userId: string,
): Promise<TeamSide | null> {
  const selections = await prisma.teamSelection.findMany({
    where: { matchId },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });

  if (selections.length < 2) return null;

  if (selections[0].userId === userId) return "A";
  if (selections[1].userId === userId) return "B";
  return null;
}
