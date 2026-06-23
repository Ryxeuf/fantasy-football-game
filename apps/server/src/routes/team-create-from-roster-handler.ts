/**
 * S27.8.33 — Module dedie au handler `handleCreateFromRoster`
 * extrait depuis l'inline anonyme `POST /create-from-roster` dans
 * `routes/team.ts` (final extraction pour ramener team.ts sous DoD
 * secondaire 400).
 *
 * Endpoint couvert :
 *  - `POST /team/create-from-roster` — `handleCreateFromRoster` :
 *    creation simplifiee d'une equipe depuis le roster choisi. Plus
 *    simple que `/build` : pas de choix par position, la composition
 *    de depart est derivee des positions reelles du roster pour le
 *    ruleset cible (Saison 3 par defaut) via `buildDefaultLineup`.
 *    Validations Star Players + budget. Cree l'equipe et les
 *    joueurs en batch, recalcule TV.
 *
 * La constante `ALLOWED_TEAMS` (~30 entrees) est co-extraite avec le
 * handler car elle n'est plus utilisee ailleurs dans `team.ts`
 * apres les extractions S27.8.22-S27.8.32.
 *
 * Helpers leaf uniquement : `prisma`, `AllowedRoster` from
 * `@bb/game-engine`, `validateStarPlayerPairs`/
 * `validateStarPlayersForTeam`/`calculateStarPlayersCost` from
 * `../utils/star-player-validation`, `getStarPlayerBySlug`,
 * `resolveRuleset`, `updateTeamValues`. Aucun cycle.
 */

import type { Response } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/authUser';
import { updateTeamValues } from '../utils/team-values';
import {
  type AllowedRoster,
  type GameFormat,
  type Ruleset,
  getStarPlayerBySlug,
  getFormatConstraints,
  getTeamPositions,
  isGameFormat,
} from '@bb/game-engine';
import {
  validateStarPlayerPairs,
  validateStarPlayersForTeam,
  calculateStarPlayersCost,
} from '../utils/star-player-validation';
import { resolveRuleset } from '../utils/ruleset-helpers';
import { getRosterFromDb } from '../utils/roster-helpers';
import { buildDefaultLineup, type LineupEntry } from '../utils/default-lineup';

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
 * Resout la composition de depart d'un roster a partir des positions
 * reelles du ruleset cible (Saison 3 par defaut). On lit d'abord la DB
 * (editable cote admin) puis on retombe sur les donnees statiques
 * compilees du game-engine si la DB n'est pas (encore) seedee. La
 * composition est derivee via `buildDefaultLineup` : slugs, couts,
 * stats et noms d'affichage restent toujours coherents avec le roster
 * choisi et le ruleset.
 *
 * Avant ce changement, 3 rosters (skaven / wood_elf / lizardmen)
 * utilisaient des templates figes aux slugs Saison 2 (ex.
 * `lizardmen_saurus`) absents des rosters Saison 3
 * (`lizardmen_bloqueur_saurus`). Consequence cote equipe creee : cout
 * par defaut errone (50k pour tous), nom = slug brut, stats Saison 2
 * et VE faussee.
 */
async function resolveLineup(
  roster: AllowedRoster,
  ruleset: Ruleset,
): Promise<LineupEntry[]> {
  const dbRoster = await getRosterFromDb(roster, 'fr', ruleset);
  if (dbRoster && dbRoster.positions.length > 0) {
    return buildDefaultLineup(dbRoster.positions);
  }
  const staticPositions = getTeamPositions(roster, ruleset);
  if (staticPositions.length > 0) {
    return buildDefaultLineup(staticPositions);
  }
  return [];
}

/**
 * S27.8.33 — `POST /team/create-from-roster`
 *
 * Creation simplifiee d'une equipe depuis le roster choisi. Plus
 * simple que `/build` : pas de choix par position, la composition est
 * derivee des positions reelles du roster. Validations Star Players +
 * budget.
 */
