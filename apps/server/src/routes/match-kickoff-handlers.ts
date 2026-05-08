/**
 * S27.8.21 — Module dedie aux 3 handlers de la sequence de kickoff
 * extraits depuis `routes/match.ts`.
 *
 * Endpoints couverts :
 *  - `POST /:id/place-kickoff-ball` — `handlePlaceKickoffBall` :
 *    placer le ballon par l'equipe qui frappe au coup d'envoi.
 *  - `POST /:id/calculate-kick-deviation` — `handleCalculateKickDeviation` :
 *    calcule la deviation deterministe du coup de pied (RNG seede sur
 *    `${match.seed}-kick-deviation`).
 *  - `POST /:id/resolve-kickoff-event` — `handleResolveKickoffEvent` :
 *    resout l'evenement de kickoff puis demarre le match (incluant
 *    declenchement boucle IA si l'IA est l'equipe receveuse).
 *
 * Les 3 handlers sont thematiquement coheressents (sequence de
 * kickoff) et n'ont aucune dependance vers les autres handlers de
 * `match.ts` (move, state, details, lifecycle). Helpers leaf
 * uniquement : `prisma`, `scheduleAILoop`, `serverLog`, dynamic
 * imports `@bb/game-engine` (`placeKickoffBall`,
 * `calculateKickDeviation`, `resolveKickoffEvent`,
 * `startMatchFromKickoff`, `makeRNG`) et
 * `services/game-broadcast.broadcastGameState`.
 *
 * Apres extraction, `match.ts` re-exporte ces handlers pour preserver
 * l'API publique consommee par les tests d'integration.
 */

import type { Response } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/authUser';
import { scheduleAILoop } from '../services/ai-loop';
import { serverLog } from '../utils/server-log';

/**
 * S27.8.21 — `POST /match/:id/place-kickoff-ball`
 *
 * Place le ballon en zone de coup d'envoi. Valide la phase
 * `kickoff-sequence` puis applique `placeKickoffBall` du moteur de jeu.
 * Le ballon est ensuite expose au frontend via `gameState.ball`.
 */
