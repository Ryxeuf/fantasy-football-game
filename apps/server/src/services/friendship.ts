import { prisma } from "../prisma";

/**
 * Systeme d'amis — logique metier
 *
 * Regles :
 *  - Un utilisateur ne peut pas s'ajouter lui-meme.
 *  - Une seule relation (dans l'un ou l'autre sens) est autorisee entre deux users.
 *  - Seul le receveur (receiver) peut accepter ou refuser une demande pending.
 *  - Les deux participants peuvent supprimer une relation (annulation / defriend).
 */

export enum FriendshipStatus {
  Pending = "pending",
  Accepted = "accepted",
  Declined = "declined",
  Blocked = "blocked",
}

export interface FriendshipRow {
  id: string;
  requesterId: string;
  receiverId: string;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FriendshipWithUsers extends FriendshipRow {
  requester?: { id: string; coachName: string };
  receiver?: { id: string; coachName: string };
}

// ---------------------------------------------------------------------------
// Send friend request
// ---------------------------------------------------------------------------

export async function sendFriendRequest(
  requesterId: string,
  receiverId: string,
): Promise<FriendshipRow> {
  if (requesterId === receiverId) {
    throw new Error("Impossible de s'ajouter soi-meme");
  }

  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { id: true },
  });
  if (!receiver) {
    throw new Error("Utilisateur introuvable");
  }

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId, receiverId },
        { requesterId: receiverId, receiverId: requesterId },
      ],
    },
  });
  if (existing) {
    throw new Error("Une relation existe deja entre ces utilisateurs");
  }

  return prisma.friendship.create({
    data: {
      requesterId,
      receiverId,
      status: FriendshipStatus.Pending,
    },
  });
}

// ---------------------------------------------------------------------------
// Respond to friend request (accept/decline)
// ---------------------------------------------------------------------------

export type FriendshipResponseAction = "accept" | "decline";

export async function respondToFriendRequest(
  friendshipId: string,
  currentUserId: string,
  action: FriendshipResponseAction,
): Promise<FriendshipRow> {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });
  if (!friendship) {
    throw new Error("Demande d'ami introuvable");
  }
  if (friendship.receiverId !== currentUserId) {
    throw new Error("Non autorise a repondre a cette demande");
  }
  if (friendship.status !== FriendshipStatus.Pending) {
    throw new Error("La demande n'est pas en attente (pending)");
  }

  const newStatus =
    action === "accept"
      ? FriendshipStatus.Accepted
      : FriendshipStatus.Declined;

  return prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: newStatus },
  });
}

// ---------------------------------------------------------------------------
// List friendships for a user (optional status filter)
// ---------------------------------------------------------------------------

export async function listFriendships(
  userId: string,
  status?: FriendshipStatus | string,
): Promise<FriendshipWithUsers[]> {
  const baseWhere = {
    OR: [{ requesterId: userId }, { receiverId: userId }],
  };
  const where = status
    ? { AND: [baseWhere, { status }] }
    : baseWhere;

  return prisma.friendship.findMany({
    where,
    include: {
      requester: { select: { id: true, coachName: true } },
      receiver: { select: { id: true, coachName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Remove friendship (delete)
// ---------------------------------------------------------------------------

export async function removeFriendship(
  friendshipId: string,
  currentUserId: string,
): Promise<void> {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });
  if (!friendship) {
    throw new Error("Relation introuvable");
  }
  if (
    friendship.requesterId !== currentUserId &&
    friendship.receiverId !== currentUserId
  ) {
    throw new Error("Non autorise a supprimer cette relation");
  }
  await prisma.friendship.delete({ where: { id: friendshipId } });
}

// ---------------------------------------------------------------------------
// Check whether two users are currently friends (accepted status)
// ---------------------------------------------------------------------------

export async function areFriends(
  userA: string,
  userB: string,
): Promise<boolean> {
  const row = await prisma.friendship.findFirst({
    where: {
      status: FriendshipStatus.Accepted,
      OR: [
        { requesterId: userA, receiverId: userB },
        { requesterId: userB, receiverId: userA },
      ],
    },
  });
  return row !== null;
}

/**
 * S26.5b — Liste les userIds des amis acceptes (dans les deux sens
 * de la relation). Utile pour cibler les notifications "ami demarre
 * un match" (S26.5) sans avoir a deballer la liste complete des
 * relations cote caller.
 *
 * Renvoie un tableau dedupe (au cas ou la base contiendrait
 * historiquement des lignes dupliquees) et n'inclut jamais le
 * `userId` lui-meme.
 */
export async function listAcceptedFriendIds(
  userId: string,
): Promise<string[]> {
  if (!userId) return [];
  const rows = await prisma.friendship.findMany({
    where: {
      status: FriendshipStatus.Accepted,
      OR: [{ requesterId: userId }, { receiverId: userId }],
    },
    select: { requesterId: true, receiverId: true },
  });
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.requesterId !== userId) ids.add(row.requesterId);
    if (row.receiverId !== userId) ids.add(row.receiverId);
  }
  return Array.from(ids);
}
