/**
 * S27.8.33 — Module dedie au handler `handleCreateFromRoster`
 * extrait depuis l'inline anonyme `POST /create-from-roster` dans
 * `routes/team.ts` (final extraction pour ramener team.ts sous DoD
 * secondaire 400).
 *
 * Endpoint couvert :
 *  - `POST /team/create-from-roster` — `handleCreateFromRoster` :
 *    creation simplifiee d'une equipe depuis un template predefini
 *    (skaven / wood_elf / lizardmen). Plus simple que `/build` :
 *    pas de choix par position, juste un template fige par roster.
 *    Validations Star Players + budget. Cree l'equipe et les
 *    joueurs en batch, recalcule TV.
 *
 * Le helper `rosterTemplates` (~128l, 3 rosters supportes) et la
 * constante `ALLOWED_TEAMS` (~30 entrees) sont co-extraits avec le
 * handler car ils ne sont plus utilises ailleurs dans `team.ts`
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
  getStarPlayerBySlug,
} from '@bb/game-engine';
import {
  validateStarPlayerPairs,
  validateStarPlayersForTeam,
  calculateStarPlayersCost,
} from '../utils/star-player-validation';
import { resolveRuleset } from '../utils/ruleset-helpers';

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
 * Templates de roster pour `/create-from-roster`. Supporte 3
 * rosters : skaven, wood_elf, lizardmen (fallback). Utilise pour
 * les seeds et la creation rapide depuis l'UI debutant.
 */
function rosterTemplates(roster: AllowedRoster) {
  if (roster === 'skaven') {
    return [
      {
        position: 'skaven_blitzer',
        count: 2,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: 'block',
      },
      {
        position: 'skaven_thrower',
        count: 1,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 2,
        av: 8,
        skills: 'pass,sure-hands',
      },
      {
        position: 'skaven_gutter_runner',
        count: 2,
        ma: 9,
        st: 2,
        ag: 2,
        pa: 4,
        av: 8,
        skills: 'dodge',
      },
      {
        position: 'skaven_lineman',
        count: 6,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: '',
      },
      // Big Guy optionnel (non inclus par defaut)
    ];
  }

  if (roster === 'wood_elf') {
    return [
      {
        position: 'wood_elf_wardancer',
        count: 2,
        ma: 8,
        st: 3,
        ag: 2,
        pa: 4,
        av: 8,
        skills: 'block,dodge,leap',
      },
      {
        position: 'wood_elf_catcher',
        count: 2,
        ma: 8,
        st: 2,
        ag: 2,
        pa: 4,
        av: 8,
        skills: 'catch,dodge',
      },
      {
        position: 'wood_elf_thrower',
        count: 1,
        ma: 7,
        st: 3,
        ag: 2,
        pa: 2,
        av: 8,
        skills: 'pass,sure-hands',
      },
      {
        position: 'wood_elf_lineman',
        count: 6,
        ma: 7,
        st: 3,
        ag: 2,
        pa: 4,
        av: 8,
        skills: '',
      },
      // Treeman optionnel (non inclus par defaut)
    ];
  }

  // lizardmen (fallback)
  return [
    {
      position: 'lizardmen_saurus',
      count: 6,
      ma: 6,
      st: 4,
      ag: 4,
      pa: 6,
      av: 10,
      skills: '',
    },
    {
      position: 'lizardmen_skink_runner',
      count: 4,
      ma: 8,
      st: 2,
      ag: 3,
      pa: 4,
      av: 8,
      skills: 'dodge,stunty',
    },
    {
      position: 'lizardmen_chameleon_skink',
      count: 1,
      ma: 7,
      st: 2,
      ag: 3,
      pa: 3,
      av: 8,
      skills: 'dodge,on-the-ball,shadowing,stunty',
    },
    // Kroxigor optionnel (non inclus par defaut)
  ];
}

/**
 * S27.8.33 — `POST /team/create-from-roster`
 *
 * Creation simplifiee d'une equipe depuis un template predefini.
 * Plus simple que `/build` : pas de choix par position, juste un
 * template fige par roster. Validations Star Players + budget.
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
  } = req.body as {
    name: string;
    roster: string;
    teamValue?: number;
    starPlayers?: string[];
    ruleset?: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!ALLOWED_TEAMS.includes(roster as any))
    return res.status(400).json({ error: 'Roster non autorisé' });

  const ruleset = resolveRuleset(bodyRuleset);

  const finalTeamValue = teamValue || 1000;

  // Valider les Star Players si fournis
  const starPlayersToHire = starPlayerSlugs || [];
  if (starPlayersToHire.length > 0) {
    // Valider les paires obligatoires
    const pairValidation = validateStarPlayerPairs(starPlayersToHire);
    if (!pairValidation.valid) {
      return res.status(400).json({ error: pairValidation.error });
    }

    // Calculer le nombre de joueurs du template
    const templates = rosterTemplates(roster as AllowedRoster);
    let playerCount = 0;
    for (const t of templates) {
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

  const team = await prisma.team.create({
    data: {
      ownerId: req.user!.id,
      name,
      roster,
      ruleset,
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

  // Creer les joueurs
  const templates = rosterTemplates(roster as AllowedRoster);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const players: any[] = [];
  let number = 1;
  for (const t of templates) {
    for (let i = 0; i < t.count; i += 1) {
      players.push({
        teamId: team.id,
        name: `${t.position} ${i + 1}`,
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
  while (players.length < 11) {
    players.push({
      teamId: team.id,
      name: `Lineman ${players.length + 1}`,
      position: 'Lineman',
      number: players.length + 1,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: '',
    });
  }

  await prisma.teamPlayer.createMany({ data: players.slice(0, 16) });

  // Recruter les Star Players si fournis
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
