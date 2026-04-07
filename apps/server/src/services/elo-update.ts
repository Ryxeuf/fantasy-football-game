import { calculateEloChange } from "./elo";
import type { MatchOutcome } from "./elo";

interface PrismaClient {
  user: {
    findUnique(args: { where: { id: string }; select: { eloRating: true } }): Promise<{ eloRating: number } | null>;
    update(args: { where: { id: string }; data: { eloRating: number } }): Promise<unknown>;
  };
}

export interface EloUpdateResult {
  userAId: string;
  userBId: string;
  oldRatingA: number;
  oldRatingB: number;
  newRatingA: number;
  newRatingB: number;
  deltaA: number;
  deltaB: number;
}

const MIN_ELO = 100;

/**
 * Update ELO ratings for both players after a match ends.
 *
 * @param prisma - Prisma client instance
 * @param userAId - User ID of team A's owner
 * @param userBId - User ID of team B's owner
 * @param scoreA - Final score for team A
 * @param scoreB - Final score for team B
 */
export async function updateEloAfterMatch(
  prisma: PrismaClient,
  userAId: string,
  userBId: string,
  scoreA: number,
  scoreB: number,
): Promise<EloUpdateResult> {
  const [userA, userB] = await Promise.all([
    prisma.user.findUnique({ where: { id: userAId }, select: { eloRating: true } }),
    prisma.user.findUnique({ where: { id: userBId }, select: { eloRating: true } }),
  ]);

  if (!userA || !userB) {
    throw new Error("Un ou plusieurs joueurs introuvables pour la mise a jour ELO");
  }

  const oldRatingA = userA.eloRating;
  const oldRatingB = userB.eloRating;

  let outcome: MatchOutcome;
  let winnerRating: number;
  let loserRating: number;

  if (scoreA > scoreB) {
    outcome = "win";
    winnerRating = oldRatingA;
    loserRating = oldRatingB;
  } else if (scoreB > scoreA) {
    outcome = "win";
    winnerRating = oldRatingB;
    loserRating = oldRatingA;
  } else {
    outcome = "draw";
    winnerRating = oldRatingA;
    loserRating = oldRatingB;
  }

  const { winnerDelta, loserDelta } = calculateEloChange(winnerRating, loserRating, outcome);

  let deltaA: number;
  let deltaB: number;
  if (scoreA > scoreB) {
    deltaA = winnerDelta;
    deltaB = loserDelta;
  } else if (scoreB > scoreA) {
    deltaA = loserDelta;
    deltaB = winnerDelta;
  } else {
    deltaA = winnerDelta;
    deltaB = loserDelta;
  }

  const newRatingA = Math.max(MIN_ELO, oldRatingA + deltaA);
  const newRatingB = Math.max(MIN_ELO, oldRatingB + deltaB);

  await Promise.all([
    prisma.user.update({ where: { id: userAId }, data: { eloRating: newRatingA } }),
    prisma.user.update({ where: { id: userBId }, data: { eloRating: newRatingB } }),
  ]);

  return {
    userAId,
    userBId,
    oldRatingA,
    oldRatingB,
    newRatingA,
    newRatingB,
    deltaA: newRatingA - oldRatingA,
    deltaB: newRatingB - oldRatingB,
  };
}
