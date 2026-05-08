/**
 * S27.8.19 — Module dedie aux 5 handlers "details / list" extraits
 * depuis `routes/match.ts`. Ils sont thematiquement coheressents
 * (lecture de metadonnees du match : noms d'equipes, coachs, scores,
 * acceptations) et n'ont aucune dependance vers les autres handlers
 * de cycle de vie (creation, join, accept, move).
 *
 * Endpoints couverts :
 *  - `GET /details` (token-based) — `handleGetMatchDetailsByToken`
 *  - `GET /:id/details` (auth) — `handleGetMatchDetails`
 *  - `GET /:id/teams` (auth) — `handleGetMatchTeams`
 *  - `GET /my-matches` (auth) — `handleListMyMatches`
 *  - `GET /:id/summary` (auth) — `handleGetMatchSummary`
 *
 * Apres extraction, `match.ts` re-exporte ces handlers pour preserver
 * l'API publique consommee par les tests d'integration.
 */

import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/authUser';
import { MATCH_SECRET } from '../config';
import { serverLog } from '../utils/server-log';
import { sendError, sendSuccess } from '../utils/api-response';

/**
 * S25.5j / S27.8.19 — `GET /match/details`
 *
 * Details d'un match (noms equipes/coachs) accedes via un token JWT
 * (`x-match-token`). Pas d'auth utilisateur classique requise. Resout
 * `local` = celui qui possede le token, `visitor` = l'autre.
 */
export async function handleGetMatchDetailsByToken(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const token = (req.headers['x-match-token'] as string) || '';
    if (!token) {
      sendError(res, 'x-match-token requis', 401);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload = jwt.verify(token, MATCH_SECRET) as any;
    } catch {
      sendError(res, 'x-match-token invalide', 401);
      return;
    }
    const matchId = payload?.matchId as string | undefined;
    if (!matchId) {
      sendError(res, 'matchId manquant dans le token', 400);
      return;
    }

    const [match, selections] = await Promise.all([
      prisma.match.findUnique({
        where: { id: matchId },
        select: { id: true, creatorId: true },
      }),
      prisma.teamSelection.findMany({
        where: { matchId },
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          teamRef: { select: { name: true, roster: true } },
        },
      }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokenUserId = (payload as any)?.userId as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let local = selections.find((s: any) => s.userId === tokenUserId) || null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let visitor = selections.find((s: any) => s.userId !== tokenUserId) || null;
    if (!local || !visitor) {
      if (match?.creatorId) {
        local =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          selections.find((s: any) => s.userId === match.creatorId) || selections[0];
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamName = (sel: any): string => {
      if (!sel) return '';
      return sel.teamRef?.name || sel.teamRef?.roster || sel.team || '';
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coachName = (sel: any): string => {
      if (!sel) return '';
      return sel.user?.name || sel.user?.email || '';
    };

    sendSuccess(res, {
      matchId,
      local: {
        teamName: teamName(local),
        coachName: coachName(local),
        userId: local?.userId || null,
      },
      visitor: {
        teamName: teamName(visitor),
        coachName: coachName(visitor),
        userId: visitor?.userId || null,
      },
    });
  } catch (e: unknown) {
    serverLog.error(e);
    sendError(res, 'Erreur serveur', 500);
  }
}

/**
 * S25.5j / S27.8.19 — `GET /match/:id/details`
 *
 * Details du match accedes via id (auth utilisateur). Resolut `local`
 * = utilisateur authentifie, `visitor` = l'autre.
 */
export async function handleGetMatchDetails(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const matchId = req.params.id;
    const [match, selections] = await Promise.all([
      prisma.match.findUnique({
        where: { id: matchId },
        select: { id: true, creatorId: true },
      }),
      prisma.teamSelection.findMany({
        where: { matchId },
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, name: true, email: true, eloRating: true } },
          teamRef: { select: { name: true, roster: true } },
        },
      }),
    ]);
    if (!match) {
      sendError(res, 'Partie introuvable', 404);
      return;
    }
    const authenticatedUserId = req.user!.id;
    let local =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      selections.find((s: any) => s.userId === authenticatedUserId) || null;
    let visitor =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      selections.find((s: any) => s.userId !== authenticatedUserId) || null;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamName = (sel: any) =>
      sel?.teamRef?.name || sel?.teamRef?.roster || sel?.team || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coachName = (sel: any) => sel?.user?.name || sel?.user?.email || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eloRating = (sel: any) => sel?.user?.eloRating ?? 1000;
    sendSuccess(res, {
      matchId,
      local: { teamName: teamName(local), coachName: coachName(local), eloRating: eloRating(local) },
      visitor: { teamName: teamName(visitor), coachName: coachName(visitor), eloRating: eloRating(visitor) },
    });
  } catch (e: unknown) {
    serverLog.error(e);
    sendError(res, 'Erreur serveur', 500);
  }
}

