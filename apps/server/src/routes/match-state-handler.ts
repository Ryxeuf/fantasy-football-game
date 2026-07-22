/**
 * S27.8.18 — Module dedie a `handleGetMatchState` (~221 lignes), le
 * dernier gros handler de `routes/match.ts`. Extrait pour ramener le
 * fichier sous une cible raisonnable (~1170 lignes apres extraction).
 *
 * Le handler couvre `GET /:id/state` :
 *  1. Persiste atomiquement la transition `idle -> setup` si necessaire
 *     (`ensureSetupPhasePersisted`) puis declenche le placement IA si
 *     l'AI est le coach courant (`runAISetupIfNeeded`).
 *  2. Charge le match avec ses turns et selectionne le `gameState`
 *     canonique selon `match.status` :
 *     - `prematch-setup` / `active` : dernier turn avec `gameState`
 *       (le plus recent prevaut sur les `validate-setup` plus anciens).
 *     - `prematch` sans turn `start` : reconstruit via
 *       `setupPreMatchWithTeams` apres charger les selections + teams.
 *     - autres statuts : dernier turn ou turn `start`/`coin-toss`.
 *  3. Enrichit la reponse pour `active` (currentTeam, isMyTurn,
 *     myTeamSide, moveCount, lastMoveAt) et `prematch-setup`
 *     (myTeamSide, isMyTurn).
 *
 * Aucune dependance vers `routes/match.ts` : helpers leaf uniquement.
 * Apres extraction, `match.ts` re-exporte ce handler pour preserver
 * l'API publique consommee par les tests d'integration.
 */

import type { Response } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/authUser';
import { ensureSetupPhasePersisted } from '../services/prematch-setup';
import { runAISetupIfNeeded } from '../services/ai-setup';
import { getUserTeamSide } from '../services/turn-ownership';
import { serverLog } from '../utils/server-log';
import { sendError, sendSuccess } from '../utils/api-response';

/**
 * S25.5l / S27.8.18 — `GET /match/:id/state`
 *
 * Retourne l'etat de jeu d'un match. Persiste d'abord la transition
 * idle -> setup atomiquement, declenche le placement IA si necessaire,
 * puis selectionne le `gameState` canonique et enrichit la reponse
 * avec des metadonnees specifiques au statut du match.
 */
