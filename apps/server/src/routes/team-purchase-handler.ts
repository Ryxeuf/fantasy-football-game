/**
 * S27.8.28 — Module dedie au handler `handlePurchase` extrait depuis
 * `routes/team.ts`. Septieme et derniere slice du refactor monolith
 * team.ts (2414 -> ~550 lignes).
 *
 * Endpoint couvert :
 *  - `POST /team/:id/purchase` — `handlePurchase` : achat avec
 *    tresorerie entre les matchs. 6 types pris en charge :
 *    - `player` (cout = position.cost*1000, validations slot+numero)
 *    - `reroll` (cout double = 2 * getRerollCost(roster), max 8)
 *    - `cheerleader` (cout 10k, max 12)
 *    - `assistant` (cout 10k, max 6)
 *    - `apothecary` (cout 50k, unique)
 *    - `dedicated_fan` (cout 10k, max 6)
 *    Lock match en cours. Update tresorerie + recalcule TV.
 *
 * Helpers leaf uniquement : `prisma`, `sendError`/`sendSuccess`,
 * `updateTeamValues`, `AllowedRoster`/`Ruleset`/`DEFAULT_RULESET`/
 * `getRerollCost` from `@bb/game-engine`, `getRosterFromDb`,
 * `serverLog`. Aucun cycle vers `team.ts`.
 *
 * Apres extraction, `team.ts` re-exporte ce handler pour preserver
 * l'API publique consommee par `team.test.ts`.
 */

import type { Response } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/authUser';
import { sendError, sendSuccess } from '../utils/api-response';
import { updateTeamValues } from '../utils/team-values';
import {
  type AllowedRoster,
  DEFAULT_RULESET,
  type Ruleset,
  getRerollCost,
} from '@bb/game-engine';
import { getRosterFromDb } from '../utils/roster-helpers';
import { serverLog } from '../utils/server-log';

type PurchaseType =
  | 'player'
  | 'reroll'
  | 'cheerleader'
  | 'assistant'
  | 'apothecary'
  | 'dedicated_fan';

/**
 * S25.5w / S27.8.28 — `POST /team/:id/purchase`
 *
 * Achat avec la tresorerie entre les matchs. 6 types : player,
 * reroll (cout double), cheerleader, assistant, apothecary,
 * dedicated_fan. Lock si match en cours. Recalcule TV apres.
 */
