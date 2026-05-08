/**
 * S27.8.17 — Module dedie aux 3 handlers de lecture en lecture seule
 * extraits depuis `routes/match.ts` :
 *  - `handleListMatchTurns` : `GET /:id/turns` — historique des turns
 *    avec snapshots de gameState (number, type, half, turn, score,
 *    moveType). Verifie que l'utilisateur est un joueur du match.
 *  - `handleGetMatchResults` : `GET /:id/results` — score final,
 *    gagnant, ELO, stats par equipe, fan attendance pour un match
 *    `ended`.
 *  - `handleListLiveMatches` : `GET /live` — liste des 20 matchs
 *    `active` ou `prematch-setup` les plus recents pour le mode
 *    spectateur.
 *
 * Les 3 handlers sont thematiquement coheressents (lecture seule,
 * pas de mutation) et n'ont aucune dependance vers les autres
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
 * S25.5i / S27.8.17 — `GET /match/:id/turns`
 *
 * Historique des turns d'un match. Le user doit etre l'un des deux
 * joueurs du match (refuse 403 sinon). Retourne un resume par turn
 * incluant `half`, `turn`, `score`, `moveType` extraits du `payload`.
 */
export async function handleListMatchTurns(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const matchId = req.params.id;
    const userId = req.user!.id;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, status: true, players: { select: { id: true } } },
    });

    if (!match) {
      sendError(res, 'Partie introuvable', 404);
      return;
    }

    const isPlayer = match.players.some((p: { id: string }) => p.id === userId);
    if (!isPlayer) {
      sendError(res, "Vous n'etes pas un joueur de cette partie", 403);
      return;
    }

    const turns = await prisma.turn.findMany({
      where: { matchId },
      orderBy: { number: 'asc' },
      select: {
        id: true,
        number: true,
        createdAt: true,
        payload: true,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const turnSummaries = turns.map((t: any) => {
      const payload = t.payload || {};
      const rawGs = payload.gameState;
      const gs = typeof rawGs === 'string' ? JSON.parse(rawGs) : rawGs;
      return {
        id: t.id,
        number: t.number,
        createdAt: t.createdAt,
        type: payload.type || 'unknown',
        userId: payload.userId || null,
        half: gs?.half || null,
        turn: gs?.turn || null,
        score: gs?.score || null,
        moveType: payload.move?.type || null,
      };
    });

    sendSuccess(res, { matchId, turns: turnSummaries });
  } catch (e: unknown) {
    serverLog.error('Erreur lors de la récupération des turns:', e);
    sendError(res, 'Erreur serveur', 500);
  }
}

/**
 * S25.5i / S27.8.17 — `GET /match/:id/results`
 *
 * Resultats finaux d'un match termine : score, gagnant, ELO actuels,
 * stats par equipe (touchdowns, casualties, completions, interceptions),
 * fan attendance, dedicatedFansChange. Refuse les matchs non termines.
 */
export async function handleGetMatchResults(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const matchId = req.params.id;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, status: true, createdAt: true },
    });
    if (!match) {
      sendError(res, 'Partie introuvable', 404);
      return;
    }
    if (match.status !== 'ended') {
      sendError(res, "Le match n'est pas encore termine", 400);
      return;
    }

    const selections = await prisma.teamSelection.findMany({
      where: { matchId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true, eloRating: true } },
        teamRef: { select: { name: true, roster: true } },
      },
    });

    const selA = selections[0] || null;
    const selB = selections[1] || null;

    const lastTurn = await prisma.turn.findFirst({
      where: { matchId },
      orderBy: { number: 'desc' },
      select: { payload: true, createdAt: true },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = (lastTurn as any)?.payload || {};
    const rawGs = payload.gameState;
    const gameState = typeof rawGs === 'string' ? JSON.parse(rawGs) : rawGs;

    const score = gameState?.score || { teamA: 0, teamB: 0 };
    const winner: 'A' | 'B' | 'draw' =
      score.teamA > score.teamB ? 'A' : score.teamB > score.teamA ? 'B' : 'draw';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamName = (sel: any) => sel?.teamRef?.name || sel?.teamRef?.roster || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coachName = (sel: any) => sel?.user?.name || sel?.user?.email || '';

    const currentEloA = selA?.user?.eloRating ?? 1000;
    const currentEloB = selB?.user?.eloRating ?? 1000;

    const matchStats = gameState?.matchStats || {};
    const players = gameState?.players || [];
    const matchResult = gameState?.matchResult || {};

    const teamStats = {
      A: { touchdowns: 0, casualties: 0, completions: 0, interceptions: 0 },
      B: { touchdowns: 0, casualties: 0, completions: 0, interceptions: 0 },
    };
    for (const p of players) {
      const stats = matchStats[p.id];
      if (!stats) continue;
      const side = p.team as 'A' | 'B';
      if (!teamStats[side]) continue;
      teamStats[side].touchdowns += stats.touchdowns || 0;
      teamStats[side].casualties += stats.casualties || 0;
      teamStats[side].completions += stats.completions || 0;
      teamStats[side].interceptions += stats.interceptions || 0;
    }

    const winnings = matchResult?.winnings || null;
    const dedicatedFansChange = matchResult?.dedicatedFansChange || null;
    const fanAttendance = gameState?.fanAttendance || null;

    sendSuccess(res, {
      matchId,
      status: 'ended',
      createdAt: match.createdAt,
      endedAt: lastTurn?.createdAt || null,
      score,
      winner,
      teams: {
        A: {
          name: teamName(selA),
          coach: coachName(selA),
          eloRating: currentEloA,
          stats: teamStats.A,
        },
        B: {
          name: teamName(selB),
          coach: coachName(selB),
          eloRating: currentEloB,
          stats: teamStats.B,
        },
      },
      matchStats,
      matchResult,
      winnings,
      dedicatedFansChange,
      fanAttendance,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      players: players.map((p: any) => ({
        id: p.id,
        team: p.team,
        name: p.name,
        number: p.number ?? 0,
        position: p.position ?? '',
      })),
    });
  } catch (e: unknown) {
    serverLog.error('Erreur lors de la récupération des résultats:', e);
    sendError(res, 'Erreur serveur', 500);
  }
}

