/**
 * S27.8.20 — Module dedie aux 4 handlers de cycle de vie d'un match
 * (creation / join / accept / cancel) extraits depuis `routes/match.ts`.
 *
 * Endpoints couverts :
 *  - `POST /create` — `handleCreateMatch` : creer une partie pending
 *    avec options (terrainSkin, turnTimerEnabled, rulesMode), retourne
 *    `{ match, matchToken }`.
 *  - `POST /join` — `handleJoinMatch` : rejoindre un match existant,
 *    retourne `{ match, matchToken }`.
 *  - `POST /accept` — `handleAcceptMatch` : accepter le match (chaque
 *    coach doit accepter, declenche pre-match au second).
 *  - `POST /:id/cancel` — `handleCancelMatch` : annuler un match
 *    pending.
 *
 * Les 4 handlers sont thematiquement coheressents (mutation du cycle
 * de vie d'un match) et n'ont aucune dependance vers les autres
 * handlers de `match.ts` (move, state, details).
 *
 * Apres extraction, `match.ts` re-exporte ces handlers pour preserver
 * l'API publique consommee par les tests d'integration.
 */

import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/authUser';
import { acceptAndMaybeStartMatch } from '../services/match-start';
import { cancelMatch } from '../services/match-cancel';
import { MATCH_SECRET } from '../config';
import { serverLog } from '../utils/server-log';
import { sendError, sendSuccess } from '../utils/api-response';

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Erreur serveur';
}

/**
 * S25.5 / S27.8.20 — `POST /match/create`
 *
 * Cree une partie en `status: pending` avec un seed unique. Si des
 * options sont fournies (terrainSkin, turnTimerEnabled, rulesMode),
 * un turn 0 de type `match-options` est cree pour les persister.
 * Retourne le match cree et un JWT (`matchToken`) lie a l'utilisateur.
 */
export async function handleCreateMatch(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const { terrainSkin, turnTimerEnabled, rulesMode } = req.body || {};
    const seed = `match-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const match = await prisma.match.create({
      data: {
        status: 'pending',
        seed,
        players: { connect: { id: req.user!.id } },
      },
    });

    // Stocker les options de match dans un turn initial de type "options"
    const hasOptions =
      terrainSkin || typeof turnTimerEnabled === 'boolean' || rulesMode;
    if (hasOptions) {
      await prisma.turn.create({
        data: {
          matchId: match.id,
          number: 0,
          payload: {
            type: 'match-options',
            terrainSkin: terrainSkin || 'grass',
            turnTimerEnabled: turnTimerEnabled !== false,
            // N.2 — Mode simplifie pour debutants (leverager SIMPLIFIED_RULES).
            rulesMode: rulesMode === 'simplified' ? 'simplified' : 'full',
          },
        },
      });
    }
    const matchToken = jwt.sign(
      { matchId: match.id, userId: req.user!.id },
      MATCH_SECRET,
      { expiresIn: '2h' },
    );
    sendSuccess(res, { match, matchToken }, 201);
  } catch (e: unknown) {
    serverLog.error(e);
    sendError(res, errorMessage(e), 500);
  }
}

/**
 * S25.5 / S27.8.20 — `POST /match/join`
 *
 * Rejoindre une partie existante. Connecte l'utilisateur au match
 * (via Prisma `connect`) et retourne le match + un nouveau matchToken.
 */
export async function handleJoinMatch(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const { matchId } = req.body;
    const match = await prisma.match.update({
      where: { id: matchId },
      data: { players: { connect: { id: req.user!.id } } },
    });
    if (!match) {
      sendError(res, 'Partie introuvable', 404);
      return;
    }
    const matchToken = jwt.sign(
      { matchId: match.id, userId: req.user!.id },
      MATCH_SECRET,
      { expiresIn: '2h' },
    );
    sendSuccess(res, { match, matchToken });
  } catch (e: unknown) {
    serverLog.error(e);
    sendError(res, errorMessage(e), 500);
  }
}

/**
 * S25.5 / S27.8.20 — `POST /match/accept`
 *
 * Accepter le match : delegate au service `acceptAndMaybeStartMatch`
 * qui orchestre le double-accept et lance la sequence pre-match au
 * second accept.
 */
export async function handleAcceptMatch(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const { matchId }: { matchId: string } = req.body;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await acceptAndMaybeStartMatch(prisma as any, {
      matchId,
      userId: req.user!.id,
    });
    if (!result.ok && 'status' in result && typeof result.status === 'number') {
      sendError(res, result.error ?? 'Erreur', result.status);
      return;
    }
    sendSuccess(res, result);
  } catch (e: unknown) {
    serverLog.error(e);
    sendError(res, errorMessage(e), 500);
  }
}

/**
 * S25.5g / S27.8.20 — `POST /match/:id/cancel`
 *
 * Annuler un match pending (delegate au service `cancelMatch`).
 * Refuse si le match a deja commence ou si l'utilisateur n'est pas
 * inscrit au match.
 */
export async function handleCancelMatch(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const matchId = req.params.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await cancelMatch(prisma as any, {
      matchId,
      userId: req.user!.id,
    });
    if (!result.ok) {
      sendError(res, result.error, result.status);
      return;
    }
    sendSuccess(res, result);
  } catch (e: unknown) {
    serverLog.error(e);
    sendError(res, errorMessage(e), 500);
  }
}
