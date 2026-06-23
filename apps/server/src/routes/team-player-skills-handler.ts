/**
 * S27.8.30 — Module dedie au handler `handleUpdatePlayerSkills`
 * extrait depuis `routes/team-player-handlers.ts` (qui depassait le
 * DoD secondaire 400). Polish slice du refactor team.ts.
 *
 * Endpoint couvert :
 *  - `PUT /team/:id/players/:playerId/skills` —
 *    `handleUpdatePlayerSkills` : ajoute un avancement a un joueur.
 *    Types BB2025 : `primary`/`secondary` (competences choisies avec
 *    `skillSlug`), `random-primary` (tirage avec `skillCategory`) et
 *    `characteristic` (amelioration de caracteristique via `stat`).
 *    Valide lock match, max 6 avancements, joueur vivant, category
 *    access (competences), SPP suffisants. Decrement SPP, append
 *    advancement, recalcule TV.
 *
 * Helpers leaf uniquement : `prisma`, `sendError`/`sendSuccess`,
 * `updateTeamValues`, `getNextAdvancementPspCost`/
 * `getPositionCategoryAccess`/`SKILLS_BY_SLUG`/`SKILLS_DEFINITIONS`/
 * `AdvancementType`/`PlayerAdvancement` from `@bb/game-engine`,
 * `serverLog`. Aucun cycle.
 */

import type { Response } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/authUser';
import { sendError, sendSuccess } from '../utils/api-response';
import { updateTeamValues } from '../utils/team-values';
import {
  getNextAdvancementPspCost,
  getPositionCategoryAccess,
  applyCharacteristicImprovement,
  SKILLS_BY_SLUG,
  SKILLS_DEFINITIONS,
  type AdvancementType,
  type CharacteristicKind,
  type PlayerAdvancement,
} from '@bb/game-engine';
import { serverLog } from '../utils/server-log';

/**
 * S25.5ac / S27.8.30 — `PUT /team/:id/players/:playerId/skills`
 *
 * Ajoute une competence a un joueur (avancement). Voir doc du
 * module pour le flux complet.
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
    stat,
  }: {
    skillSlug?: string;
    advancementType: AdvancementType;
    skillCategory?: string;
    stat?: CharacteristicKind;
  } = req.body;

  try {
    // BB2025 : la « secondaire au hasard » n'existe plus ; seul
    // `random-primary` reste un tirage aleatoire.
    const isCharacteristic = advancementType === 'characteristic';
    const isRandom = advancementType === 'random-primary';

    if (!isCharacteristic && !isRandom && !clientSkillSlug) {
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
    if (isCharacteristic && !stat) {
      sendError(
        res,
        'stat est requis pour une amelioration de caracteristique',
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

    // Branche caracteristique (BB2025) : on ameliore une stat, pas une
    // competence. Pas de pool/category a valider.
    if (isCharacteristic) {
      const charStat = stat as CharacteristicKind;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = player as any;
      // PA "—" (null) n'est pas ameliorable via une amelioration de carac.
      if (charStat === 'pa' && p.pa === null) {
        sendError(res, "La passe (PA) de ce joueur n'est pas ameliorable", 400);
        return;
      }
      const sppCost = getNextAdvancementPspCost(
        advancements.length,
        'characteristic',
      );
      const playerSpp = p.spp || 0;
      if (playerSpp < sppCost) {
        sendError(
          res,
          `SPP insuffisants : ${playerSpp} disponibles, ${sppCost} requis pour une amelioration de caracteristique`,
          400,
        );
        return;
      }
      const improved = applyCharacteristicImprovement(
        { ma: p.ma, st: p.st, ag: p.ag, pa: p.pa, av: p.av },
        charStat,
      );
      const newAdvancement: PlayerAdvancement = {
        type: 'characteristic',
        stat: charStat,
        isRandom: false,
        at: Date.now(),
      };
      const newAdvancements = [...advancements, newAdvancement];

      await prisma.teamPlayer.update({
        where: { id: playerId },
        data: {
          ma: improved.ma,
          st: improved.st,
          ag: improved.ag,
          pa: improved.pa,
          av: improved.av,
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
