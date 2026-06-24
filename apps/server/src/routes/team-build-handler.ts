/**
 * S27.8.27 — Module dedie au handler `handleBuildTeam` extrait depuis
 * `routes/team.ts`. Sixieme slice du refactor monolith team.ts.
 *
 * Endpoint couvert :
 *  - `POST /team/build` — `handleBuildTeam` : creation d'une equipe
 *    complete depuis le builder (positions + count + budget +
 *    starPlayers + staff). Validations en cascade :
 *    - roster autorise
 *    - min/max par position
 *    - contraintes de format (BB11 11-16 / Sevens 7-11, non-Linemen,
 *      Big Guys, Star Players, plafonds staff) via validateFormatSelection
 *    - paires Star Players valides + cap joueurs selon format
 *    - budget (joueurs + Star Players + staff) <= teamValue
 *    Cree `team` + `teamPlayer[]` + `teamStarPlayer[]`, recalcule TV.
 *
 * Helpers leaf uniquement : `prisma`, `sendError`/`sendSuccess`,
 * `updateTeamValues`, `AllowedRoster`/`Ruleset`/`getRerollCost`/
 * `getStarPlayerBySlug` from `@bb/game-engine`,
 * `validateStarPlayerPairs`/`calculateStarPlayersCost`/
 * `validateStarPlayersForTeam` from `../utils/star-player-validation`,
 * `getRosterFromDb`, `resolveRuleset`, `serverLog`. Aucun cycle vers
 * `team.ts`.
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
  type GameFormat,
  getStarPlayerBySlug,
  getRerollCost,
  getFormatConstraints,
  validateFormatSelection,
  isGameFormat,
  canRosterHaveApothecary,
  isBigGuy,
  bigGuyLimitForRoster,
} from '@bb/game-engine';
import {
  validateStarPlayerPairs,
  validateStarPlayersForTeam,
  calculateStarPlayersCost,
} from '../utils/star-player-validation';
import { getRosterFromDb } from '../utils/roster-helpers';
import { resolveRuleset } from '../utils/ruleset-helpers';
import { serverLog } from '../utils/server-log';
import { isAllowedTeamRoster } from '../constants/allowed-teams';

/**
 * S27.8.27 — `POST /team/build`
 *
 * Creation atomique d'une equipe complete depuis le builder. Valide
 * en cascade roster, positions (min/max), contraintes de format
 * (validateFormatSelection : nombre de joueurs, non-Linemen, Big Guys,
 * Star Players, staff), Star Players (paires + cap), budget total, puis
 * cree team + players + starPlayers et recalcule TV.
 */