export async function handleGetMatchState(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const matchId = req.params.id;

    // Persist the idle → setup transition atomically before reading the
    // match. This makes the rest of this handler a pure read: any concurrent
    // call sees the same persisted state instead of running the transition
    // again in-memory. The returned `gameState` is the canonical post-bypass
    // state (preferring `setup-init`/`validate-setup` over a stale
    // `pre-match-sequence` written by the parallel automation).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ensured = await ensureSetupPhasePersisted(matchId, prisma as any);

    // Once the setup phase is persisted, if the AI is the current coach,
    // place its 11 players automatically so the match does not hang on a
    // coach that has no client submitting on its behalf.
    if (ensured?.gameState?.preMatch?.phase === 'setup') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runAISetupIfNeeded(matchId, prisma as any);
    }

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { turns: { orderBy: { number: 'asc' } } },
    });
    if (!match) {
      sendError(res, 'Partie introuvable', 404);
      return;
    }

    if (match.status === 'pending') {
      sendError(res, 'Partie pas encore prête', 400);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let gameState: any;

    // Pour prematch-setup, chercher le dernier turn avec gameState
    // (validate-setup, pre-match-sequence, inducements, ou coin-toss)
    const startTurn = match.turns.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t: any) =>
        t.payload?.type === 'start' || t.payload?.type === 'coin-toss',
    );
    if (match.status === 'prematch-setup' || match.status === 'active') {
      // L'état canonique est TOUJOURS le dernier turn avec gameState : il
      // intègre les étapes post-setup (place-kickoff-ball, kick-deviation,
      // resolve-kickoff-event, gameplay-move). Préférer un `validate-setup`
      // plus ancien renvoyait un état figé au client après que la séquence
      // kickoff ait progressé côté serveur, bloquant le joueur sur l'écran
      // "En attente du placement du ballon".
      const latestStateTurn = [...match.turns]
        .reverse()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .find((t: any) => t.payload?.gameState);
      if (latestStateTurn) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gs = (latestStateTurn.payload as any).gameState;
        gameState = typeof gs === 'string' ? JSON.parse(gs) : gs;
      } else if (ensured) {
        gameState = ensured.gameState;
      } else if (startTurn) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gs = (startTurn.payload as any).gameState;
        gameState = typeof gs === 'string' ? JSON.parse(gs) : gs;
      }
    } else if (startTurn) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gs = (startTurn.payload as any).gameState;
      gameState = typeof gs === 'string' ? JSON.parse(gs) : gs;
    } else if (match.status === 'prematch') {
      // Reconstruire si pas encore de turn start (cas edge)
      const selections = await prisma.teamSelection.findMany({
        where: { matchId },
        include: {
          user: true,
          teamRef: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      if (selections.length < 2) {
        sendError(res, 'Équipes pas prêtes', 400);
        return;
      }

      const [s1, s2] = selections;

      // Fetch teams séparément pour players
      const teamA = s1.teamId
        ? await prisma.team.findUnique({
            where: { id: s1.teamId },
            include: { players: true },
          })
        : null;
      const teamB = s2.teamId
        ? await prisma.team.findUnique({
            where: { id: s2.teamId },
            include: { players: true },
          })
        : null;

      if (!teamA || !teamB) {
        serverLog.log('Teams not found:', s1.teamId, s2.teamId);
        sendError(res, 'Équipes non trouvées', 400);
        return;
      }

      // Règle "Capitaine" : flag propagé uniquement si le capitaine est
      // toujours actif (non licencié).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toStateTeamPlayerData = (p: any) => ({
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
        isCaptain: Boolean(p.isCaptain) && !p.firedAt,
      });
      const teamAData = teamA.players
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((p: any) => !p.dead)
        .map(toStateTeamPlayerData);
      const teamBData = teamB.players
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((p: any) => !p.dead)
        .map(toStateTeamPlayerData);

      serverLog.log(
        'Players loaded for prematch:',
        teamAData.length,
        teamBData.length,
      ); // Trace

      const teamAName = s1.teamRef?.name || s1.team || 'Team A';
      const teamBName = s2.teamRef?.name || s2.team || 'Team B';

      const { setupPreMatchWithTeams } = await import('@bb/game-engine');
      // H.6 — propagate roster slugs so the client renderer can pick per-roster colors.
      gameState = setupPreMatchWithTeams(
        teamAData,
        teamBData,
        teamAName,
        teamBName,
        {
          teamARoster: teamA.roster,
          teamBRoster: teamB.roster,
        },
      );
    } else {
      // Pour active, dernier turn
      const lastTurn = match.turns[match.turns.length - 1];
      if (!lastTurn?.payload || typeof lastTurn.payload !== 'object') {
        sendError(res, 'État non trouvé', 500);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = lastTurn.payload as any;
      if (!payload.gameState) {
        sendError(res, 'État non trouvé', 500);
        return;
      }
      const gs = payload.gameState;
      gameState = typeof gs === 'string' ? JSON.parse(gs) : gs;
    }

    // Pour les matchs actifs, enrichir la réponse avec des métadonnées
    if (match.status === 'active' && gameState) {
      const userTeamSide = await getUserTeamSide(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma as any,
        matchId,
        req.user!.id,
      );
      const phase = gameState.preMatch?.phase;
      const isMyTurn = userTeamSide
        ? phase === 'setup' || phase === 'kickoff-sequence'
          ? gameState.preMatch?.currentCoach === userTeamSide
          : gameState.currentPlayer === userTeamSide
        : false;
      const moveCount = match.turns.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (t: any) => t.payload?.type === 'gameplay-move',
      ).length;
      const lastMoveTurn = [...match.turns]
        .reverse()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .find((t: any) => t.payload?.type === 'gameplay-move');

      sendSuccess(res, {
        gameState,
        matchStatus: match.status,
        currentTeam: gameState.currentPlayer,
        isMyTurn,
        myTeamSide: userTeamSide,
        moveCount,
        lastMoveAt: lastMoveTurn?.createdAt || null,
      });
      return;
    }

    // Pure read for prematch-setup: the idle → setup transition was already
    // persisted by ensureSetupPhasePersisted at the top of this handler.
    if (match.status === 'prematch-setup') {
      const userTeamSide = await getUserTeamSide(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma as any,
        matchId,
        req.user!.id,
      );
      sendSuccess(res, {
        gameState,
        matchStatus: match.status,
        myTeamSide: userTeamSide,
        isMyTurn: userTeamSide
          ? gameState?.preMatch?.currentCoach === userTeamSide
          : false,
      });
      return;
    }

    sendSuccess(res, { gameState });
  } catch (e: unknown) {
    serverLog.error(e);
    sendError(res, 'Erreur serveur', 500);
  }
}
