import { prisma } from "../prisma";
import jwt from "jsonwebtoken";
import { MATCH_SECRET } from "../config";
const TV_RANGE = 150_000; // Match teams within +/- 150k TV

export interface JoinQueueParams {
  userId: string;
  teamId: string;
}

export interface QueueEntry {
  id: string;
  userId: string;
  teamId: string;
  teamValue: number;
  status: string;
  matchId: string | null;
  joinedAt: Date;
}

export interface MatchFoundResult {
  matched: true;
  matchId: string;
  opponentUserId: string;
  matchToken: string;
}

export interface QueuedResult {
  matched: false;
  queueId: string;
  teamValue: number;
  position: number;
}

export type JoinQueueResult = MatchFoundResult | QueuedResult;

/**
 * Join the matchmaking queue with a team.
 * If a compatible opponent is already searching, automatically creates a match.
 */
export async function joinQueue(params: JoinQueueParams): Promise<JoinQueueResult> {
  const { userId, teamId } = params;

  // Verify team exists and belongs to user
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, ownerId: true, currentValue: true },
  });
  if (!team) {
    throw new Error("Equipe introuvable");
  }
  if (team.ownerId !== userId) {
    throw new Error("Cette equipe ne vous appartient pas");
  }

  // Check if user is already in queue
  const existing = await prisma.matchQueue.findUnique({
    where: { userId },
  });
  if (existing && existing.status === "searching") {
    throw new Error("Vous etes deja en file d'attente");
  }
  // Clean up stale entries
  if (existing) {
    await prisma.matchQueue.delete({ where: { id: existing.id } });
  }

  const teamValue = team.currentValue;

  // Look for a compatible opponent
  const opponent = await findCompatibleOpponent(userId, teamValue);

  if (opponent) {
    // Create match immediately
    const matchResult = await createMatchFromQueue(userId, teamId, opponent);
    return matchResult;
  }

  // No opponent found, add to queue
  const entry = await prisma.matchQueue.create({
    data: {
      userId,
      teamId,
      teamValue,
      status: "searching",
    },
  });

  const position = await prisma.matchQueue.count({
    where: { status: "searching" },
  });

  return {
    matched: false,
    queueId: entry.id,
    teamValue,
    position,
  };
}

/**
 * Leave the matchmaking queue.
 */
export async function leaveQueue(userId: string): Promise<{ ok: boolean }> {
  const entry = await prisma.matchQueue.findUnique({
    where: { userId },
  });
  if (!entry || entry.status !== "searching") {
    return { ok: false };
  }

  await prisma.matchQueue.update({
    where: { id: entry.id },
    data: { status: "cancelled" },
  });

  return { ok: true };
}

/**
 * Get the current queue status for a user.
 */
export async function getQueueStatus(userId: string): Promise<QueueEntry | null> {
  const entry = await prisma.matchQueue.findUnique({
    where: { userId },
  });
  return entry;
}

/**
 * Find a compatible opponent in the queue (TV within range).
 * Returns the oldest matching entry (FIFO).
 */
async function findCompatibleOpponent(
  userId: string,
  teamValue: number,
): Promise<QueueEntry | null> {
  const minTV = teamValue - TV_RANGE;
  const maxTV = teamValue + TV_RANGE;

  const candidates = await prisma.matchQueue.findMany({
    where: {
      status: "searching",
      userId: { not: userId },
      teamValue: { gte: minTV, lte: maxTV },
    },
    orderBy: { joinedAt: "asc" },
    take: 1,
  });

  return candidates[0] ?? null;
}

/**
 * Create a match from two queue entries.
 */
async function createMatchFromQueue(
  joiningUserId: string,
  joiningTeamId: string,
  opponent: QueueEntry,
): Promise<MatchFoundResult> {
  const seed = `match-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Create the match
  const match = await prisma.match.create({
    data: {
      status: "pending",
      seed,
      players: {
        connect: [{ id: joiningUserId }, { id: opponent.userId }],
      },
    },
  });

  // Create team selections for both players
  await prisma.teamSelection.createMany({
    data: [
      { matchId: match.id, userId: joiningUserId, teamId: joiningTeamId },
      { matchId: match.id, userId: opponent.userId, teamId: opponent.teamId },
    ],
  });

  // Update opponent's queue entry
  await prisma.matchQueue.update({
    where: { id: opponent.id },
    data: { status: "matched", matchId: match.id },
  });

  // Generate match token for the joining user
  const matchToken = jwt.sign(
    { matchId: match.id, userId: joiningUserId },
    MATCH_SECRET,
    { expiresIn: "2h" },
  );

  return {
    matched: true,
    matchId: match.id,
    opponentUserId: opponent.userId,
    matchToken,
  };
}

/**
 * Clean up stale queue entries (older than 30 minutes).
 */
export async function cleanupStaleEntries(): Promise<number> {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  const result = await prisma.matchQueue.updateMany({
    where: {
      status: "searching",
      joinedAt: { lt: thirtyMinutesAgo },
    },
    data: { status: "cancelled" },
  });

  return result.count;
}
