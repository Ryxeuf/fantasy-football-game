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
 *    access (competences), PSP suffisants. Append advancement,
 *    recalcule TV.
 *
 *    FINANCEMENT — tant que l'equipe est LIBRE (roster non fige), un
 *    avancement se paie EN PRIORITE sur le pool de PSP de construction
 *    de l'equipe (`Team.startingPspPool`), et seulement a defaut sur
 *    les SPP du joueur (nuls tant qu'il n'a pas joue). Le barème est
 *    alors celui du reglement de tournoi retenu a la creation, et ses
 *    restrictions s'appliquent. Une fois l'equipe engagee, on retombe
 *    sur le flux historique : SPP du joueur, barème standard.
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
  captureTeamState,
  safeRecordTeamAudit,
  type TeamAuditPrismaLike,
} from '../services/team-audit';
import {
  getPositionCategoryAccess,
  applyCharacteristicImprovement,
  characteristicOptionsForRoll,
  canImproveCharacteristic,
  SKILLS_BY_SLUG,
  SKILLS_DEFINITIONS,
  type AdvancementType,
  type CharacteristicKind,
  type PlayerAdvancement,
} from '@bb/game-engine';
import { serverLog } from '../utils/server-log';
import { isTeamRosterFrozen } from '../services/team-lock-status';
import {
  advancementCostFor,
  assertTournamentAllowsAdvancement,
  packForTeam,
  poolSpentForTeamId,
  TeamAdvancementError,
} from '../services/team-advancement-editing';

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
    d8,
  }: {
    skillSlug?: string;
    advancementType: AdvancementType;
    skillCategory?: string;
    stat?: CharacteristicKind;
    d8?: number;
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
    if (isCharacteristic && (typeof d8 !== 'number' || d8 < 1 || d8 > 8)) {
      sendError(
        res,
        'd8 (1-8) est requis pour une amelioration de caracteristique',
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

    // Financement : pool de construction d'abord, SPP du joueur ensuite.
    // Le pool n'est mobilisable que tant que l'equipe est libre — une fois
    // engagee, les avancements se gagnent en match et se paient en SPP.
    const teamRow = team as unknown as {
      startingPspPool?: number;
      tournamentRuleset?: string | null;
    };
    const frozen = await isTeamRosterFrozen(teamId);
    const pack = frozen
      ? null
      : await packForTeam(teamRow.tournamentRuleset ?? null);
    const poolTotal = frozen ? 0 : (teamRow.startingPspPool ?? 0);
    const poolLeft = poolTotal
      ? Math.max(0, poolTotal - (await poolSpentForTeamId(teamId)))
      : 0;

    // Branche caracteristique (BB2025) : on ameliore une stat, pas une
    // competence. Pas de pool/category a valider.
    if (isCharacteristic) {
      const charStat = stat as CharacteristicKind;
      const roll = d8 as number;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = player as any;
      const stats = { ma: p.ma, st: p.st, ag: p.ag, pa: p.pa, av: p.av };

      // Le jet D8 (BB2025) restreint les caracteristiques ameliorables.
      if (!characteristicOptionsForRoll(roll).includes(charStat)) {
        sendError(
          res,
          `La caracteristique '${charStat}' n'est pas ameliorable avec un jet D8 de ${roll}`,
          400,
        );
        return;
      }
      // Plafonds BB2025 (p.37) : max 2 ameliorations par carac + bornes
      // min/max (PA "—" exclue).
      const priorCount = advancements.filter(
        (a) => a.type === 'characteristic' && a.stat === charStat,
      ).length;
      if (!canImproveCharacteristic(stats, charStat, priorCount)) {
        sendError(
          res,
          `La caracteristique '${charStat}' ne peut plus etre amelioree (limite BB2025 atteinte)`,
          400,
        );
        return;
      }

      const sppCost = advancementCostFor(
        pack,
        advancements.length,
        'characteristic',
      );
      const playerSpp = p.spp || 0;
      const fromPool = poolLeft >= sppCost;
      if (!fromPool && playerSpp < sppCost) {
        sendError(
          res,
          `PSP insuffisants : ${playerSpp} SPP joueur + ${poolLeft} au pool, ${sppCost} requis pour une amelioration de caracteristique`,
          400,
        );
        return;
      }
      try {
        await assertTournamentAllowsAdvancement({
          teamId,
          roster: team.roster,
          playerId,
          pack: fromPool ? pack : null,
          type: 'characteristic',
        });
      } catch (e) {
        if (e instanceof TeamAdvancementError) {
          sendError(res, e.message, 400);
          return;
        }
        throw e;
      }
      const improved = applyCharacteristicImprovement(stats, charStat);
      const newAdvancement: PlayerAdvancement = {
        type: 'characteristic',
        stat: charStat,
        d8: roll,
        isRandom: false,
        at: Date.now(),
        pspCost: sppCost,
        fundedBy: fromPool ? 'pool' : 'player',
      };
      const newAdvancements = [...advancements, newAdvancement];

      const charAuditDb = prisma as unknown as TeamAuditPrismaLike;
      const charAuditBefore = await captureTeamState(charAuditDb, teamId);

      await prisma.teamPlayer.update({
        where: { id: playerId },
        data: {
          ma: improved.ma,
          st: improved.st,
          ag: improved.ag,
          pa: improved.pa,
          av: improved.av,
          advancements: JSON.stringify(newAdvancements),
          ...(fromPool ? {} : { spp: { decrement: sppCost } }),
        },
      });

      // Une amélioration change la VE du joueur (surcoût d'avancement) :
      // journalisée pour que le saut de VE qui suit soit explicable.
      await safeRecordTeamAudit(charAuditDb, {
        teamId,
        action: 'team.player.advancement.add',
        entity: 'TeamPlayer',
        entityId: playerId,
        before: charAuditBefore,
        details: { advancement: newAdvancement, sppCost, fromPool },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateTeamValues(prisma as any, teamId);

      const updatedPlayer = await prisma.teamPlayer.findUnique({
        where: { id: playerId },
      });

      sendSuccess(res, {
        player: updatedPlayer,
        sppSpent: sppCost,
        fundedBy: newAdvancement.fundedBy,
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

    // Competences reservees (ex: mighty-blow-2, variantes star player) :
    // non selectionnables en nouveaute, meme si la categorie/position les
    // autoriserait. Un seul aller-retour DB, reutilise par les 2 branches.
    const excludedSkillRows: Array<{ slug: string }> = await prisma.skill.findMany({
      where: { ruleset: team.ruleset as never, excludedFromSelection: true },
      select: { slug: true },
    });
    const excludedSlugs = new Set(excludedSkillRows.map((s) => s.slug));

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
      )
        .filter((s) => !currentSkills.includes(s.slug))
        .filter((s) => !excludedSlugs.has(s.slug));

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

      if (excludedSlugs.has(finalSkillSlug)) {
        sendError(
          res,
          `La competence '${skillDef.nameFr}' n'est pas disponible a la selection`,
          400,
        );
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

    const sppCost = advancementCostFor(
      pack,
      advancements.length,
      advancementType,
      finalSkillSlug,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerSpp = (player as any).spp || 0;
    const fromPool = poolLeft >= sppCost;

    if (!fromPool && playerSpp < sppCost) {
      sendError(
        res,
        `PSP insuffisants : ${playerSpp} SPP joueur + ${poolLeft} au pool, ${sppCost} requis pour un avancement ${advancementType}`,
        400,
      );
      return;
    }

    // Le reglement de tournoi ne borne QUE les achats sur le pool : une
    // amelioration gagnee en match suit les regles BB standard.
    try {
      await assertTournamentAllowsAdvancement({
        teamId,
        roster: team.roster,
        playerId,
        pack: fromPool ? pack : null,
        type: advancementType,
      });
    } catch (e) {
      if (e instanceof TeamAdvancementError) {
        sendError(res, e.message, 400);
        return;
      }
      throw e;
    }

    const newSkills = [...currentSkills, finalSkillSlug].join(',');
    const newAdvancement: PlayerAdvancement = {
      skillSlug: finalSkillSlug,
      type: advancementType,
      isRandom,
      at: Date.now(),
      pspCost: sppCost,
      fundedBy: fromPool ? 'pool' : 'player',
    };
    const newAdvancements = [...advancements, newAdvancement];

    const auditDb = prisma as unknown as TeamAuditPrismaLike;
    const auditBefore = await captureTeamState(auditDb, teamId);

    await prisma.teamPlayer.update({
      where: { id: playerId },
      data: {
        skills: newSkills,
        advancements: JSON.stringify(newAdvancements),
        ...(fromPool ? {} : { spp: { decrement: sppCost } }),
      },
    });

    await safeRecordTeamAudit(auditDb, {
      teamId,
      action: 'team.player.advancement.add',
      entity: 'TeamPlayer',
      entityId: playerId,
      before: auditBefore,
      details: { advancement: newAdvancement, sppCost, fromPool, newSkills },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateTeamValues(prisma as any, teamId);

    const updatedPlayer = await prisma.teamPlayer.findUnique({
      where: { id: playerId },
    });

    sendSuccess(res, {
      player: updatedPlayer,
      sppSpent: sppCost,
      fundedBy: newAdvancement.fundedBy,
      advancement: newAdvancement,
    });
  } catch (e: unknown) {
    serverLog.error("Erreur lors de l'ajout de competence:", e);
    sendError(res, 'Erreur serveur', 500);
  }
}
