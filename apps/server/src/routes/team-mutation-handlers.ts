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
import {
  captureTeamState,
  safeRecordTeamAudit,
  type TeamAuditPrismaLike,
} from '../services/team-audit';
import { serverLog } from '../utils/server-log';
import { deleteTeam, TeamDeleteError } from '../services/team-delete';
import {
  isTeamRosterFrozen,
  TEAM_ENGAGED_MESSAGE,
} from '../services/team-lock-status';
import { resolveStaffConfigBySlug } from '../services/roster-staff-config';
import {
  buildTeamBudgetSummary,
  syncDraftTreasury,
} from '../services/team-budget-summary';
import {
  DEFAULT_RULESET,
  isGameFormat,
  type GameFormat,
  type Ruleset,
  type RosterStaffConfig,
} from '@bb/game-engine';
import type { UpdateTeamInfoBody } from '../schemas/team.schemas';

/**
 * Verifie le staff demande contre la config resolue du roster x format.
 *
 * Les plafonds vivent en base (`RosterStaffConfig`, editables en admin) et
 * different par format : Sevens plafonne a 6 relances / 6 cheerleaders /
 * 3 assistants, et certains rosters n'ont pas droit a l'apothicaire. Les
 * ecrire en dur dans le schema Zod laissait passer des valeurs illegales.
 *
 * Retourne le message d'erreur a renvoyer, ou `null` si tout est legal.
 */
export function validateStaffAgainstConfig(
  body: UpdateTeamInfoBody,
  staff: RosterStaffConfig,
): string | null {
  const caps: ReadonlyArray<{
    value: number | undefined;
    min: number;
    max: number;
    label: string;
  }> = [
    { value: body.rerolls, min: 0, max: staff.maxRerolls, label: 'relances' },
    {
      value: body.cheerleaders,
      min: 0,
      max: staff.maxCheerleaders,
      label: 'cheerleaders',
    },
    {
      value: body.assistants,
      min: 0,
      max: staff.maxAssistants,
      label: 'assistants',
    },
    {
      value: body.dedicatedFans,
      min: 1,
      max: staff.maxDedicatedFans,
      label: 'fans devoues',
    },
  ];

  for (const cap of caps) {
    if (cap.value === undefined) continue;
    if (cap.value < cap.min || cap.value > cap.max) {
      return `Le nombre de ${cap.label} doit etre entre ${cap.min} et ${cap.max} pour cette equipe`;
    }
  }

  if (body.apothecary === true && !staff.apothecaryAllowed) {
    return "Cette equipe n'a pas droit a l'apothicaire";
  }

  return null;
}

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
  // Type pose par le schema Zod (`validate(updateTeamInfoSchema)`) : tout
  // drift schema/handler echoue a `tsc` plutot qu'en prod.
  const body: UpdateTeamInfoBody = req.body;
  const { rerolls, cheerleaders, assistants, apothecary, dedicatedFans } = body;

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

    // Anti-triche : le staff/inducements d'une equipe engagee ne se modifie
    // plus via cet endpoint (page d'edition verrouillee).
    if (await isTeamRosterFrozen(teamId)) {
      sendError(res, TEAM_ENGAGED_MESSAGE, 403);
      return;
    }

    // Plafonds/autorisations reels : ligne `RosterStaffConfig` du roster x
    // format de l'equipe (defaut du moteur si aucune ligne). Le schema Zod ne
    // borne que la sanite des entrees.
    const format: GameFormat = isGameFormat(team.format) ? team.format : 'bb11';
    const staff = await resolveStaffConfigBySlug(
      team.roster ?? '',
      (team.ruleset as Ruleset) ?? DEFAULT_RULESET,
      format,
    );
    const staffError = validateStaffAgainstConfig(body, staff);
    if (staffError) {
      sendError(res, staffError, 400);
      return;
    }

    // Budget « comme à la création » : joueurs + Star Players + staff cible
    // <= budget initial — la règle que `PUT /:id/roster` applique déjà.
    // Sans ce garde, le staff s'ajoutait librement au-delà du budget d'un
    // brouillon (VE > budget, trésorerie 0).
    const summary = await buildTeamBudgetSummary(
      prisma,
      {
        ...team,
        rerolls: rerolls ?? team.rerolls,
        cheerleaders: cheerleaders ?? team.cheerleaders,
        assistants: assistants ?? team.assistants,
        apothecary: apothecary ?? team.apothecary,
        dedicatedFans: dedicatedFans ?? team.dedicatedFans,
      },
      team.players ?? [],
      team.starPlayers ?? [],
    );
    if (summary.remaining < 0) {
      sendError(
        res,
        `Budget depasse: ${Math.round(summary.totalSpent / 1000)}k / ${team.initialBudget}k po`,
        400,
      );
      return;
    }

    const auditDb = prisma as unknown as TeamAuditPrismaLike;
    const auditBefore = await captureTeamState(auditDb, teamId);

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

    // Le staff pèse dans la VE : sans cette trace, un coach qui règle ses
    // relances puis constate une VE différente n'avait aucun moyen de
    // relier les deux.
    await safeRecordTeamAudit(auditDb, {
      teamId,
      action: 'team.info.update',
      before: auditBefore,
      details: { rerolls, cheerleaders, assistants, apothecary, dedicatedFans },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateTeamValues(prisma as any, teamId);
    // Brouillon libre : le staff se paie sur le budget initial, la
    // trésorerie doit donc suivre le reliquat (cf. `syncDraftTreasury`).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await syncDraftTreasury(prisma as any, teamId);

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

    // Anti-triche : une equipe engagee est verrouillee (renommage joueurs/
    // equipe inclus via cet endpoint).
    if (await isTeamRosterFrozen(teamId)) {
      sendError(res, TEAM_ENGAGED_MESSAGE, 403);
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
    const auditDb = prisma as unknown as TeamAuditPrismaLike;
    const auditBefore = await captureTeamState(auditDb, teamId);

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    await safeRecordTeamAudit(auditDb, {
      teamId,
      action: 'team.update',
      before: auditBefore,
      details: {
        renamedTo: name !== undefined ? name.trim() : undefined,
        players: players.map((p) => ({
          id: p.id,
          name: p.name.trim(),
          number: p.number,
        })),
      },
    });

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

/**
 * `DELETE /team/:id` — suppression (soft delete) d'une équipe par son coach.
 *
 * Refuse (409) si l'équipe est engagée dans une compétition non terminée
 * (ligue/coupe), avec un message nommant la compétition. 404 si l'équipe
 * n'existe pas / n'appartient pas au coach / est déjà supprimée. La logique
 * métier vit dans `services/team-delete.ts`.
 */
export async function handleDeleteTeam(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    await deleteTeam({ teamId: req.params.id, userId: req.user!.id });
    sendSuccess(res, { deleted: true });
  } catch (e: unknown) {
    if (e instanceof TeamDeleteError) {
      sendError(res, e.message, e.code === 'not_found' ? 404 : 409);
      return;
    }
    serverLog.error("Erreur lors de la suppression de l'equipe:", e);
    sendError(res, 'Erreur serveur', 500);
  }
}
