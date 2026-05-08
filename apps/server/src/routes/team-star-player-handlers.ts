/**
 * S27.8.23 — Module dedie aux 4 handlers Star Players extraits
 * depuis `routes/team.ts`. Deuxieme slice du refactor monolith
 * team.ts (apres S27.8.22 readonly handlers).
 *
 * Endpoints couverts :
 *  - `GET /team/:id/star-players` — `handleListTeamStarPlayers` :
 *    liste des Star Players recrutes par l'equipe (enrichis avec les
 *    donnees catalogue via `getStarPlayerBySlug`).
 *  - `GET /team/:id/available-star-players` —
 *    `handleListAvailableStarPlayers` : liste des Star Players
 *    disponibles au recrutement (avec budget, slots, paires).
 *  - `POST /team/:id/star-players` — `handleHireStarPlayer` :
 *    recrute un Star Player (avec gestion paires, budget, limite 16
 *    joueurs, lock si match en cours).
 *  - `DELETE /team/:id/star-players/:starPlayerId` —
 *    `handleDeleteTeamStarPlayer` : retire un Star Player (et sa
 *    paire eventuelle).
 *
 * Les 4 handlers sont thematiquement coheressents (CRUD Star
 * Players) et n'ont aucune dependance vers les autres handlers de
 * `team.ts` (build, update, players, purchase). Helpers leaf
 * uniquement.
 *
 * Apres extraction, `team.ts` re-exporte ces handlers pour preserver
 * l'API publique consommee par `team.test.ts`.
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
  getTeamAvailableStarPlayers,
  requiresPair,
} from '../utils/star-player-validation';
import { serverLog } from '../utils/server-log';

/**
 * S25.5q / S27.8.23 — `GET /team/:id/star-players`
 *
 * Liste les Star Players recrutes par l'equipe. Enrichit chaque
 * entree avec les donnees du catalogue (`getStarPlayerBySlug`).
 * Defense : 404 si l'equipe n'existe pas ou n'appartient pas a
 * l'utilisateur courant.
 */
export async function handleListTeamStarPlayers(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { starPlayers: true },
    });

    if (!team) {
      sendError(res, 'Equipe introuvable', 404);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedStarPlayers = team.starPlayers.map((sp: any) => {
      const starPlayerData = getStarPlayerBySlug(sp.starPlayerSlug);
      return {
        id: sp.id,
        slug: sp.starPlayerSlug,
        cost: sp.cost,
        hiredAt: sp.hiredAt,
        ...starPlayerData,
      };
    });

    sendSuccess(res, {
      starPlayers: enrichedStarPlayers,
      count: enrichedStarPlayers.length,
    });
  } catch (e: unknown) {
    serverLog.error('Erreur lors de la recuperation des Star Players:', e);
    sendError(res, 'Erreur serveur', 500);
  }
}

/**
 * S25.5aa / S27.8.23 — `GET /team/:id/available-star-players`
 *
 * Liste les Star Players disponibles au recrutement pour cette
 * equipe. Calcule budget restant (initialBudget - players.cost -
 * starPlayers.cost), slots (max 16 joueurs), et flagge `canHire` /
 * `needsPair` pour chaque entree (gestion des paires Star Players).
 */
export async function handleListAvailableStarPlayers(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { players: true, starPlayers: true },
    });

    if (!team) {
      sendError(res, 'Equipe introuvable', 404);
      return;
    }

    const teamRuleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
    const availableStarPlayers = getTeamAvailableStarPlayers(
      team.roster,
      teamRuleset,
    );

    const { getPlayerCost } = await import(
      '../../../../packages/game-engine/src/utils/team-value-calculator'
    );
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

    const hiredSlugs = new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      team.starPlayers.map((sp: any) => sp.starPlayerSlug),
    );
    const totalPlayers = team.players.length + team.starPlayers.length;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedStarPlayers = availableStarPlayers.map((sp: any) => {
      const isHired = hiredSlugs.has(sp.slug);
      const canAfford = sp.cost <= availableBudget;
      const hasRoomForOne = totalPlayers < 16;

      const pairSlug = requiresPair(sp.slug);
      let needsPair = false;
      let pairStatus = null;

      if (pairSlug) {
        needsPair = true;
        const pairHired = hiredSlugs.has(pairSlug);
        const pairData = getStarPlayerBySlug(pairSlug, team.ruleset);
        pairStatus = {
          slug: pairSlug,
          name: pairData?.displayName,
          hired: pairHired,
          cost: pairData?.cost || 0,
        };
      }

      let canHire = !isHired && hasRoomForOne && canAfford;
      if (needsPair && !pairStatus?.hired) {
        const totalPairCost = sp.cost + (pairStatus?.cost || 0);
        const hasRoomForPair = totalPlayers + 1 < 16;
        canHire =
          !isHired && hasRoomForPair && totalPairCost <= availableBudget;
      }

      return {
        ...sp,
        isHired,
        canHire,
        needsPair,
        pairStatus,
      };
    });

    sendSuccess(res, {
      availableStarPlayers: enrichedStarPlayers,
      currentPlayerCount: team.players.length,
      currentStarPlayerCount: team.starPlayers.length,
      totalPlayers,
      maxPlayers: 16,
      availableBudget: Math.round(availableBudget / 1000),
      totalBudget: team.initialBudget,
    });
  } catch (e: unknown) {
    serverLog.error(
      'Erreur lors de la recuperation des Star Players disponibles:',
      e,
    );
    sendError(res, 'Erreur serveur', 500);
  }
}

// S27.8.31 — `handleHireStarPlayer` extrait dans
// `routes/team-star-player-hire-handler.ts` (ramener ce module sous
// DoD secondaire 400). Re-export pour preserver l'API publique
// (chaine `team.ts` -> `team-star-player-handlers.ts` -> handler).
export { handleHireStarPlayer } from './team-star-player-hire-handler';

/**
 * S25.5v / S27.8.23 — `DELETE /team/:id/star-players/:starPlayerId`
 *
 * Retire un Star Player. Si le Star Player a une paire (Lottabottol /
 * Bertha Bigfist par exemple), retire egalement le partenaire. Lock
 * si l'equipe est engagee dans un match `pending`/`active`.
 */
export async function handleDeleteTeamStarPlayer(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const starPlayerId = req.params.starPlayerId;

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

    const starPlayer = team.starPlayers.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sp: any) => sp.id === starPlayerId,
    );
    if (!starPlayer) {
      sendError(res, 'Star Player introuvable', 404);
      return;
    }

    const pairSlug = requiresPair(starPlayer.starPlayerSlug);
    const starPlayersToRemove: string[] = [starPlayerId];

    if (pairSlug) {
      const pairStarPlayer = team.starPlayers.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sp: any) => sp.starPlayerSlug === pairSlug,
      );
      if (pairStarPlayer) {
        starPlayersToRemove.push(pairStarPlayer.id);
      }
    }

    await prisma.teamStarPlayer.deleteMany({
      where: { id: { in: starPlayersToRemove } },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateTeamValues(prisma as any, teamId);

    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true, starPlayers: true },
    });

    const removedCount = starPlayersToRemove.length;
    sendSuccess(res, {
      team: updatedTeam,
      message:
        removedCount > 1
          ? `${removedCount} Star Players retires avec succes`
          : 'Star Player retire avec succes',
    });
  } catch (e: unknown) {
    serverLog.error('Erreur lors du retrait du Star Player:', e);
    sendError(res, 'Erreur serveur', 500);
  }
}
