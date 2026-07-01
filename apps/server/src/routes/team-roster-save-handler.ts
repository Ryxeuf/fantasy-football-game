/**
 * `PUT /team/:id/roster` — sauvegarde batch du roster d'une equipe NON
 * engagee (page d'edition, mode "brouillon libre").
 *
 * Contexte : tant qu'une equipe n'est pas engagee dans une competition
 * (match / ligue / coupe), le coach l'edite librement comme a la creation
 * (ajouter/retirer des joueurs, descendre transitoirement sous 11...). La
 * validation "comme au builder" (bornes de format, min/max par poste, budget)
 * ne s'applique qu'ICI, au moment de la sauvegarde. Une equipe engagee est
 * verrouillee (403) : sa composition/budget ne peut plus changer (anti-triche).
 *
 * Le body decrit l'etat CIBLE complet du roster :
 *   { name?, players: [{ id?, position, name, number }] }
 * - joueur avec `id` connu  -> conserve (maj nom/numero, poste inchange) ;
 * - joueur sans `id`        -> cree (stats derivees du poste) ;
 * - joueur existant absent  -> supprime.
 * L'application est transactionnelle, puis TV/VEA sont recalcules.
 */

import type { Response } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/authUser';
import { sendError, sendSuccess } from '../utils/api-response';
import { updateTeamValues } from '../utils/team-values';
import {
  type AllowedRoster,
  type GameFormat,
  type Ruleset,
  DEFAULT_RULESET,
  getFormatConstraints,
  isGameFormat,
} from '@bb/game-engine';
import { getRosterFromDb } from '../utils/roster-helpers';
import { resolveStaffConfigBySlug } from '../services/roster-staff-config';
import {
  isTeamRosterFrozen,
  TEAM_ENGAGED_MESSAGE,
} from '../services/team-lock-status';
import { serverLog } from '../utils/server-log';
import type { SaveRosterBody } from '../schemas/team.schemas';

export async function handleSaveRoster(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const teamId = req.params.id;
  const body: SaveRosterBody = req.body;
  const { name, players } = body;

  try {
    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId: req.user!.id },
      include: { players: true, starPlayers: true },
    });
    if (!team) {
      sendError(res, 'Equipe introuvable', 404);
      return;
    }

    // Anti-triche : une equipe engagee ne peut plus etre editee.
    if (await isTeamRosterFrozen(teamId)) {
      sendError(res, TEAM_ENGAGED_MESSAGE, 403);
      return;
    }

    const ruleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
    const format: GameFormat = isGameFormat(team.format) ? team.format : 'bb11';
    const constraints = getFormatConstraints(format);

    const def = await getRosterFromDb(team.roster as AllowedRoster, 'fr', ruleset);
    if (!def) {
      sendError(res, 'Roster non reconnu', 400);
      return;
    }

    // Numeros uniques (les bornes 1-99 + noms non vides sont deja garantis
    // par le schema Zod).
    const numbers = players.map((p) => p.number);
    if (new Set(numbers).size !== numbers.length) {
      sendError(res, 'Les numeros de joueurs doivent etre uniques', 400);
      return;
    }

    // Les `id` fournis doivent appartenir a l'equipe.
    const existingPlayers = team.players as Array<{ id: string }>;
    const existingById = new Map(existingPlayers.map((p) => [p.id, p]));
    for (const p of players) {
      if (p.id !== undefined && !existingById.has(p.id)) {
        sendError(res, `Joueur invalide: ${p.id}`, 400);
        return;
      }
    }

    // Postes valides + comptage par poste.
    const posBySlug = new Map(def.positions.map((dp) => [dp.slug, dp]));
    const countByPos: Record<string, number> = {};
    for (const p of players) {
      if (!posBySlug.has(p.position)) {
        sendError(
          res,
          `Position '${p.position}' non trouvee dans le roster ${team.roster}`,
          400,
        );
        return;
      }
      countByPos[p.position] = (countByPos[p.position] ?? 0) + 1;
    }
    for (const pos of def.positions) {
      const c = countByPos[pos.slug] ?? 0;
      if (c < pos.min || c > pos.max) {
        sendError(res, `Poste ${pos.displayName}: min ${pos.min}, max ${pos.max}`, 400);
        return;
      }
    }

    // Bornes de format (BB11 11-16 / Sevens 7-11).
    if (
      players.length < constraints.minPlayers ||
      players.length > constraints.maxPlayers
    ) {
      sendError(
        res,
        `Une equipe doit avoir entre ${constraints.minPlayers} et ${constraints.maxPlayers} joueurs`,
        400,
      );
      return;
    }

    // Budget "comme a la creation" : joueurs + staff + Star Players <= budget
    // initial. Staff et Star Players sont lus depuis la DB (edites ailleurs).
    const playersCostPo = players.reduce((sum, p) => {
      const pos = posBySlug.get(p.position)!;
      return sum + pos.cost * 1000;
    }, 0);
    const staffCfg = await resolveStaffConfigBySlug(team.roster, ruleset, format);
    const staffCostPo =
      team.rerolls * staffCfg.rerollCost +
      team.cheerleaders * staffCfg.cheerleaderCost +
      team.assistants * staffCfg.assistantCost +
      (team.apothecary ? staffCfg.apothecaryCost : 0) +
      Math.max(0, team.dedicatedFans - 1) * staffCfg.dedicatedFanCost;
    const starCostPo = (team.starPlayers as Array<{ cost: number | null }>).reduce(
      (s, sp) => s + (sp.cost ?? 0),
      0,
    );
    const budgetPo = team.initialBudget * 1000;
    const totalPo = playersCostPo + staffCostPo + starCostPo;
    if (totalPo > budgetPo) {
      sendError(
        res,
        `Budget depasse: ${Math.round(totalPo / 1000)}k / ${team.initialBudget}k po`,
        400,
      );
      return;
    }

    // Application transactionnelle du diff (suppr / maj / creation).
    const keptIds = new Set(
      players.filter((p) => p.id).map((p) => p.id as string),
    );
    const toDelete = existingPlayers
      .filter((p) => !keptIds.has(p.id))
      .map((p) => p.id);
    const toUpdate = players.filter((p) => p.id);
    const toCreate = players.filter((p) => !p.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const operations: any[] = [];
    if (name !== undefined) {
      operations.push(
        prisma.team.update({ where: { id: teamId }, data: { name: name.trim() } }),
      );
    }
    for (const id of toDelete) {
      operations.push(prisma.teamPlayer.delete({ where: { id } }));
    }
    for (const p of toUpdate) {
      operations.push(
        prisma.teamPlayer.update({
          where: { id: p.id },
          data: { name: p.name.trim(), number: p.number },
        }),
      );
    }
    for (const p of toCreate) {
      const pos = posBySlug.get(p.position)!;
      operations.push(
        prisma.teamPlayer.create({
          data: {
            teamId,
            name: p.name.trim(),
            position: p.position,
            number: p.number,
            ma: pos.ma,
            st: pos.st,
            ag: pos.ag,
            pa: pos.pa,
            av: pos.av,
            skills: pos.skills,
          },
        }),
      );
    }
    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateTeamValues(prisma as any, teamId);

    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true },
    });

    sendSuccess(res, { team: updatedTeam });
  } catch (e: unknown) {
    serverLog.error('Erreur lors de la sauvegarde du roster:', e);
    sendError(res, 'Erreur serveur', 500);
  }
}
