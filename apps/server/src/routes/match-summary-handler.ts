/**
 * S27.8.32 — Module dedie au handler `handleGetMatchSummary` extrait
 * depuis `routes/match-details-handlers.ts` (qui depassait le DoD
 * secondaire 400 a 464 lignes). Polish slice (dernier des 3
 * modules >400).
 *
 * Endpoint couvert :
 *  - `GET /match/:id/summary` — `handleGetMatchSummary` : resume
 *    prematch (equipes, coachs, score approx, tour/mi-temps,
 *    acceptances). Utilise par la page de prematch.
 *
 * Helpers leaf uniquement : `prisma`, `sendError`/`sendSuccess`,
 * `serverLog`. Aucun cycle.
 */

import type { Response } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/authUser';
import { sendError, sendSuccess } from '../utils/api-response';
import { serverLog } from '../utils/server-log';

/**
 * S25.5k / S27.8.32 — `GET /match/:id/summary`
 *
 * Resume du match : equipes, coachs, score (approx), tour/mi-temps,
 * acceptations. Utilise principalement pour la page de prematch.
 */
export async function handleGetMatchSummary(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const matchId = req.params.id;
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        seed: true,
        creatorId: true,
        createdAt: true,
      },
    });
    if (!match) {
      sendError(res, 'Partie introuvable', 404);
      return;
    }

    const [selections, acceptTurns] = await Promise.all([
      prisma.teamSelection.findMany({
        where: { matchId },
        include: {
          user: {
            select: { id: true, name: true, email: true, eloRating: true },
          },
          teamRef: { select: { id: true, name: true, roster: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.turn.findMany({ where: { matchId } }),
    ]);
    let local =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      selections.find((s: any) => s.userId === match.creatorId) || null;
    let visitor =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      selections.find((s: any) => s.userId !== match.creatorId) || null;
    if (!local || !visitor) {
      if (match.creatorId) {
        local =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          selections.find((s: any) => s.userId === match.creatorId) ||
          selections[0] ||
          null;
        visitor =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          selections.find((s: any) => s.userId !== match.creatorId) ||
          selections[1] ||
          null;
      } else {
        local = selections[0] || null;
        visitor = selections.length > 1 ? selections[1] : null;
      }
    }

    const turnsCount = await prisma.turn.count({ where: { matchId } });
    const half = turnsCount < 16 ? 1 : 2; // approximation
    const turn = (turnsCount % 16) + 1; // approximation

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pickName = (sel: any) =>
      sel?.teamRef?.name || sel?.teamRef?.roster || sel?.team || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pickCoach = (sel: any) => sel?.user?.name || sel?.user?.email || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pickElo = (sel: any) => sel?.user?.eloRating ?? 1000;
    const acceptedUserIds = Array.from(
      new Set(
        (acceptTurns || [])
          .map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (t: any) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (t as any)?.payload?.type === 'accept'
                ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (t as any)?.payload?.userId
                : null,
          )
          .filter(Boolean),
      ),
    );
    const localAccepted = !!(local && acceptedUserIds.includes(local.userId));
    const visitorAccepted = !!(
      visitor && acceptedUserIds.includes(visitor.userId)
    );

    sendSuccess(res, {
      id: match.id,
      status: match.status,
      createdAt: match.createdAt,
      teams: {
        local: {
          name: pickName(local),
          coach: pickCoach(local),
          eloRating: pickElo(local),
        },
        visitor: {
          name: pickName(visitor),
          coach: pickCoach(visitor),
          eloRating: pickElo(visitor),
        },
      },
      score: { teamA: 0, teamB: 0 }, // TODO: remplacer par score reel quand disponible
      half,
      turn,
      acceptances: { local: localAccepted, visitor: visitorAccepted },
    });
  } catch (e: unknown) {
    serverLog.error(e);
    sendError(res, 'Erreur serveur', 500);
  }
}
