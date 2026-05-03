/**
 * S26.5 — Notification "ami demarre un match".
 *
 * Quand un match passe en `prematch-setup` (les deux coachs ont accepte),
 * on previent les amis acceptes des deux joueurs :
 *  - Si l'ami est connecte au /game namespace, on emet un event WebSocket
 *    `friend:match-started` (notification live cote client).
 *  - Sinon, on declenche une push notification (web + Expo).
 *
 * Garde-fous :
 *  - Les joueurs du match eux-memes ne sont jamais notifies (cas trivial
 *    si A et B sont amis).
 *  - Les amis dedupes (un meme ami present chez les deux joueurs ne
 *    recoit qu'une seule notification).
 *  - Les amis deja connectes au matchId (spectateurs ouvrant la page
 *    avant la notif) sont ignores.
 *  - La preference utilisateur est checkee dans `sendFriendMatchStartedPush`,
 *    donc la branche socket peut emettre librement (le client filtre
 *    aussi cote UI si besoin).
 *  - Toute erreur DB / socket est swallowed : la notification est
 *    fire-and-forget et ne doit jamais bloquer le pre-match.
 */

import { prisma } from "../prisma";
import { listAcceptedFriendIds } from "./friendship";
import { sendFriendMatchStartedPush } from "./push-notifications";
import { isUserConnectedToMatch } from "./connected-users";
import { getGameNamespace } from "../socket";

export interface NotifyFriendMatchStartedResult {
  notifiedViaSocket: number;
  notifiedViaPush: number;
  skippedAlreadyInMatch: number;
}

const EMPTY_RESULT: NotifyFriendMatchStartedResult = {
  notifiedViaSocket: 0,
  notifiedViaPush: 0,
  skippedAlreadyInMatch: 0,
};

async function getCoachName(userId: string): Promise<string | null> {
  const row = (await (prisma as unknown as {
    user: {
      findUnique: (args: unknown) => Promise<
        { id: string; coachName: string } | null
      >;
    };
  }).user.findUnique({
    where: { id: userId },
    select: { id: true, coachName: true },
  })) as { id: string; coachName: string } | null;
  return row?.coachName ?? null;
}

function emitToConnectedFriend(friendId: string, payload: {
  matchId: string;
  friendCoachName: string;
  opponentCoachName: string;
}): boolean {
  try {
    const ns = getGameNamespace();
    let emitted = false;
    for (const [, socket] of ns.sockets) {
      if (socket.data.user?.id === friendId) {
        socket.emit("friend:match-started", payload);
        emitted = true;
      }
    }
    return emitted;
  } catch {
    return false;
  }
}

export async function notifyFriendMatchStarted(
  matchId: string,
  playerUserIds: string[],
): Promise<NotifyFriendMatchStartedResult> {
  if (!matchId || playerUserIds.length < 2) {
    return { ...EMPTY_RESULT };
  }

  const [a, b] = playerUserIds;
  if (!a || !b || a === b) {
    return { ...EMPTY_RESULT };
  }

  const [coachA, coachB] = await Promise.all([
    getCoachName(a).catch(() => null),
    getCoachName(b).catch(() => null),
  ]);
  if (!coachA || !coachB) {
    return { ...EMPTY_RESULT };
  }

  const [friendsA, friendsB] = await Promise.all([
    listAcceptedFriendIds(a).catch(() => [] as string[]),
    listAcceptedFriendIds(b).catch(() => [] as string[]),
  ]);

  const players = new Set([a, b]);
  // Dedupe across both players ; exclude players themselves.
  const targets = new Map<string, { friendCoachName: string; opponentCoachName: string }>();
  for (const friendId of friendsA) {
    if (players.has(friendId)) continue;
    targets.set(friendId, { friendCoachName: coachA, opponentCoachName: coachB });
  }
  for (const friendId of friendsB) {
    if (players.has(friendId)) continue;
    if (targets.has(friendId)) continue; // already queued via player A
    targets.set(friendId, { friendCoachName: coachB, opponentCoachName: coachA });
  }

  let notifiedViaSocket = 0;
  let notifiedViaPush = 0;
  let skippedAlreadyInMatch = 0;

  for (const [friendId, ctx] of targets) {
    if (isUserConnectedToMatch(matchId, friendId)) {
      skippedAlreadyInMatch += 1;
      continue;
    }
    const payload = {
      matchId,
      friendCoachName: ctx.friendCoachName,
      opponentCoachName: ctx.opponentCoachName,
    };
    const sentViaSocket = emitToConnectedFriend(friendId, payload);
    if (sentViaSocket) {
      notifiedViaSocket += 1;
      continue;
    }
    sendFriendMatchStartedPush(
      friendId,
      matchId,
      ctx.friendCoachName,
      ctx.opponentCoachName,
    );
    notifiedViaPush += 1;
  }

  return { notifiedViaSocket, notifiedViaPush, skippedAlreadyInMatch };
}
