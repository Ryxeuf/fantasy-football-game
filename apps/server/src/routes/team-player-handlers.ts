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
  getNextAdvancementPspCost,
  getPositionCategoryAccess,
  SKILLS_BY_SLUG,
  SKILLS_DEFINITIONS,
  type AdvancementType,
  type PlayerAdvancement,
} from '@bb/game-engine';
import { getRosterFromDb } from '../utils/roster-helpers';
import { serverLog } from '../utils/server-log';

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const player = team.players.find((p: any) => p.id === playerId);
    if (!player) {
      sendError(res, 'Joueur introuvable', 404);
      return;
    }

    // L2.B.6 — Funeral : un joueur mort peut etre retire meme si
    // l'equipe est sous le seuil de 11 (sa mort en est la cause).
    // Pour un joueur vivant on garde la regle BB : minimum 11 joueurs
    // a la liste, les remplacants sont des journeymen au match-start.
    if (!(player as { dead?: boolean }).dead && team.players.length <= 11) {
      sendError(res, 'Une equipe doit avoir au minimum 11 joueurs', 400);
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

/**
 * S25.5ac / S27.8.24 — `PUT /team/:id/players/:playerId/skills`
 *
 * Ajoute une competence a un joueur (avancement). Supporte 4 types :
 * `primary` / `secondary` (choisis avec `skillSlug`) et
 * `random-primary` / `random-secondary` (tirage avec `skillCategory`).
 * Valide : lock match, max 6 avancements, joueur vivant, category
 * access pour la position, SPP suffisants. Decrement SPP, append
 * advancement, recalcule TV.
 */
export async function handleUpdatePlayerSkills(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const playerId = req.params.playerId;
  const {
    skillSlug: clientSkillSlug,
    advancementType,
    skillCategory,
  } = req.body as {
    skillSlug?: string;
    advancementType: AdvancementType;
    skillCategory?: string;
  };

  try {
    const isRandom =
      advancementType === 'random-primary' ||
      advancementType === 'random-secondary';

    if (!isRandom && !clientSkillSlug) {
      sendError(res, 'skillSlug est requis pour un avancement choisi', 400);
      return;
    }
    if (isRandom && !skillCategory) {
      sendError(
        res,
        'skillCategory est requis pour un avancement aleatoire',
        400,
      );
      return;
    }

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
      sendError(
        res,
        'Impossible de modifier cette equipe car elle est engagee dans un match en cours',
        400,
      );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const player = team.players.find((p: any) => p.id === playerId);
    if (!player) {
      sendError(res, 'Joueur introuvable', 404);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((player as any).dead) {
      sendError(
        res,
        "Ce joueur est mort et ne peut pas recevoir d'avancement",
        400,
      );
      return;
    }

    let advancements: PlayerAdvancement[] = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      advancements = JSON.parse((player as any).advancements || '[]');
    } catch {
      advancements = [];
    }

    if (advancements.length >= 6) {
      sendError(res, 'Ce joueur a atteint le maximum de 6 avancements', 400);
      return;
    }

    const currentSkills = player.skills.split(',').filter(Boolean);

    const categoryAccessType =
      advancementType === 'primary' || advancementType === 'random-primary'
        ? 'primary'
        : 'secondary';
    const access = getPositionCategoryAccess(player.position);
    const allowedCategories =
      categoryAccessType === 'primary' ? access.primary : access.secondary;

    let finalSkillSlug: string;

    if (isRandom) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!allowedCategories.includes(skillCategory as any)) {
        sendError(
          res,
          `La categorie '${skillCategory}' n'est pas accessible en ${categoryAccessType} pour cette position`,
          400,
        );
        return;
      }

      const eligibleSkills = SKILLS_DEFINITIONS.filter(
        (s) => s.category === skillCategory,
      ).filter((s) => !currentSkills.includes(s.slug));

      if (eligibleSkills.length === 0) {
        sendError(
          res,
          'Aucune competence disponible dans cette categorie',
          400,
        );
        return;
      }

      const randomIndex = Math.floor(Math.random() * eligibleSkills.length);
      finalSkillSlug = eligibleSkills[randomIndex].slug;
    } else {
      finalSkillSlug = clientSkillSlug!;
      const skillDef = SKILLS_BY_SLUG[finalSkillSlug];
      if (!skillDef) {
        sendError(res, `Competence '${finalSkillSlug}' inconnue`, 400);
        return;
      }

      if (currentSkills.includes(finalSkillSlug)) {
        sendError(res, 'Ce joueur possede deja cette competence', 400);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!allowedCategories.includes(skillDef.category as any)) {
        sendError(
          res,
          `La competence '${skillDef.nameFr}' (${skillDef.category}) n'est pas accessible en ${categoryAccessType} pour cette position`,
          400,
        );
        return;
      }
    }

    const sppCost = getNextAdvancementPspCost(
      advancements.length,
      advancementType,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerSpp = (player as any).spp || 0;

    if (playerSpp < sppCost) {
      sendError(
        res,
        `SPP insuffisants : ${playerSpp} disponibles, ${sppCost} requis pour un avancement ${advancementType}`,
        400,
      );
      return;
    }

    const newSkills = [...currentSkills, finalSkillSlug].join(',');
    const newAdvancement: PlayerAdvancement = {
      skillSlug: finalSkillSlug,
      type: advancementType,
      isRandom,
      at: Date.now(),
    };
    const newAdvancements = [...advancements, newAdvancement];

    await prisma.teamPlayer.update({
      where: { id: playerId },
      data: {
        skills: newSkills,
        advancements: JSON.stringify(newAdvancements),
        spp: { decrement: sppCost },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateTeamValues(prisma as any, teamId);

    const updatedPlayer = await prisma.teamPlayer.findUnique({
      where: { id: playerId },
    });

    sendSuccess(res, {
      player: updatedPlayer,
      sppSpent: sppCost,
      advancement: newAdvancement,
    });
  } catch (e: unknown) {
    serverLog.error("Erreur lors de l'ajout de competence:", e);
    sendError(res, 'Erreur serveur', 500);
  }
}

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

    sendSuccess(res, {
      availablePositions,
      currentPlayerCount: team.players.length,
      maxPlayers: 16,
    });
  } catch (e: unknown) {
    serverLog.error(
      'Erreur lors de la recuperation des positions disponibles:',
      e,
    );
    sendError(res, 'Erreur serveur', 500);
  }
}
