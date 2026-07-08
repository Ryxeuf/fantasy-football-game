/**
 * S27.8.24 — Module dedie aux 4 handlers Player CRUD extraits depuis
 * `routes/team.ts`. Troisieme slice du refactor monolith team.ts.
 *
 * Endpoints couverts :
 *  - `POST /:id/players` — `handleAddTeamPlayer` : ajoute un joueur
 *    au roster (validation budget, slots, position, numero unique).
 *  - `DELETE /:id/players/:playerId` — `handleDeleteTeamPlayer` :
 *    retire un joueur (lock match en cours, minimum 11 sauf si
 *    `dead`).
 *  - `PUT /:id/players/:playerId/skills` —
 *    `handleUpdatePlayerSkills` : ajoute une competence (avancement
 *    primary/secondary, choisi ou random, gate 6 max + SPP cost +
 *    category access).
 *  - `GET /:id/available-positions` — `handleListAvailablePositions` :
 *    liste les positions du roster avec compteur courant et flag
 *    `canAdd`.
 *
 * Les 4 handlers sont thematiquement coheressents (CRUD joueurs sur
 * le roster d'une equipe). Helpers leaf uniquement : `prisma`,
 * `sendError`/`sendSuccess`, `updateTeamValues`, `getRosterFromDb`,
 * `@bb/game-engine` types/helpers, `serverLog`, dynamic import
 * `getPlayerCost`. Aucun cycle vers `team.ts`.
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
  type AllowedRoster,
  DEFAULT_RULESET,
  type Ruleset,
} from '@bb/game-engine';
import { getRosterFromDb } from '../utils/roster-helpers';
import { serverLog } from '../utils/server-log';
import {
  isTeamRosterFrozen,
  TEAM_ENGAGED_MESSAGE,
} from '../services/team-lock-status';

/**
 * S25.5z / S27.8.24 — `POST /team/:id/players`
 *
 * Ajoute un joueur a une equipe. Valide :
 * - lock match en cours (status pending/active)
 * - max 16 joueurs
 * - numero entre 1 et 99, unique dans l'equipe
 * - nom non vide
 * - position existe dans le roster
 * - max par position respecte
 * - budget total non depasse (currentTotalCost + nouveau cout)
 * Cree le `teamPlayer`, recalcule les valeurs equipe.
 */
export async function handleAddTeamPlayer(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const { position, name, number } = req.body;

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

    // Anti-triche : une equipe engagee (ligue / coupe / match joue) est
    // verrouillee. La progression legitime passe par des flux dedies
    // (tresorerie, montee de niveau), pas par cet ajout a budget initial.
    if (await isTeamRosterFrozen(teamId)) {
      sendError(res, TEAM_ENGAGED_MESSAGE, 403);
      return;
    }

    if (team.players.length >= 16) {
      sendError(res, 'Une equipe ne peut pas avoir plus de 16 joueurs', 400);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingPlayer = team.players.find((p: any) => p.number === number);
    if (existingPlayer) {
      sendError(
        res,
        `Le numero ${number} est deja utilise par ${existingPlayer.name}`,
        400,
      );
      return;
    }

    if (number < 1 || number > 99 || !Number.isInteger(number)) {
      sendError(res, 'Le numero doit etre un entier entre 1 et 99', 400);
      return;
    }

    if (!name.trim()) {
      sendError(res, 'Le nom ne peut pas etre vide', 400);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => p.position === position,
    ).length;
    if (currentPositionCount >= positionData.max) {
      sendError(
        res,
        `Limite maximale atteinte pour la position ${positionData.displayName} (${positionData.max})`,
        400,
      );
      return;
    }

    const { getPlayerCost } = await import(
      '../../../../packages/game-engine/src/utils/team-value-calculator'
    );
    const teamRuleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
    const currentTotalCost = team.players.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (total: number, player: any) => {
        return total + getPlayerCost(player.position, team.roster, teamRuleset);
      },
      0,
    );

    const newPlayerCost = positionData.cost * 1000;
    const newTotalCost = currentTotalCost + newPlayerCost;
    const budgetInPo = team.initialBudget * 1000;
    if (newTotalCost > budgetInPo) {
      sendError(
        res,
        `Budget depasse ! Cout actuel: ${Math.round(currentTotalCost / 1000)}k po, nouveau cout: ${Math.round(newTotalCost / 1000)}k po, budget: ${team.initialBudget}k po`,
        400,
      );
      return;
    }

    const newPlayer = await prisma.teamPlayer.create({
      data: {
        teamId: teamId,
        name: name.trim(),
        position: position,
        number: number,
        ma: positionData.ma,
        st: positionData.st,
        ag: positionData.ag,
        pa: positionData.pa,
        av: positionData.av,
        skills: positionData.skills,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateTeamValues(prisma as any, teamId);

    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true },
    });

    sendSuccess(
      res,
      {
        team: updatedTeam,
        newPlayer: newPlayer,
      },
      201,
    );
  } catch (e: unknown) {
    serverLog.error("Erreur lors de l'ajout du joueur:", e);
    sendError(res, 'Erreur serveur', 500);
  }
}

