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
 *    - 11-16 joueurs au total
 *    - paires Star Players valides + cap 16 joueurs
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
  getStarPlayerBySlug,
  getRerollCost,
} from '@bb/game-engine';
import {
  validateStarPlayerPairs,
  validateStarPlayersForTeam,
  calculateStarPlayersCost,
} from '../utils/star-player-validation';
import { getRosterFromDb } from '../utils/roster-helpers';
import { resolveRuleset } from '../utils/ruleset-helpers';
import { serverLog } from '../utils/server-log';

const ALLOWED_TEAMS = [
  'skaven',
  'lizardmen',
  'wood_elf',
  'dark_elf',
  'dwarf',
  'goblin',
  'undead',
  'chaos_renegade',
  'ogre',
  'halfling',
  'underworld',
  'chaos_chosen',
  'imperial_nobility',
  'necromantic_horror',
  'orc',
  'nurgle',
  'old_world_alliance',
  'elven_union',
  'human',
  'black_orc',
  'snotling',
  'chaos_dwarf',
  'slann',
  'amazon',
  'high_elf',
  'khorne',
  'vampire',
  'tomb_kings',
  'gnome',
  'norse',
] as const;

/**
 * S27.8.27 — `POST /team/build`
 *
 * Creation atomique d'une equipe complete depuis le builder. Valide
 * en cascade roster, positions (min/max), total joueurs (11-16),
 * Star Players (paires + cap), budget total, puis cree team +
 * players + starPlayers et recalcule TV.
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
      rerolls: bodyRerolls,
      cheerleaders: bodyCheerleaders,
      assistants: bodyAssistants,
      apothecary: bodyApothecary,
      dedicatedFans: bodyDedicatedFans,
    } = req.body as {
      name: string;
      roster: string;
      teamValue?: number;
      choices: Array<{ key: string; count: number }>;
      starPlayers?: string[];
      ruleset?: string;
      rerolls?: number;
      cheerleaders?: number;
      assistants?: number;
      apothecary?: boolean;
      dedicatedFans?: number;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!ALLOWED_TEAMS.includes(roster as any)) {
      sendError(res, 'Roster non autorise', 400);
      return;
    }
    const ruleset = resolveRuleset(bodyRuleset);

    const finalTeamValue = teamValue || 1000;

    const def = await getRosterFromDb(roster as AllowedRoster, 'fr', ruleset);
    if (!def) {
      sendError(res, 'Roster non trouve', 400);
      return;
    }

    let totalPlayers = 0;
    let totalCost = 0;
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
      totalPlayers += c;
      totalCost += c * p.cost;
    }
    if (totalPlayers < 11 || totalPlayers > 16) {
      sendError(res, 'Il faut entre 11 et 16 joueurs', 400);
      return;
    }

    const rerolls = bodyRerolls ?? 0;
    const cheerleaders = bodyCheerleaders ?? 0;
    const assistants = bodyAssistants ?? 0;
    const apothecary = bodyApothecary ?? false;
    const dedicatedFans = bodyDedicatedFans ?? 1;

    const rerollUnitCost = getRerollCost(roster) / 1000;
    const staffCost =
      rerolls * rerollUnitCost +
      cheerleaders * 10 +
      assistants * 10 +
      (apothecary ? 50 : 0) +
      Math.max(0, dedicatedFans - 1) * 10;

    const starPlayersToHire = starPlayerSlugs || [];
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

      if (totalPlayers + starPlayersToHire.length > 16) {
        sendError(
          res,
          `Trop de joueurs ! ${totalPlayers} joueurs + ${starPlayersToHire.length} Star Players = ${totalPlayers + starPlayersToHire.length} (maximum: 16)`,
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

    const team = await prisma.team.create({
      data: {
        ownerId: req.user!.id,
        name,
        roster,
        ruleset,
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

    let number = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const players: any[] = [];
    for (const p of def.positions) {
      const c = Math.max(0, choices.find((x) => x.key === p.slug)?.count ?? 0);
      for (let i = 0; i < c; i += 1) {
        players.push({
          teamId: team.id,
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
    await prisma.teamPlayer.createMany({ data: players });

    if (starPlayersToHire.length > 0) {
      const starPlayersData = starPlayersToHire.map((slug: string) => {
        const sp = getStarPlayerBySlug(slug, ruleset);
        return {
          teamId: team.id,
          starPlayerSlug: slug,
          cost: sp?.cost || 0,
        };
      });

      await prisma.teamStarPlayer.createMany({ data: starPlayersData });
    }

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