export async function handlePlaceKickoffBall(
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response | void> {
  try {
    const matchId = req.params.id;
    const { position } = req.body;

    // Verifier que le match existe et est en phase kickoff-sequence
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
        .json({ error: "La partie n'est pas en phase de kickoff" });
    }

    // Recuperer le dernier etat du jeu
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastStateTurn = [...match.turns]
      .reverse()
      .find((t: any) => t.payload?.gameState);
    let gameState = lastStateTurn?.payload?.gameState;
    if (typeof gameState === 'string') {
      gameState = JSON.parse(gameState);
    }

    if (gameState?.preMatch?.phase !== 'kickoff-sequence') {
      return res
        .status(400)
        .json({ error: 'Pas en phase de séquence de kickoff' });
    }

    // Placer le ballon
    const { placeKickoffBall } = await import('@bb/game-engine');
    let newState = placeKickoffBall(gameState, position);

    // Exposer la position du ballon pour le rendu frontend
    if (newState.preMatch?.ballPosition) {
      newState = { ...newState, ball: newState.preMatch.ballPosition };
    }

    // Sauvegarder le nouvel etat
    await prisma.turn.create({
      data: {
        matchId,
        number: match.turns.length + 1,
        payload: {
          type: 'place-kickoff-ball',
          userId: req.user!.id,
          position,
          gameState: newState,
          timestamp: new Date().toISOString(),
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
        newState,
        { type: 'place-kickoff-ball' },
        req.user!.id,
      );
    } catch {}

    return res.json({
      success: true,
      gameState: newState,
      message: 'Ballon placé pour le kickoff',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    serverLog.error('Erreur lors du placement du ballon:', e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * S27.8.21 — `POST /match/:id/calculate-kick-deviation`
 *
 * Calcule la deviation du coup de pied avec un RNG deterministe seede
 * sur `${match.seed}-kick-deviation`. Verifie que le match est en
 * phase `kickoff-sequence` et l'etape `kick-deviation` avant
 * d'appliquer.
 */
export async function handleCalculateKickDeviation(
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response | void> {
  try {
    const matchId = req.params.id;

    // Verifier que le match existe
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { turns: { orderBy: { number: 'asc' } } },
    });

    if (!match) {
      return res.status(404).json({ error: 'Partie introuvable' });
    }

    // Recuperer le dernier etat du jeu
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastStateTurn = [...match.turns]
      .reverse()
      .find((t: any) => t.payload?.gameState);
    let gameState = lastStateTurn?.payload?.gameState;
    if (typeof gameState === 'string') {
      gameState = JSON.parse(gameState);
    }

    if (
      gameState?.preMatch?.phase !== 'kickoff-sequence' ||
      gameState?.preMatch?.kickoffStep !== 'kick-deviation'
    ) {
      return res
        .status(400)
        .json({ error: 'Pas en phase de calcul de déviation' });
    }

    // Calculer la deviation avec un RNG deterministe
    const { calculateKickDeviation, makeRNG } = await import('@bb/game-engine');
    const deviationRng = makeRNG(`${match.seed}-kick-deviation`);
    const newState = calculateKickDeviation(gameState, deviationRng);

    // Sauvegarder le nouvel etat
    await prisma.turn.create({
      data: {
        matchId,
        number: match.turns.length + 1,
        payload: {
          type: 'calculate-kick-deviation',
          userId: req.user!.id,
          deviation: newState.preMatch.kickDeviation,
          gameState: newState,
          timestamp: new Date().toISOString(),
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
        newState,
        { type: 'calculate-kick-deviation' },
        req.user!.id,
      );
    } catch {}

    return res.json({
      success: true,
      gameState: newState,
      message: 'Déviation du kickoff calculée',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    serverLog.error('Erreur lors du calcul de déviation:', e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

/**
 * S27.8.21 — `POST /match/:id/resolve-kickoff-event`
 *
 * Resout l'evenement de kickoff puis demarre le match (incluant
 * effets meteo via `startMatchFromKickoff`). Determine quel coach
 * joue en premier (l'equipe receveuse) et passe `match.status` a
 * `active`. Si l'IA est l'equipe receveuse, declenche immediatement
 * la boucle IA via `scheduleAILoop`.
 */
export async function handleResolveKickoffEvent(
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response | void> {
  try {
    const matchId = req.params.id;

    // Verifier que le match existe
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { turns: { orderBy: { number: 'asc' } } },
    });

    if (!match) {
      return res.status(404).json({ error: 'Partie introuvable' });
    }

    // Recuperer le dernier etat du jeu
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastStateTurn = [...match.turns]
      .reverse()
      .find((t: any) => t.payload?.gameState);
    let gameState = lastStateTurn?.payload?.gameState;
    if (typeof gameState === 'string') {
      gameState = JSON.parse(gameState);
    }

    if (
      gameState?.preMatch?.phase !== 'kickoff-sequence' ||
      gameState?.preMatch?.kickoffStep !== 'kickoff-event'
    ) {
      return res
        .status(400)
        .json({ error: "Pas en phase d'événement de kickoff" });
    }

    // Resoudre l'evenement avec un RNG deterministe
    const { resolveKickoffEvent, startMatchFromKickoff, makeRNG } =
      await import('@bb/game-engine');
    const kickoffRng = makeRNG(`${match.seed}-kickoff-event`);
    const newState = resolveKickoffEvent(gameState, kickoffRng);

    // Demarrer le match apres resolution de l'evenement (avec RNG pour effets meteo)
    const matchState = startMatchFromKickoff(newState, kickoffRng);

    // Determiner qui joue en premier (l'equipe receveuse = currentPlayer)
    const selections = await prisma.teamSelection.findMany({
      where: { matchId },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });
    const firstPlayerUserId =
      matchState.currentPlayer === 'A'
        ? selections[0]?.userId
        : selections[1]?.userId;

    // Passer le match en statut "active" pour autoriser les coups
    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'active',
        currentTurnUserId: firstPlayerUserId || null,
        lastMoveAt: new Date(),
      },
    });

    // Practice vs AI — if the first player is the AI, start the loop.
    const postKickoffMatch = await prisma.match.findUnique({
      where: { id: matchId },
      select: { aiOpponent: true, aiTeamSide: true, aiUserId: true },
    });
    if (
      postKickoffMatch?.aiOpponent &&
      postKickoffMatch.aiTeamSide &&
      postKickoffMatch.aiUserId &&
      firstPlayerUserId === postKickoffMatch.aiUserId
    ) {
      scheduleAILoop(matchId);
    }

    // Sauvegarder le nouvel etat
    await prisma.turn.create({
      data: {
        matchId,
        number: match.turns.length + 1,
        payload: {
          type: 'resolve-kickoff-event',
          userId: req.user!.id,
          kickoffEvent: gameState.preMatch.kickoffEvent,
          gameState: matchState,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Notifier les deux joueurs via WebSocket que le match commence
    try {
      const { broadcastGameState } = await import(
        '../services/game-broadcast'
      );
      broadcastGameState(
        matchId,
        matchState,
        { type: 'resolve-kickoff-event' },
        req.user!.id,
      );
    } catch {}

    return res.json({
      success: true,
      gameState: matchState,
      message: 'Événement de kickoff résolu - Le match commence !',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    serverLog.error("Erreur lors de la résolution de l'événement:", e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
