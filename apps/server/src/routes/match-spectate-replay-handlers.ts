/**
 * S27.8.16 — Module dedie aux 2 handlers de lecture en lecture seule
 * extraits depuis `routes/match.ts` :
 *  - `handleSpectateMatch` : retourne l'etat du match en cours pour
 *    un spectateur (sans verification de participant), incluant
 *    `gameState`, `matchStatus`, `spectatorCount`, et les coachs.
 *  - `handleReplayMatch` : retourne tous les `turns` avec leur
 *    `gameState` pour rejouer un match termine.
 *
 * Les deux handlers sont thematiquement coheressents (lecture seule
 * de l'etat / des turns) et n'ont aucune dependance vers les autres
 * handlers de `match.ts` (creation, join, accept, move, etc.).
 *
 * Apres extraction, `match.ts` re-exporte ces handlers pour preserver
 * l'API publique consommee par les tests d'integration.
 */

import type { Response } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/authUser';
import { getSpectatorCount } from '../game-spectator';
import { serverLog } from '../utils/server-log';
import { sendError, sendSuccess } from '../utils/api-response';

/**
 * S25.5i / S27.8.16 — `GET /match/:id/spectate`
 *
 * Retourne l'etat de jeu d'un match en cours pour un spectateur. Pas
 * de verification de participant : un visiteur authentifie peut
 * regarder n'importe quel match `active` ou `prematch-setup`.
 *
 * Le `gameState` est extrait du dernier `turn` qui contient un
 * `payload.gameState`. Les noms d'equipe et de coach proviennent des
 * deux premieres `TeamSelection`.
 */
export async function handleSpectateMatch(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const matchId = req.params.id;
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { turns: { orderBy: { number: 'asc' } } },
    });

    if (!match) {
      sendError(res, 'Partie introuvable', 404);
      return;
    }

    if (match.status !== 'active' && match.status !== 'prematch-setup') {
      sendError(res, "Ce match n'est pas en cours", 400);
      return;
    }

    const latestStateTurn = [...match.turns]
      .reverse()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .find((t: any) => t.payload?.gameState);

    if (!latestStateTurn) {
      sendError(res, 'Etat de jeu introuvable', 400);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let gameState = (latestStateTurn as any).payload.gameState;
    if (typeof gameState === 'string') {
      gameState = JSON.parse(gameState);
    }

    const selections = await prisma.teamSelection.findMany({
      where: { matchId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, coachName: true } },
        teamRef: { select: { name: true, roster: true } },
      },
    });

    const teamA = selections[0];
    const teamB = selections[1];

    sendSuccess(res, {
      gameState,
      matchStatus: match.status,
      spectatorCount: getSpectatorCount(matchId),
      teamA: teamA
        ? {
            coachName: teamA.user?.coachName || '',
            teamName: teamA.teamRef?.name || '',
          }
        : null,
      teamB: teamB
        ? {
            coachName: teamB.user?.coachName || '',
            teamName: teamB.teamRef?.name || '',
          }
        : null,
    });
  } catch (e: unknown) {
    serverLog.error(e);
    sendError(res, 'Erreur serveur', 500);
  }
}

/**
 * S25.5i / S27.8.16 — `GET /match/:id/replay`
 *
 * Retourne tous les `turns` d'un match termine avec leur `gameState`
 * pour permettre de rejouer le match (frontend `replay/[id]`).
 * Refuse les matchs non termines (404 ou 400).
 */
export async function handleReplayMatch(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const matchId = req.params.id;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        turns: {
          orderBy: { number: 'asc' },
          select: { number: true, payload: true, createdAt: true },
        },
        teamSelections: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, coachName: true } },
            teamRef: { select: { id: true, name: true, roster: true } },
          },
        },
      },
    });

    if (!match) {
      sendError(res, 'Partie introuvable', 404);
      return;
    }

    if (match.status !== 'ended') {
      sendError(res, "Le replay n'est disponible que pour les matchs termines", 400);
      return;
    }

    const replayTurns = match.turns
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((t: any) => t.payload?.gameState != null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((t: any) => ({
        type: t.payload.type,
        gameState: t.payload.gameState,
        move: t.payload.move,
        timestamp: t.payload.timestamp || t.createdAt?.toISOString(),
      }));

    const [selA, selB] = match.teamSelections;
    const teamMeta = {
      teamA: selA
        ? {
            coachName: selA.user?.coachName || '',
            teamName: selA.teamRef?.name || '',
            roster: selA.teamRef?.roster || '',
          }
        : null,
      teamB: selB
        ? {
            coachName: selB.user?.coachName || '',
            teamName: selB.teamRef?.name || '',
            roster: selB.teamRef?.roster || '',
          }
        : null,
    };

    sendSuccess(res, {
      matchId,
      status: match.status,
      turns: replayTurns,
      teams: teamMeta,
      createdAt: match.createdAt,
    });
  } catch (e: unknown) {
    serverLog.error(e);
    sendError(res, 'Erreur serveur', 500);
  }
}
