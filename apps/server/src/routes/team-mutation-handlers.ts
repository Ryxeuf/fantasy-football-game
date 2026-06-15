/**
 * S27.8.25 — Module dedie aux 3 handlers de mutation team extraits
 * depuis `routes/team.ts`. Quatrieme slice du refactor monolith
 * team.ts.
 *
 * Endpoints couverts :
 *  - `PUT /:id/info` — `handlePutTeamInfo` : modifie inducements
 *    (rerolls, cheerleaders, assistants, apothecary, dedicatedFans).
 *    Lock match en cours.
 *  - `POST /:id/recalculate` — `handleRecalculateTeam` : recalcule
 *    `teamValue` / `currentValue` via `updateTeamValues`.
 *  - `PUT /:id` — `handleUpdateTeam` : renomme l'equipe + met a jour
 *    nom / numero des joueurs (transactional). Lock match en cours.
 *
 * Les 3 handlers sont thematiquement coheressents (mutation team-
 * level / metadata + roster cosmetique). Helpers leaf uniquement :
 * `prisma`, `Prisma.PrismaPromise`, `sendError`/`sendSuccess`,
 * `updateTeamValues`, `serverLog`. Aucun cycle vers `team.ts`.
 *
 * Apres extraction, `team.ts` re-exporte ces handlers pour preserver
 * l'API publique consommee par `team.test.ts`.
 */

import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/authUser';
import { sendError, sendSuccess } from '../utils/api-response';
import { updateTeamValues } from '../utils/team-values';
import { serverLog } from '../utils/server-log';

/**
 * S27.8.25 — `PUT /team/:id/info`
 *
 * Modifie les inducements/info de l'equipe. Lock match en cours.
 * Recalcule TV apres update.
 */
export async function handlePutTeamInfo(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const { rerolls, cheerleaders, assistants, apothecary, dedicatedFans }: {
    rerolls?: number;
    cheerleaders?: number;
    assistants?: number;
    apothecary?: boolean;
    dedicatedFans?: number;
  } = req.body;

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
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

    await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(rerolls !== undefined && { rerolls }),
        ...(cheerleaders !== undefined && { cheerleaders }),
        ...(assistants !== undefined && { assistants }),
        ...(apothecary !== undefined && { apothecary }),
        ...(dedicatedFans !== undefined && { dedicatedFans }),
      },
      include: { players: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateTeamValues(prisma as any, teamId);

    const finalTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true },
    });

    sendSuccess(res, { team: finalTeam });
  } catch (e: unknown) {
    serverLog.error(
      "Erreur lors de la modification des informations d'equipe:",
      e,
    );
    sendError(res, 'Erreur serveur', 500);
  }
}

/**
 * S25.5r / S27.8.25 — `POST /team/:id/recalculate`
 *
 * Force un recalcul complet de TV (Team Value) et CV (Current Value).
 * Utile apres mutations qui ne sont pas detectees par les hooks
 * automatiques (ex : changements de skills, etc).
 */
export async function handleRecalculateTeam(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
    });

    if (!team) {
      sendError(res, 'Equipe introuvable', 404);
      return;
    }

    const { teamValue, currentValue } = await updateTeamValues(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma as any,
      teamId,
    );

    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true },
    });

    sendSuccess(res, {
      team: updatedTeam,
      message: `Valeurs recalculees: VE=${teamValue.toLocaleString()} po, VEA=${currentValue.toLocaleString()} po`,
    });
  } catch (e: unknown) {
    serverLog.error("Erreur lors du recalcul des valeurs d'equipe:", e);
    sendError(res, 'Erreur serveur', 500);
  }
}

/**
 * S25.5y / S27.8.25 — `PUT /team/:id`
 *
 * Met a jour le nom de l'equipe + le nom et numero de chaque joueur
 * (transactional). Lock match en cours. Valide :
 * - players ids correspondent au roster (pas d'invalides, pas de
 *   manquants)
 * - numeros uniques entre 1 et 99 entiers
 * - tous les joueurs ont un nom non vide
 * - team name non vide et <= 100 chars (si fourni)
 */
export async function handleUpdateTeam(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const { players, name }: {
    players: Array<{ id: string; name: string; number: number }>;
    name?: string;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerIds = team.players.map((p: any) => p.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const providedPlayerIds = players.map((p: any) => p.id);

    const invalidPlayerIds = providedPlayerIds.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (id: any) => !playerIds.includes(id),
    );
    if (invalidPlayerIds.length > 0) {
      sendError(res, `Joueurs invalides: ${invalidPlayerIds.join(', ')}`, 400);
      return;
    }

    const missingPlayerIds = playerIds.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (id: any) => !providedPlayerIds.includes(id),
    );
    if (missingPlayerIds.length > 0) {
      sendError(res, `Joueurs manquants: ${missingPlayerIds.join(', ')}`, 400);
      return;
    }

    const numbers = players.map((p) => p.number);
    const uniqueNumbers = new Set(numbers);
    if (uniqueNumbers.size !== numbers.length) {
      sendError(res, 'Les numeros de joueurs doivent etre uniques', 400);
      return;
    }

    const invalidNumbers = numbers.filter(
      (n) => n < 1 || n > 99 || !Number.isInteger(n),
    );
    if (invalidNumbers.length > 0) {
      sendError(res, 'Les numeros doivent etre des entiers entre 1 et 99', 400);
      return;
    }

    const emptyNames = players.filter((p) => !p.name || p.name.trim() === '');
    if (emptyNames.length > 0) {
      sendError(res, 'Tous les joueurs doivent avoir un nom', 400);
      return;
    }

    if (name !== undefined) {
      if (!name || name.trim() === '') {
        sendError(res, "Le nom de l'equipe ne peut pas etre vide", 400);
        return;
      }
      if (name.trim().length > 100) {
        sendError(
          res,
          "Le nom de l'equipe ne peut pas depasser 100 caracteres",
          400,
        );
        return;
      }
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [];
    if (name !== undefined) {
      operations.push(
        prisma.team.update({
          where: { id: teamId },
          data: { name: name.trim() },
        }),
      );
    }
    for (const player of players) {
      operations.push(
        prisma.teamPlayer.update({
          where: { id: player.id },
          data: {
            name: player.name.trim(),
            number: player.number,
          },
        }),
      );
    }
    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    const updates = new Map(
      players.map((p) => [
        p.id,
        { name: p.name.trim(), number: p.number },
      ]),
    );
    const updatedTeam = {
      ...team,
      name: name !== undefined ? name.trim() : team.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      players: team.players.map((existing: any) => {
        const update = updates.get(existing.id);
        return update ? { ...existing, ...update } : existing;
      }),
    };

    sendSuccess(res, { team: updatedTeam });
  } catch (e: unknown) {
    serverLog.error("Erreur lors de la modification de l'equipe:", e);
    sendError(res, 'Erreur serveur', 500);
  }
}
