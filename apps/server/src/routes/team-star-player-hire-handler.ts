/**
 * S27.8.31 — Module dedie au handler `handleHireStarPlayer` extrait
 * depuis `routes/team-star-player-handlers.ts` (qui depassait le DoD
 * secondaire 400 a 488 lignes). Polish slice.
 *
 * Endpoint couvert :
 *  - `POST /team/:id/star-players` — `handleHireStarPlayer` :
 *    recrute un Star Player. Gere les paires (recrute le partenaire
 *    automatiquement s'il n'est pas deja recrute), verifie le
 *    budget et la limite de 16 joueurs. Lock si l'equipe est
 *    engagee dans un match `pending`/`active`. Catch P2002 (deja
 *    recrute) -> 409.
 *
 * Helpers leaf uniquement : `prisma`, `sendError`/`sendSuccess`,
 * `updateTeamValues`, `getStarPlayerBySlug`/`DEFAULT_RULESET`/
 * `Ruleset` from `@bb/game-engine`, `validateStarPlayerHire`/
 * `requiresPair` from `../utils/star-player-validation`,
 * `serverLog`, dynamic import `getPlayerCost`.
 */

import type { Response } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/authUser';
import { sendError, sendSuccess } from '../utils/api-response';
import { updateTeamValues } from '../utils/team-values';
import {
  getStarPlayerBySlug,
  DEFAULT_RULESET,
  type Ruleset,
} from '@bb/game-engine';
import {
  validateStarPlayerHire,
  requiresPair,
} from '../utils/star-player-validation';
import { serverLog } from '../utils/server-log';

/**
 * S25.5ab / S27.8.31 — `POST /team/:id/star-players`
 *
 * Recrute un Star Player. Voir doc du module pour le flux complet.
 */
export async function handleHireStarPlayer(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const { starPlayerSlug } = req.body;

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { players: true, starPlayers: true },
    });

    if (!team) {
      sendError(res, 'Equipe introuvable', 404);
      return;
    }

    const activeSelection = await prisma.teamSelection.findFirst({
      where: {
        teamId: teamId,
        match: { status: { in: ['pending', 'active'] } },
      },
    });

    if (activeSelection) {
      sendError(
        res,
        'Impossible de modifier cette equipe car elle est engagee dans un match en cours',
        400,
      );
      return;
    }

    const { getPlayerCost } = await import(
      '../../../../packages/game-engine/src/utils/team-value-calculator'
    );
    const teamRuleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
    const currentPlayersCost = team.players.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (total: number, player: any) => {
        return total + getPlayerCost(player.position, team.roster, teamRuleset);
      },
      0,
    );

    const currentStarPlayersCost = team.starPlayers.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (total: number, sp: any) => {
        return total + sp.cost;
      },
      0,
    );

    const budgetInPo = team.initialBudget * 1000;
    const availableBudget =
      budgetInPo - currentPlayersCost - currentStarPlayersCost;

    const validation = validateStarPlayerHire(
      starPlayerSlug,
      team.roster,
      team.players.length,
      team.starPlayers,
      availableBudget,
      teamRuleset,
    );

    if (!validation.valid) {
      sendError(res, validation.error ?? 'Validation echouee', 400);
      return;
    }

    const starPlayer = validation.starPlayer!;

    const pairSlug = requiresPair(starPlayerSlug);
    const starPlayersToHire: Array<{ slug: string; cost: number }> = [
      { slug: starPlayerSlug, cost: starPlayer.cost },
    ];

    if (pairSlug) {
      const pairAlreadyHired = team.starPlayers.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sp: any) => sp.starPlayerSlug === pairSlug,
      );

      if (!pairAlreadyHired) {
        const pairData = getStarPlayerBySlug(pairSlug, team.ruleset);
        if (!pairData) {
          sendError(
            res,
            `Star Player partenaire '${pairSlug}' introuvable`,
            400,
          );
          return;
        }

        const totalPlayers = team.players.length + team.starPlayers.length;
        if (totalPlayers + 1 >= 16) {
          sendError(
            res,
            'Pas assez de place pour recruter la paire (limite de 16 joueurs)',
            400,
          );
          return;
        }

        const totalCost = starPlayer.cost + pairData.cost;
        if (totalCost > availableBudget) {
          sendError(
            res,
            `Budget insuffisant pour recruter la paire. Cout: ${(totalCost / 1000).toLocaleString()} K po, disponible: ${(availableBudget / 1000).toLocaleString()} K po`,
            400,
          );
          return;
        }

        starPlayersToHire.push({ slug: pairSlug, cost: pairData.cost });
      }
    }

    const createdStarPlayers = await Promise.all(
      starPlayersToHire.map((sp) =>
        prisma.teamStarPlayer.create({
          data: {
            teamId: teamId,
            starPlayerSlug: sp.slug,
            cost: sp.cost,
          },
        }),
      ),
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateTeamValues(prisma as any, teamId);

    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true, starPlayers: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedNewStarPlayers = createdStarPlayers.map((sp: any) => {
      const starPlayerData = getStarPlayerBySlug(
        sp.starPlayerSlug,
        team.ruleset,
      );
      return {
        id: sp.id,
        slug: sp.starPlayerSlug,
        cost: sp.cost,
        hiredAt: sp.hiredAt,
        ...starPlayerData,
      };
    });

    sendSuccess(
      res,
      {
        team: updatedTeam,
        newStarPlayers: enrichedNewStarPlayers,
        message:
          enrichedNewStarPlayers.length > 1
            ? `${enrichedNewStarPlayers
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((sp: any) => sp.displayName)
                .join(' et ')} recrutes avec succes`
            : `${enrichedNewStarPlayers[0]?.displayName ?? starPlayerSlug} recrute avec succes`,
      },
      201,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    serverLog.error('Erreur lors du recrutement du Star Player:', e);

    if (e?.code === 'P2002') {
      sendError(res, 'Ce Star Player est deja recrute dans cette equipe', 409);
      return;
    }

    sendError(res, 'Erreur serveur', 500);
  }
}
