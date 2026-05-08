/**
 * S27.8.29 — Module dedie au handler `handleValidateSetup` extrait
 * depuis l'inline anonyme `POST /:id/validate-setup` dans
 * `routes/match.ts`. Septieme slice du refactor monolith match.ts.
 *
 * Endpoint couvert :
 *  - `POST /match/:id/validate-setup` — valide le placement des
 *    joueurs en phase prematch-setup. Flux complet :
 *    1. Verifie match existe + phase setup/active + user is a coach
 *    2. Persiste idempotently la transition idle -> setup via
 *       `ensureSetupPhasePersisted`
 *    3. Cree un turn `validate-setup` avec les positions
 *    4. Selectionne le `gameState` canonique (validate-setup recent
 *       en priorite, sinon ensured)
 *    5. Met a jour les positions des joueurs dans le gameState
 *    6. Verifie que le user est bien le coach actuel (403 sinon)
 *    7. Si 11 joueurs places : valide le placement et lance la
 *       sequence kickoff via `validatePlayerPlacement` +
 *       `startKickoffSequence`
 *    8. Persiste le gameState mis a jour
 *    9. Broadcast WebSocket aux deux coachs
 *    10. Si l'IA doit placer ensuite, la fait jouer cote serveur
 *    11. Si on entre en phase kickoff/kickoff-sequence, met match
 *        en `active`, declenche la boucle IA si necessaire,
 *        execute `runAIKickoffIfNeeded` si l'IA frappe
 *
 * Helpers leaf uniquement : `prisma`, `ensureSetupPhasePersisted`,
 * `runAISetupIfNeeded`, `runAIKickoffIfNeeded`, `scheduleAILoop`,
 * `getUserTeamSide`, `serverLog`, dynamic imports `@bb/game-engine`
 * et `services/game-broadcast`. Aucun cycle vers `match.ts`.
 *
 * Apres extraction, `match.ts` re-exporte ce handler.
 */

import type { Response } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/authUser';
import { ensureSetupPhasePersisted } from '../services/prematch-setup';
import { runAISetupIfNeeded } from '../services/ai-setup';
import { runAIKickoffIfNeeded } from '../services/ai-kickoff';
import { scheduleAILoop } from '../services/ai-loop';
import { getUserTeamSide } from '../services/turn-ownership';
import { serverLog } from '../utils/server-log';

/**
 * S27.8.29 — `POST /match/:id/validate-setup`
 *
 * Valide le placement des joueurs en phase prematch-setup. Voir
 * doc du module pour le flux complet.
 */
