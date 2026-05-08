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
  const { type, position, name, number } = req.body as {
    type: PurchaseType;
    position?: string;
    name?: string;
    number?: number;
  };

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
          prisma.team.update({
            where: { id: teamId },
            data: { treasury: team.treasury - cost },
          }),
        ]);

        description = `Joueur ${name.trim()} (${positionData.displayName}) recrute`;
        break;
      }

      case 'reroll': {
        if (team.rerolls >= 8) {
          sendError(res, 'Maximum 8 relances par equipe', 400);
          return;
        }
        cost = getRerollCost(team.roster) * 2;

        if (team.treasury < cost) {
          sendError(
            res,
            `Tresorerie insuffisante. Cout: ${Math.round(cost / 1000)}k po, Tresorerie: ${Math.round(team.treasury / 1000)}k po`,
            400,
          );
          return;
        }

        await prisma.team.update({
          where: { id: teamId },
          data: {
            rerolls: team.rerolls + 1,
            treasury: team.treasury - cost,
          },
        });
        description = `Relance achetee (cout double: ${Math.round(cost / 1000)}k po)`;
        break;
      }

      case 'cheerleader': {
        if (team.cheerleaders >= 12) {
          sendError(res, 'Maximum 12 cheerleaders', 400);
          return;
        }
        cost = 10000;

        if (team.treasury < cost) {
          sendError(
            res,
            `Tresorerie insuffisante. Cout: 10k po, Tresorerie: ${Math.round(team.treasury / 1000)}k po`,
            400,
          );
          return;
        }

        await prisma.team.update({
          where: { id: teamId },
          data: {
            cheerleaders: team.cheerleaders + 1,
            treasury: team.treasury - cost,
          },
        });
        description = 'Cheerleader recrutee';
        break;
      }

      case 'assistant': {
        if (team.assistants >= 6) {
          sendError(res, 'Maximum 6 assistants', 400);
          return;
        }
        cost = 10000;

        if (team.treasury < cost) {
          sendError(
            res,
            `Tresorerie insuffisante. Cout: 10k po, Tresorerie: ${Math.round(team.treasury / 1000)}k po`,
            400,
          );
          return;
        }

        await prisma.team.update({
          where: { id: teamId },
          data: {
            assistants: team.assistants + 1,
            treasury: team.treasury - cost,
          },
        });
        description = 'Assistant recrute';
        break;
      }

      case 'apothecary': {
        if (team.apothecary) {
          sendError(res, "L'equipe a deja un apothicaire", 400);
          return;
        }
        cost = 50000;

        if (team.treasury < cost) {
          sendError(
            res,
            `Tresorerie insuffisante. Cout: 50k po, Tresorerie: ${Math.round(team.treasury / 1000)}k po`,
            400,
          );
          return;
        }

        await prisma.team.update({
          where: { id: teamId },
          data: {
            apothecary: true,
            treasury: team.treasury - cost,
          },
        });
        description = 'Apothicaire recrute';
        break;
      }

      case 'dedicated_fan': {
        if (team.dedicatedFans >= 6) {
          sendError(res, 'Maximum 6 fans devoues', 400);
          return;
        }
        cost = 10000;

        if (team.treasury < cost) {
          sendError(
            res,
            `Tresorerie insuffisante. Cout: 10k po, Tresorerie: ${Math.round(team.treasury / 1000)}k po`,
            400,
          );
          return;
        }

        await prisma.team.update({
          where: { id: teamId },
          data: {
            dedicatedFans: team.dedicatedFans + 1,
            treasury: team.treasury - cost,
          },
        });
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