/**
 * S25.5h / S27.8.17 — `GET /match/live`
 *
 * Liste les 20 matchs `active` ou `prematch-setup` les plus recents
 * (par `lastMoveAt desc`) pour le mode spectateur, avec score, half,
 * turn, spectatorCount, et noms d'equipes/coachs.
 */
export async function handleListLiveMatches(
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const matches = await prisma.match.findMany({
      where: {
        status: { in: ['active', 'prematch-setup'] },
      },
      orderBy: { lastMoveAt: 'desc' },
      take: 20,
      include: {
        teamSelections: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, coachName: true } },
            teamRef: { select: { name: true, roster: true } },
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
      const lastTurn = m.turns[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gameState = (lastTurn?.payload as any)?.gameState;
      const score = gameState?.score || { teamA: 0, teamB: 0 };
      const half = gameState?.half || 0;
      const turn = gameState?.turn || 0;

      const selections = m.teamSelections.sort(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      const teamA = selections[0];
      const teamB = selections[1];

      return {
        id: m.id,
        status: m.status,
        createdAt: m.createdAt,
        lastMoveAt: m.lastMoveAt,
        score,
        half,
        turn,
        spectatorCount: getSpectatorCount(m.id),
        teamA: teamA
          ? {
              coachName: teamA.user?.coachName || '',
              teamName: teamA.teamRef?.name || '',
              rosterName: teamA.teamRef?.roster || '',
            }
          : null,
        teamB: teamB
          ? {
              coachName: teamB.user?.coachName || '',
              teamName: teamB.teamRef?.name || '',
              rosterName: teamB.teamRef?.roster || '',
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