export async function handlePurchase(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const { type, position, name, number }: {
    type: PurchaseType;
    position?: string;
    name?: string;
    number?: number;
  } = req.body;

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { players: true },
    });

    if (!team) {
      sendError(res, 'Equipe introuvable', 404);
      return;
    }

    const activeSelection = await prisma.teamSelection.findFirst({
      where: {
        teamId,
        match: { status: { in: ['pending', 'active'] } },
      },
    });

    if (activeSelection) {
      sendError(res, "Impossible d'acheter pendant un match en cours", 400);
      return;
    }

    let cost = 0;
    let description = '';

    switch (type) {
      case 'player': {
        if (!position || !name || !number) {
          sendError(
            res,
            'position, name et number requis pour acheter un joueur',
            400,
          );
          return;
        }

        if (
          team.players.filter(
            (p: (typeof team.players)[number]) => !p.dead,
          ).length >= 16
        ) {
          sendError(
            res,
            'Une equipe ne peut pas avoir plus de 16 joueurs vivants',
            400,
          );
          return;
        }

        const existingNumber = team.players.find(
          (p: (typeof team.players)[number]) =>
            p.number === number && !p.dead,
        );
        if (existingNumber) {
          sendError(
            res,
            `Le numero ${number} est deja utilise par ${existingNumber.name}`,
            400,
          );
          return;
        }

        const rosterData = await getRosterFromDb(
          team.roster as AllowedRoster,
          'fr',
          (team.ruleset as Ruleset) ?? DEFAULT_RULESET,
        );
        if (!rosterData) {
          sendError(res, 'Roster non reconnu', 400);
          return;
        }

        const positionData = rosterData.positions.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p: any) => p.slug === position,
        );
        if (!positionData) {
          sendError(
            res,
            `Position '${position}' non trouvee dans le roster ${team.roster}`,
            400,
          );
          return;
        }

        const currentPositionCount = team.players.filter(
          (p: (typeof team.players)[number]) =>
            p.position === position && !p.dead,
        ).length;
        if (currentPositionCount >= positionData.max) {
          sendError(
            res,
            `Limite maximale atteinte pour la position ${positionData.displayName} (${positionData.max})`,
            400,
          );
          return;
        }

        cost = positionData.cost * 1000;

        if (team.treasury < cost) {
          sendError(
            res,
            `Tresorerie insuffisante. Cout: ${Math.round(cost / 1000)}k po, Tresorerie: ${Math.round(team.treasury / 1000)}k po`,
            400,
          );
          return;
        }

        await prisma.$transaction([
          prisma.teamPlayer.create({
            data: {
              teamId,
              name: name.trim(),
              position,
              number,
              ma: positionData.ma,
              st: positionData.st,
              ag: positionData.ag,
              pa: positionData.pa,
              av: positionData.av,
              skills: positionData.skills,
            },
          }),
          // Audit round 6 (CRITICAL/race) : avant, `treasury - cost`
          // sur le snapshot read pre-transaction → 2 player buys
          // concurrents pouvaient overwrite la treasury avec la meme
          // valeur stale. Fix : decrement atomique au niveau DB.
          prisma.team.update({
            where: { id: teamId },
            data: { treasury: { decrement: cost } },
          }),
        ]);

        description = `Joueur ${name.trim()} (${positionData.displayName}) recrute`;
        break;
      }

      case 'reroll': {
        // BUG fix audit round 6 (CRITICAL/race) : avant, le check
        // `team.treasury < cost` et l'update `treasury - cost` etaient
        // fait sur un snapshot read pre-transaction → 2 requetes
        // concurrentes pouvaient toutes deux passer la verif et
        // toutes deux ecrire `stale - cost` (lost-update). Fix :
        // updateMany conditionnelle WHERE treasury >= cost AND
        // rerolls < 8, avec decrement/increment atomiques. Si
        // count===0, soit budget insuffisant soit limite atteinte.
        cost = getRerollCost(team.roster) * 2;
        const updateResult = await prisma.team.updateMany({
          where: { id: teamId, treasury: { gte: cost }, rerolls: { lt: 8 } },
          data: {
            rerolls: { increment: 1 },
            treasury: { decrement: cost },
          },
        });
        if (updateResult.count === 0) {
          const fresh = await prisma.team.findUnique({
            where: { id: teamId },
            select: { rerolls: true, treasury: true },
          });
          if (fresh && fresh.rerolls >= 8) {
            sendError(res, 'Maximum 8 relances par equipe', 400);
          } else {
            sendError(
              res,
              `Tresorerie insuffisante. Cout: ${Math.round(cost / 1000)}k po`,
              400,
            );
          }
          return;
        }
        description = `Relance achetee (cout double: ${Math.round(cost / 1000)}k po)`;
        break;
      }

      case 'cheerleader': {
        cost = 10000;
        const updateResult = await prisma.team.updateMany({
          where: {
            id: teamId,
            treasury: { gte: cost },
            cheerleaders: { lt: 12 },
          },
          data: {
            cheerleaders: { increment: 1 },
            treasury: { decrement: cost },
          },
        });
        if (updateResult.count === 0) {
          const fresh = await prisma.team.findUnique({
            where: { id: teamId },
            select: { cheerleaders: true },
          });
          if (fresh && fresh.cheerleaders >= 12) {
            sendError(res, 'Maximum 12 cheerleaders', 400);
          } else {
            sendError(res, 'Tresorerie insuffisante. Cout: 10k po', 400);
          }
          return;
        }
        description = 'Cheerleader recrutee';
        break;
      }

      case 'assistant': {
        cost = 10000;
        const updateResult = await prisma.team.updateMany({
          where: {
            id: teamId,
            treasury: { gte: cost },
            assistants: { lt: 6 },
          },
          data: {
            assistants: { increment: 1 },
            treasury: { decrement: cost },
          },
        });
        if (updateResult.count === 0) {
          const fresh = await prisma.team.findUnique({
            where: { id: teamId },
            select: { assistants: true },
          });
          if (fresh && fresh.assistants >= 6) {
            sendError(res, 'Maximum 6 assistants', 400);
          } else {
            sendError(res, 'Tresorerie insuffisante. Cout: 10k po', 400);
          }
          return;
        }
        description = 'Assistant recrute';
        break;
      }

      case 'apothecary': {
        cost = 50000;
        const updateResult = await prisma.team.updateMany({
          where: {
            id: teamId,
            treasury: { gte: cost },
            apothecary: false,
          },
          data: {
            apothecary: true,
            treasury: { decrement: cost },
          },
        });
        if (updateResult.count === 0) {
          const fresh = await prisma.team.findUnique({
            where: { id: teamId },
            select: { apothecary: true },
          });
          if (fresh && fresh.apothecary) {
            sendError(res, "L'equipe a deja un apothicaire", 400);
          } else {
            sendError(res, 'Tresorerie insuffisante. Cout: 50k po', 400);
          }
          return;
        }
        description = 'Apothicaire recrute';
        break;
      }

      case 'dedicated_fan': {
        cost = 10000;
        const updateResult = await prisma.team.updateMany({
          where: {
            id: teamId,
            treasury: { gte: cost },
            dedicatedFans: { lt: 6 },
          },
          data: {
            dedicatedFans: { increment: 1 },
            treasury: { decrement: cost },
          },
        });
        if (updateResult.count === 0) {
          const fresh = await prisma.team.findUnique({
            where: { id: teamId },
            select: { dedicatedFans: true },
          });
          if (fresh && fresh.dedicatedFans >= 6) {
            sendError(res, 'Maximum 6 fans devoues', 400);
          } else {
            sendError(res, 'Tresorerie insuffisante. Cout: 10k po', 400);
          }
          return;
        }
        description = 'Fan devoue recrute';
        break;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateTeamValues(prisma as any, teamId);

    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true },
    });

    sendSuccess(res, {
      team: updatedTeam,
      purchase: { type, cost, description },
    });
  } catch (e: unknown) {
    serverLog.error("Erreur lors de l'achat:", e);
    sendError(res, 'Erreur serveur', 500);
  }
}