export async function handleBuildTeam(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const {
      name,
      roster,
      teamValue,
      choices,
      starPlayers: starPlayerSlugs,
      ruleset: bodyRuleset,
      format: bodyFormat,
      rerolls: bodyRerolls,
      cheerleaders: bodyCheerleaders,
      assistants: bodyAssistants,
      apothecary: bodyApothecary,
      dedicatedFans: bodyDedicatedFans,
    }: {
      name: string;
      roster: string;
      teamValue?: number;
      choices: Array<{ key: string; count: number }>;
      starPlayers?: string[];
      ruleset?: string;
      format?: string;
      rerolls?: number;
      cheerleaders?: number;
      assistants?: number;
      apothecary?: boolean;
      dedicatedFans?: number;
    } = req.body;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!isAllowedTeamRoster(roster)) {
      sendError(res, 'Roster non autorise', 400);
      return;
    }

    // Règle officielle BB : les équipes mort-vivantes (régénération) ne
    // peuvent pas recruter d'apothicaire. Refus explicite à la création
    // si le builder l'a quand même demandé pour un roster interdit.
    if ((bodyApothecary ?? false) && !canRosterHaveApothecary(roster)) {
      sendError(
        res,
        'Les équipes mort-vivantes ne peuvent pas recruter d\'apothicaire',
        422,
      );
      return;
    }

    const ruleset = resolveRuleset(bodyRuleset);
    const format: GameFormat = isGameFormat(bodyFormat) ? bodyFormat : 'bb11';
    const constraints = getFormatConstraints(format);

    const finalTeamValue = teamValue || constraints.startingBudget;

    const def = await getRosterFromDb(roster as AllowedRoster, 'fr', ruleset);
    if (!def) {
      sendError(res, 'Roster non trouve', 400);
      return;
    }

    let totalPlayers = 0;
    let totalCost = 0;
    const counts: Record<string, number> = {};
    for (const p of def.positions) {
      const c = Math.max(0, choices.find((x) => x.key === p.slug)?.count ?? 0);
      if (c < p.min || c > p.max) {
        sendError(
          res,
          `Poste ${p.displayName}: min ${p.min}, max ${p.max}`,
          400,
        );
        return;
      }
      counts[p.slug] = c;
      totalPlayers += c;
      totalCost += c * p.cost;
    }

    const rerolls = bodyRerolls ?? 0;
    const cheerleaders = bodyCheerleaders ?? 0;
    const assistants = bodyAssistants ?? 0;
    const apothecary = bodyApothecary ?? false;
    const dedicatedFans = bodyDedicatedFans ?? 1;

    const starPlayersToHire = starPlayerSlugs || [];

    // Contraintes propres au format (BB11 / Sevens) : nombre de joueurs,
    // non-Linemen, Big Guys, Star Players, plafonds de staff. Source unique
    // de vérité partagée avec l'UI (@bb/game-engine).
    const formatCheck = validateFormatSelection({
      format,
      // Le moteur (pur) attend pa: number avec sentinel 0 = "pas de passe".
      // La DB stocke null pour "-" ; on recoalesce à la frontière.
      positions: def.positions.map((p) => ({ ...p, pa: p.pa ?? 0 })),
      counts,
      starPlayerCount: starPlayersToHire.length,
      rerolls,
      cheerleaders,
      assistants,
      apothecary,
      dedicatedFans,
    });
    if (!formatCheck.valid) {
      sendError(res, formatCheck.error ?? 'Sélection invalide pour ce format', 400);
      return;
    }

    // A36 — Plafond COMBINÉ de Gros Bras (tous types confondus). Distinct des
    // `max` par poste : certaines équipes (Alliance, Bas-Fond, Élus du Chaos,
    // Renégats du Chaos) limitent le nombre TOTAL de Gros Bras alignés. La
    // composition est lue via `counts` (slug poste → quantité) + `def.positions`
    // (pour détecter les postes Gros Bras via `isBigGuy`).
    const bigGuyLimit = bigGuyLimitForRoster(roster);
    if (bigGuyLimit !== null) {
      const totalBigGuys = def.positions.reduce(
        (sum, p) => (isBigGuy(p) ? sum + Math.max(0, counts[p.slug] ?? 0) : sum),
        0,
      );
      if (totalBigGuys > bigGuyLimit) {
        sendError(
          res,
          `Cette équipe ne peut aligner que ${bigGuyLimit} Gros Bras maximum`,
          422,
        );
        return;
      }
    }

    const rerollUnitCost =
      (getRerollCost(roster) / 1000) * constraints.rerollCostMultiplier;
    const staffCost =
      rerolls * rerollUnitCost +
      cheerleaders * constraints.cheerleaderCost +
      assistants * constraints.assistantCost +
      (apothecary ? constraints.apothecaryCost : 0) +
      Math.max(0, dedicatedFans - 1) * constraints.dedicatedFanCost;

    let starPlayersCost = 0;

    if (starPlayersToHire.length > 0) {
      const pairValidation = validateStarPlayerPairs(starPlayersToHire);
      if (!pairValidation.valid) {
        sendError(
          res,
          pairValidation.error ?? 'Validation paires echouee',
          400,
        );
        return;
      }

      starPlayersCost =
        calculateStarPlayersCost(starPlayersToHire, ruleset) / 1000;

      const budgetInPo = finalTeamValue * 1000;
      const validation = validateStarPlayersForTeam(
        starPlayersToHire,
        roster,
        totalPlayers,
        budgetInPo - totalCost * 1000 - staffCost * 1000,
        ruleset,
      );

      if (!validation.valid) {
        sendError(
          res,
          validation.error ?? 'Validation Star Players echouee',
          400,
        );
        return;
      }
    }

    const totalBudgetUsed = totalCost + starPlayersCost + staffCost;
    if (totalBudgetUsed > finalTeamValue) {
      sendError(
        res,
        `Budget depasse: ${totalBudgetUsed}k (${totalCost}k joueurs + ${starPlayersCost}k Star Players + ${staffCost}k staff) / ${finalTeamValue}k`,
        400,
      );
      return;
    }

    let number = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerRows: any[] = [];
    for (const p of def.positions) {
      const c = Math.max(0, choices.find((x) => x.key === p.slug)?.count ?? 0);
      for (let i = 0; i < c; i += 1) {
        playerRows.push({
          name: `${p.displayName} ${i + 1}`,
          position: p.slug,
          number: number++,
          ma: p.ma,
          st: p.st,
          ag: p.ag,
          pa: p.pa,
          av: p.av,
          skills: p.skills,
        });
      }
    }
    const safePlayerRows = playerRows.slice(0, 16);

    const starPlayersData = starPlayersToHire.map((slug: string) => {
      const sp = getStarPlayerBySlug(slug, ruleset);
      return { starPlayerSlug: slug, cost: sp?.cost || 0 };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const team = await (prisma as any).$transaction(async (tx: any) => {
      const newTeam = await tx.team.create({
        data: {
          ownerId: req.user!.id,
          name,
          roster,
          ruleset,
          format,
          teamValue: finalTeamValue,
          initialBudget: finalTeamValue,
          treasury: 0,
          rerolls,
          cheerleaders,
          assistants,
          apothecary,
          dedicatedFans,
          currentValue: 0,
        },
      });
      await tx.teamPlayer.createMany({
        data: safePlayerRows.map((p: any) => ({ ...p, teamId: newTeam.id })),
      });
      if (starPlayersData.length > 0) {
        await tx.teamStarPlayer.createMany({
          data: starPlayersData.map((sp: any) => ({ ...sp, teamId: newTeam.id })),
        });
      }
      return newTeam;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateTeamValues(prisma as any, team.id);

    const withPlayers = await prisma.team.findUnique({
      where: { id: team.id },
      include: { players: true, starPlayers: true },
    });

    const enrichedTeam = {
      ...withPlayers,
      starPlayers:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        withPlayers?.starPlayers.map((sp: any) => {
          const starPlayerData = getStarPlayerBySlug(
            sp.starPlayerSlug,
            ruleset,
          );
          return {
            id: sp.id,
            slug: sp.starPlayerSlug,
            cost: sp.cost,
            hiredAt: sp.hiredAt,
            ...starPlayerData,
          };
        }) || [],
    };

    sendSuccess(
      res,
      {
        team: enrichedTeam,
        cost: totalBudgetUsed,
        budget: finalTeamValue,
        breakdown: {
          players: totalCost,
          starPlayers: starPlayersCost,
          staff: staffCost,
        },
      },
      201,
    );
  } catch (e: unknown) {
    serverLog.error("Erreur lors de la creation de l'equipe:", e);
    sendError(res, 'Erreur serveur', 500);
  }
}