/**
 * S25.5t / S27.8.24 — `DELETE /team/:id/players/:playerId`
 *
 * Retire un joueur de l'equipe. Lock si match en cours. Garde le
 * minimum BB de 11 joueurs sauf si le joueur est `dead` (L2.B.6
 * funeral exception).
 */
export async function handleDeleteTeamPlayer(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const playerId = req.params.playerId;

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

    // Anti-triche : une equipe engagee (ligue / coupe / match joue) est
    // verrouillee, on ne retire pas un joueur de sa composition. Tant qu'elle
    // est en brouillon, le coach peut au contraire descendre librement sous 11
    // (le plancher BB n'est verifie qu'a la sauvegarde du roster).
    if (await isTeamRosterFrozen(teamId)) {
      sendError(res, TEAM_ENGAGED_MESSAGE, 403);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const player = team.players.find((p: any) => p.id === playerId);
    if (!player) {
      sendError(res, 'Joueur introuvable', 404);
      return;
    }

    await prisma.teamPlayer.delete({ where: { id: playerId } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateTeamValues(prisma as any, teamId);

    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true },
    });

    sendSuccess(res, { team: updatedTeam });
  } catch (e: unknown) {
    serverLog.error('Erreur lors de la suppression du joueur:', e);
    sendError(res, 'Erreur serveur', 500);
  }
}

// S27.8.30 — `handleUpdatePlayerSkills` extrait dans
// `routes/team-player-skills-handler.ts` (pour ramener ce module
// sous le DoD secondaire 400 lignes). Re-export pour preserver
// l'API publique consommee par `team.test.ts` (via re-export depuis
// `team.ts`).
export { handleUpdatePlayerSkills } from './team-player-skills-handler';

/**
 * S25.5s / S27.8.24 — `GET /team/:id/available-positions`
 *
 * Liste les positions disponibles a l'ajout pour cette equipe.
 * Retourne pour chaque position du roster : `currentCount`,
 * `maxCount`, `canAdd` (slot dispo + sous le cap 16 joueurs total).
 */
export async function handleListAvailablePositions(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { players: true },
    });

    if (!team) {
      sendError(res, 'Equipe introuvable', 404);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const availablePositions = rosterData.positions.map((position: any) => {
      const currentCount = team.players.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => p.position === position.slug,
      ).length;
      const canAdd = currentCount < position.max && team.players.length < 16;

      return {
        key: position.slug,
        name: position.displayName,
        cost: position.cost,
        currentCount,
        maxCount: position.max,
        canAdd,
        stats: {
          ma: position.ma,
          st: position.st,
          ag: position.ag,
          pa: position.pa,
          av: position.av,
          skills: position.skills,
        },
      };
    });

    // `frozen` indique a l'UI si le plancher de 11 joueurs s'applique
    // (equipe engagee) ou si le roster est encore en brouillon librement
    // editable. L'UI conditionne le bouton "retirer" la-dessus.
    const frozen = await isTeamRosterFrozen(teamId);

    sendSuccess(res, {
      availablePositions,
      currentPlayerCount: team.players.length,
      maxPlayers: 16,
      frozen,
    });
  } catch (e: unknown) {
    serverLog.error(
      'Erreur lors de la recuperation des positions disponibles:',
      e,
    );
    sendError(res, 'Erreur serveur', 500);
  }
}

/**
 * E12 — PATCH /team/:id/players/:playerId/identity
 *
 * Edition cosmetique (nom + numero) par le COACH proprietaire, autorisee
 * meme quand l'equipe est engagee : renommer/renumeroter un joueur n'a
 * aucun impact anti-triche (composition/budget inchanges), donc PAS de
 * garde `isTeamRosterFrozen` ici — contrairement au PUT /roster.
 */
export async function handleUpdatePlayerIdentity(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const playerId = req.params.playerId;
  const body = req.body as { name?: string; number?: number };

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      select: { id: true },
    });
    if (!team) {
      sendError(res, 'Equipe introuvable', 404);
      return;
    }

    const player = await prisma.teamPlayer.findFirst({
      where: { id: playerId, teamId, firedAt: null },
      select: { id: true, number: true },
    });
    if (!player) {
      sendError(res, 'Joueur introuvable', 404);
      return;
    }

    const name = body.name?.trim();
    const number = body.number;
    if (number !== undefined && number !== player.number) {
      const taken = await prisma.teamPlayer.count({
        where: {
          teamId,
          number,
          firedAt: null,
          id: { not: playerId },
        },
      });
      if (taken > 0) {
        sendError(res, `Le numero ${number} est deja pris dans cette equipe`, 409);
        return;
      }
    }

    const updated = await prisma.teamPlayer.update({
      where: { id: playerId },
      data: {
        ...(name !== undefined && name.length > 0 ? { name } : {}),
        ...(number !== undefined ? { number } : {}),
      },
      select: { id: true, name: true, number: true },
    });
    sendSuccess(res, { player: updated });
  } catch (e: unknown) {
    serverLog.error("Erreur lors de la mise a jour de l'identite du joueur:", e);
    sendError(res, 'Erreur serveur', 500);
  }
}
