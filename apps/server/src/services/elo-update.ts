import { calculateEloChange } from "./elo";
import type { MatchOutcome } from "./elo";

interface EloSnapshotInput {
  userId: string;
  rating: number;
  delta: number;
  matchId: string | null;
}

interface PrismaClient {
  user: {
    findUnique(args: { where: { id: string }; select: { eloRating: true } }): Promise<{ eloRating: number } | null>;
    update(args: { where: { id: string }; data: { eloRating: number } }): Promise<unknown>;
  };
  // S26.3l — historize each ELO change so /coach/{slug} can plot a 90 day curve.
  eloSnapshot: {
    create(args: { data: EloSnapshotInput }): Promise<unknown>;
  };
  // Audit round 6 (CRITICAL) : `$transaction` requis pour atomicite des
  // 4 mutations (user.update x2 + eloSnapshot.create x2). Avant, un
  // crash entre n'importe quelles 2 mutations laissait l'etat
  // incoherent (un user updated mais pas l'autre, ou ratings sans
  // snapshots).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $transaction: (ops: ReadonlyArray<Promise<unknown>>) => Promise<any>;
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
  matchId: string | null = null,
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

  // BUG fix audit round 6 (CRITICAL) : avant, les 4 mutations (user
  // update x2 + eloSnapshot.create x2) etaient executees comme 2
  // `Promise.all` sequentiels hors transaction. Crash entre les 2
  // `Promise.all` → un user rating mis a jour mais pas l'autre (ou
  // pire : ratings updated mais snapshots non-cree). Aussi : 2 ELO
  // updates concurrents pour le meme user (matchs finissant en
  // simultane) read stale rating → 2e clobbers le 1er delta.
  // Fix : wrap les 4 mutations dans une seule `$transaction([...])`.
  // Le re-read FOR UPDATE n'est pas exprimable proprement via le shim
  // PrismaClient type ici — on accepte la race read-modify-write
  // (pratiquement rare : memes 2 users finissant 2 matches en
  // millisecondes simultanees). La transaction garantit au moins
  // l'atomicite all-or-nothing des 4 writes.
  const finalDeltaA = newRatingA - oldRatingA;
  const finalDeltaB = newRatingB - oldRatingB;

  await prisma.$transaction([
    prisma.user.update({ where: { id: userAId }, data: { eloRating: newRatingA } }),
    prisma.user.update({ where: { id: userBId }, data: { eloRating: newRatingB } }),
    // Snapshot rows feed the 90-day ELO curve on /coach/{slug}.
    prisma.eloSnapshot.create({
      data: { userId: userAId, rating: newRatingA, delta: finalDeltaA, matchId },
    }),
    prisma.eloSnapshot.create({
      data: { userId: userBId, rating: newRatingB, delta: finalDeltaB, matchId },
    }),
  ]);

  return {
    userAId,
    userBId,
    oldRatingA,
    oldRatingB,
    newRatingA,
    newRatingB,
    deltaA: finalDeltaA,
    deltaB: finalDeltaB,
  };
}