export async function handleCreateFromRoster(
  req: AuthenticatedRequest,
  res: Response,
): Promise<Response | void> {
  const {
    name,
    roster,
    teamValue,
    starPlayers: starPlayerSlugs,
    ruleset: bodyRuleset,
    format: bodyFormat,
  }: {
    name: string;
    roster: string;
    teamValue?: number;
    starPlayers?: string[];
    ruleset?: string;
    format?: string;
  } = req.body;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!ALLOWED_TEAMS.includes(roster as any))
    return res.status(400).json({ error: 'Roster non autorisé' });

  const ruleset = resolveRuleset(bodyRuleset) as Ruleset;
  const format: GameFormat = isGameFormat(bodyFormat) ? bodyFormat : 'bb11';

  const finalTeamValue = teamValue || getFormatConstraints(format).startingBudget;

  // Composition de départ dérivée des positions réelles du roster pour le
  // ruleset ciblé (DB en priorité, fallback données statiques game-engine).
  const lineup = await resolveLineup(roster as AllowedRoster, ruleset);

  // Valider les Star Players si fournis
  const starPlayersToHire = starPlayerSlugs || [];
  if (starPlayersToHire.length > 0) {
    // Valider les paires obligatoires
    const pairValidation = validateStarPlayerPairs(starPlayersToHire);
    if (!pairValidation.valid) {
      return res.status(400).json({ error: pairValidation.error });
    }

    // Calculer le nombre de joueurs de la composition
    let playerCount = 0;
    for (const t of lineup) {
      playerCount += t.count;
      if (playerCount >= 16) {
        playerCount = 16;
        break;
      }
    }
    playerCount = Math.max(11, playerCount); // Au moins 11 joueurs

    // Valider que Star Players + joueurs ne depassent pas 16
    if (playerCount + starPlayersToHire.length > 16) {
      return res.status(400).json({
        error: `Trop de joueurs ! ${playerCount} joueurs + ${starPlayersToHire.length} Star Players = ${playerCount + starPlayersToHire.length} (maximum: 16)`,
      });
    }

    // Calculer le cout des Star Players
    const starPlayersCost = calculateStarPlayersCost(starPlayersToHire);
    const budgetInPo = finalTeamValue * 1000;

    if (starPlayersCost > budgetInPo) {
      return res.status(400).json({
        error: `Budget insuffisant pour les Star Players. Coût: ${(starPlayersCost / 1000).toLocaleString()} K po, budget: ${finalTeamValue} K po`,
      });
    }

    // Valider la disponibilite pour ce roster
    const validation = validateStarPlayersForTeam(
      starPlayersToHire,
      roster,
      playerCount,
      budgetInPo,
      ruleset,
    );

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
  }

  // Creer les joueurs (sans teamId, injecte dans la transaction)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRows: any[] = [];
  let number = 1;
  for (const t of lineup) {
    for (let i = 0; i < t.count; i += 1) {
      playerRows.push({
        name: `${t.displayName || t.position} ${i + 1}`,
        position: t.position,
        number: number++,
        ma: t.ma,
        st: t.st,
        ag: t.ag,
        pa: t.pa,
        av: t.av,
        skills: t.skills,
      });
      if (number > 16) break;
    }
    if (number > 16) break;
  }

  // Assurer au moins 11 joueurs
  while (playerRows.length < 11) {
    playerRows.push({
      name: `Lineman ${playerRows.length + 1}`,
      position: 'Lineman',
      number: playerRows.length + 1,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: '',
    });
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
        rerolls: 0,
        cheerleaders: 0,
        assistants: 0,
        apothecary: false,
        dedicatedFans: 1,
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

  // Calculer automatiquement les valeurs d'equipe
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateTeamValues(prisma as any, team.id);

  const withPlayers = await prisma.team.findUnique({
    where: { id: team.id },
    include: {
      players: true,
      starPlayers: true,
    },
  });

  // Enrichir les Star Players
  const enrichedTeam = {
    ...withPlayers,
    starPlayers:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      withPlayers?.starPlayers.map((sp: any) => {
        const starPlayerData = getStarPlayerBySlug(
          sp.starPlayerSlug,
          withPlayers.ruleset,
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

  res.status(201).json({ team: enrichedTeam });
}