/**
 * S25.5j / S27.8.19 — `GET /match/:id/teams`
 *
 * Equipes et joueurs (vue absolue A/B, independante de l'utilisateur
 * connecte). Utilise pour le fallback prematch.
 */
export async function handleGetMatchTeams(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const matchId = req.params.id;
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true },
    });
    if (!match) {
      sendError(res, 'Partie introuvable', 404);
      return;
    }

    const selections = await prisma.teamSelection.findMany({
      where: { matchId },
      orderBy: { createdAt: 'asc' },
      include: { teamRef: { include: { players: true } } },
    });

    const s1 = selections[0] || null;
    const s2 = selections[1] || null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getTeamData = (sel: any) => {
      const teamName = sel?.teamRef?.name || sel?.team || 'Équipe Inconnue';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const players = (sel?.teamRef?.players || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        number: p.number,
        ma: p.ma,
        st: p.st,
        ag: p.ag,
        pa: p.pa,
        av: p.av,
        skills: p.skills || '',
      }));
      return { teamName, players };
    };

    const teamA = getTeamData(s1);
    const teamB = getTeamData(s2);

    sendSuccess(res, { teamA, teamB });
  } catch (e: unknown) {
    serverLog.error(e);
    sendError(res, 'Erreur serveur', 500);
  }
}

/**
 * S25.5h / S27.8.19 — `GET /match/my-matches`
 *
 * Liste des 50 derniers matchs de l'utilisateur connecte avec score
 * relatif (myScore/opponentScore selon le cote du joueur).
 */
export async function handleListMyMatches(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user!.id;

    const matches = await prisma.match.findMany({
      where: {
        players: { some: { id: userId } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        teamSelections: {
          include: {
            user: { select: { id: true, coachName: true, eloRating: true } },
            teamRef: { select: { id: true, name: true, roster: true } },
          },
        },
        turns: {
          orderBy: { number: 'desc' },
          take: 1,
          select: { payload: true },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = matches.map((m: any) => {
      // Extraire le score depuis le dernier turn si disponible
      const lastTurn = m.turns[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gameState = (lastTurn?.payload as any)?.gameState;
      const score = gameState?.score || { teamA: 0, teamB: 0 };
      const half = gameState?.half || 0;
      const turn = gameState?.turn || 0;

      // Determiner le cote de l'utilisateur
      const selections = m.teamSelections.sort(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mySelection = selections.find((s: any) => s.userId === userId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opponentSelection = selections.find((s: any) => s.userId !== userId);
      const isMyTurn = m.currentTurnUserId === userId;

      // Align score with user's side: first selection = teamA, second = teamB
      const isTeamA = mySelection === selections[0];
      const myScore = isTeamA ? score.teamA : score.teamB;
      const opponentScore = isTeamA ? score.teamB : score.teamA;

      return {
        id: m.id,
        status: m.status,
        createdAt: m.createdAt,
        lastMoveAt: m.lastMoveAt,
        isMyTurn,
        score,
        myScore,
        opponentScore,
        half,
        turn,
        myTeam: mySelection
          ? {
              coachName: mySelection.user.coachName,
              teamName: mySelection.teamRef?.name || mySelection.team,
              rosterName: mySelection.teamRef?.roster,
              eloRating: mySelection.user.eloRating,
            }
          : null,
        opponent: opponentSelection
          ? {
              coachName: opponentSelection.user.coachName,
              teamName: opponentSelection.teamRef?.name || opponentSelection.team,
              rosterName: opponentSelection.teamRef?.roster,
              eloRating: opponentSelection.user.eloRating,
            }
          : null,
      };
    });

    sendSuccess(res, { matches: result });
  } catch (e: unknown) {
    serverLog.error(e);
    sendError(res, 'Erreur serveur', 500);
  }
}

/**
 * S25.5k / S27.8.19 — `GET /match/:id/summary`
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
          user: { select: { id: true, name: true, email: true, eloRating: true } },
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
        local: { name: pickName(local), coach: pickCoach(local), eloRating: pickElo(local) },
        visitor: { name: pickName(visitor), coach: pickCoach(visitor), eloRating: pickElo(visitor) },
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