export async function handleValidateSetup(
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response | void> {
  try {
    const matchId = req.params.id;
    const { placedPlayers, playerPositions } = req.body;

    // Verifier que le match existe et est en phase setup
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { turns: { orderBy: { number: 'asc' } } },
    });

    if (!match) {
      return res.status(404).json({ error: 'Partie introuvable' });
    }

    if (match.status !== 'prematch-setup' && match.status !== 'active') {
      return res
        .status(400)
        .json({ error: "La partie n'est pas en phase de setup" });
    }

    // Verifier que l'utilisateur est bien un des joueurs de la partie
    const selections = await prisma.teamSelection.findMany({
      where: { matchId },
      select: { userId: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userIds = selections.map((s: any) => s.userId);
    if (!userIds.includes(req.user!.id)) {
      return res
        .status(403)
        .json({ error: "Vous n'êtes pas un joueur de cette partie" });
    }

    // Idempotently persist the idle -> setup transition before doing anything
    // else. The returned `gameState` is the canonical post-bypass state
    // (preferring `setup-init`/`validate-setup` over a stale
    // `pre-match-sequence` written by the parallel automation).
    const ensured = await ensureSetupPhasePersisted(
      matchId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any,
    );

    // Re-read turns after the potential setup-init insert.
    const refreshedTurns = await prisma.turn.findMany({
      where: { matchId },
      orderBy: { number: 'asc' },
    });

    // Creer un nouveau turn pour sauvegarder le placement
    const newTurn = await prisma.turn.create({
      data: {
        matchId,
        number: refreshedTurns.length + 1,
        payload: {
          type: 'validate-setup',
          userId: req.user!.id,
          placedPlayers,
          playerPositions,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Build the working gameState. Prefer the most recent `validate-setup`
    // (carries player placements), then fall back to the canonical state
    // returned by `ensureSetupPhasePersisted` (skips a stale
    // `pre-match-sequence` written by the parallel automation).
    const lastValidateSetupTurn = [...refreshedTurns]
      .reverse()
      .find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (t: any) =>
          t.payload?.type === 'validate-setup' && t.payload?.gameState,
      );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let gameState: any = lastValidateSetupTurn
      ? lastValidateSetupTurn.payload.gameState
      : ensured?.gameState;
    if (typeof gameState === 'string') {
      gameState = JSON.parse(gameState);
    }

    // Mettre a jour les positions des joueurs dans l'etat du jeu
    if (gameState && gameState.players) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gameState.players.forEach((player: any) => {
        const newPosition = playerPositions.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (pos: any) => pos.playerId === player.id,
        );
        if (newPosition) {
          player.pos = { x: newPosition.x, y: newPosition.y };
        }
      });
    }

    // Verifier que l'utilisateur est bien le coach actuel
    const userTeamSide = await getUserTeamSide(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any,
      matchId,
      req.user!.id,
    );
    const currentCoach = gameState.preMatch?.currentCoach;
    if (userTeamSide !== currentCoach) {
      return res
        .status(403)
        .json({ error: "Ce n'est pas votre tour de placer" });
    }

    const playersOnField =
      gameState.players?.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => p.team === currentCoach && p.pos.x >= 0,
      ).length || 0;

    // Si 11 joueurs sont places, utiliser la fonction de validation explicite
    if (playersOnField === 11) {
      const { validatePlayerPlacement, startKickoffSequence } = await import(
        '@bb/game-engine'
      );

      // Valider le placement et passer a la phase suivante
      gameState = validatePlayerPlacement(gameState);

      // Si on arrive en phase kickoff, commencer la sequence
      if (gameState.preMatch.phase === 'kickoff') {
        gameState = startKickoffSequence(gameState);
      }
    }

    // Sauvegarder l'etat mis a jour dans le nouveau turn
    await prisma.turn.update({
      where: { id: newTurn.id },
      data: {
        payload: {
          ...newTurn.payload,
          gameState,
        },
      },
    });

    // Notifier l'adversaire via WebSocket
    try {
      const { broadcastGameState } = await import(
        '../services/game-broadcast'
      );
      broadcastGameState(
        matchId,
        gameState,
        { type: 'validate-setup' },
        req.user!.id,
      );
    } catch {}

    // Si apres validation l'IA doit placer ses joueurs, on le fait cote serveur.
    // Sans ceci, le match reste bloque en phase setup pour les matchs pratique online.
    const aiMatchForSetup = await prisma.match.findUnique({
      where: { id: matchId },
      select: { aiOpponent: true, aiTeamSide: true },
    });
    if (
      aiMatchForSetup?.aiOpponent &&
      aiMatchForSetup.aiTeamSide &&
      gameState.preMatch?.phase === 'setup' &&
      gameState.preMatch?.currentCoach === aiMatchForSetup.aiTeamSide
    ) {
      const report = await runAISetupIfNeeded(
        matchId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prisma as any,
      );
      if (report.ran && report.gameState) {
        gameState = report.gameState;
      }
    }

    // Mettre a jour le statut du match si kickoff atteint
    if (
      gameState.preMatch?.phase === 'kickoff' ||
      gameState.preMatch?.phase === 'kickoff-sequence'
    ) {
      await prisma.match.update({
        where: { id: matchId },
        data: { status: 'active' },
      });
      // If the active player is the AI, kick off the loop.
      const postMatch = await prisma.match.findUnique({
        where: { id: matchId },
        select: { aiOpponent: true, aiTeamSide: true },
      });
      if (
        postMatch?.aiOpponent &&
        postMatch.aiTeamSide &&
        gameState.currentPlayer === postMatch.aiTeamSide
      ) {
        scheduleAILoop(matchId);
      }
      // Si l'IA est l'equipe qui frappe, placer immediatement le ballon pour
      // eviter que le match reste bloque sur l'etape `place-ball` du kickoff.
      if (
        postMatch?.aiOpponent &&
        postMatch.aiTeamSide &&
        gameState.preMatch?.phase === 'kickoff-sequence' &&
        gameState.preMatch?.kickoffStep === 'place-ball' &&
        gameState.preMatch?.kickingTeam === postMatch.aiTeamSide
      ) {
        const kickoffReport = await runAIKickoffIfNeeded(
          matchId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          prisma as any,
        );
        if (kickoffReport.ran && kickoffReport.gameState) {
          gameState = kickoffReport.gameState;
        }
      }
    }

    // Determiner le message approprie
    let message = 'Placement validé et sauvegardé';
    if (playersOnField === 11) {
      if (
        gameState.preMatch?.phase === 'kickoff' ||
        gameState.preMatch?.phase === 'kickoff-sequence'
      ) {
        message = 'Placement validé - Le match commence !';
      } else {
        message = 'Placement validé - Passage au coach suivant';
      }
    }

    return res.json({
      success: true,
      gameState,
      message,
      isMyTurn: gameState.preMatch?.currentCoach === userTeamSide,
      myTeamSide: userTeamSide,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    serverLog.error('Erreur lors de la validation du setup:', e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
