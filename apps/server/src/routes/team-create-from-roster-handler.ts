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
import { creditInitialTreasury } from '../services/team-budget-summary';
import { safeRecordTeamAudit, type TeamAuditPrismaLike } from '../services/team-audit';
import {
  RegionalLeagueError,
  resolveRegionalLeagueForCreation,
} from '../services/team-regional-league';
import {
  type AllowedRoster,
  type GameFormat,
  type Ruleset,
  defaultBuildBudgetK,
  getTeamPositions,
  getTournamentRosterRules,
  isGameFormat,
} from '@bb/game-engine';
import { getStarPlayerBySlugDb } from '../utils/star-player-repository';
import {
  validateStarPlayerPairs,
  validateStarPlayersForTeam,
  calculateStarPlayersCost,
} from '../utils/star-player-validation';
import { resolveRuleset } from '../utils/ruleset-helpers';
import { parseTournamentRuleset } from '../utils/tournament-ruleset-helpers';
import {
  getRosterFromDb,
  type RosterPayload,
} from '../utils/roster-helpers';
import { buildDefaultLineup, type LineupEntry } from '../utils/default-lineup';
import { isAllowedTeamRoster } from '../services/roster-catalogue';
import { loadTeamRulesCatalogue } from '../services/team-rules-catalogue';

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
function resolveLineup(
  roster: AllowedRoster,
  ruleset: Ruleset,
  dbRoster: RosterPayload | null,
): LineupEntry[] {
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
    tournamentRuleset: bodyTournamentRuleset,
    regionalLeague: bodyRegionalLeague,
  }: {
    name: string;
    roster: string;
    teamValue?: number;
    starPlayers?: string[];
    ruleset?: string;
    format?: string;
    tournamentRuleset?: string | null;
    regionalLeague?: string | null;
  } = req.body;
  const ruleset = resolveRuleset(bodyRuleset) as Ruleset;
  const format: GameFormat = isGameFormat(bodyFormat) ? bodyFormat : 'bb11';

  // Lot 6.8 — univers des rosters servi par la base (repli catalogue compilé).
  if (!(await isAllowedTeamRoster(roster, ruleset)))
    return res.status(400).json({ error: 'Roster non autorisé' });

  // Règlement de tournoi (null = aucun). Slug inconnu refusé net.
  const parsedPack = await parseTournamentRuleset(bodyTournamentRuleset);
  if (!parsedPack.ok) return res.status(400).json({ error: parsedPack.error });
  const pack = parsedPack.def;

  // Roster en base, lu UNE fois : il porte le budget par défaut (lot 6.7),
  // les positions (compo de départ) et les Ligues déclarées (choix de Ligue
  // régionale plus bas).
  const dbRoster = await getRosterFromDb(roster, 'fr', ruleset);
  const rulesCatalogue = await loadTeamRulesCatalogue(ruleset);

  // Lot 6.7 — budget de construction : valeur du coach si fournie, sinon
  // `Roster.budget` (base) et non plus le plafond compilé du format.
  let finalTeamValue =
    teamValue || defaultBuildBudgetK(dbRoster?.budget, format);

  // Le règlement impose édition, format et budget d'or du tier du roster.
  // Pas de pool de SPP sur ce flux simplifié (aucun achat de compétence
  // possible ici) : conformément au pack, les SPP non dépensés à la
  // création sont perdus — le builder complet (`/team/build`) est le flux
  // qui permet de les dépenser.
  const packRosterRules = pack ? getTournamentRosterRules(pack, roster) : null;
  if (pack) {
    if (pack.edition !== ruleset) {
      return res.status(400).json({
        error: `Le règlement ${pack.shortLabel} requiert l'édition ${pack.edition}`,
      });
    }
    if (pack.format !== format) {
      return res.status(400).json({
        error: `Le règlement ${pack.shortLabel} requiert le format ${pack.format}`,
      });
    }
    if (!packRosterRules) {
      return res.status(400).json({
        error: `Ce roster n'est pas autorisé par le règlement ${pack.shortLabel}`,
      });
    }
    finalTeamValue = packRosterRules.goldBudget;
  }

  // Ligue régionale de l'équipe : choix du coach (obligatoire dès que le
  // roster a plusieurs Ligues), attribution d'office s'il n'y en a qu'une,
  // ou aucune si le règlement de tournoi neutralise l'axe régional.
  let regionalLeague: string | null = null;
  try {
    regionalLeague = resolveRegionalLeagueForCreation({
      roster,
      ruleset,
      pack,
      requested: bodyRegionalLeague,
      // Ligues DÉCLARÉES par le roster : le choix accepté est exactement
      // celui que la fiche du roster et le sélecteur affichent.
      declaredRules: dbRoster?.regionalRules,
      // Lot 6.5 — les Ligues sont nommées comme sur la fiche du roster.
      rulesCatalogue: rulesCatalogue,
    });
  } catch (e: unknown) {
    if (e instanceof RegionalLeagueError) {
      return res.status(422).json({ error: e.message });
    }
    throw e;
  }

  // Composition de départ dérivée des positions réelles du roster pour le
  // ruleset ciblé (DB en priorité, fallback données statiques game-engine).
  const lineup = resolveLineup(roster as AllowedRoster, ruleset, dbRoster);

  // Valider les Star Players si fournis
  const starPlayersToHire = starPlayerSlugs || [];
  if (starPlayersToHire.length > 0) {
    // Restrictions du règlement de tournoi : autorisation par roster + bannis.
    if (pack && packRosterRules) {
      if (!packRosterRules.starPlayersAllowed) {
        return res.status(400).json({
          error: `Le règlement ${pack.shortLabel} n'autorise pas les Star Players pour ce roster`,
        });
      }
      const banned = starPlayersToHire.filter((slug) =>
        pack.bannedStarPlayers.includes(slug),
      );
      if (banned.length > 0) {
        return res.status(400).json({
          error: `Star Player(s) interdit(s) par le règlement ${pack.shortLabel} : ${banned.join(', ')}`,
        });
      }
    }

    // Valider les paires obligatoires, au ruleset de l'équipe : les paires
    // déclarées en Saison 3 ne s'appliquent pas à une équipe Saison 2.
    const pairValidation = await validateStarPlayerPairs(
      starPlayersToHire,
      ruleset,
    );
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

    // Cout des Star Players AU RULESET DE L'EQUIPE. Sans lui, une star qui
    // n'existe pas dans le ruleset par défaut était comptée 0 po : Star Player
    // gratuit pour une équipe Saison 2 (S12 de l'audit).
    const starPlayersCost = await calculateStarPlayersCost(
      starPlayersToHire,
      ruleset,
    );
    const budgetInPo = finalTeamValue * 1000;

    if (starPlayersCost > budgetInPo) {
      return res.status(400).json({
        error: `Budget insuffisant pour les Star Players. Coût: ${(starPlayersCost / 1000).toLocaleString()} K po, budget: ${finalTeamValue} K po`,
      });
    }

    // Valider la disponibilite pour ce roster
    const validation = await validateStarPlayersForTeam(
      starPlayersToHire,
      roster,
      playerCount,
      budgetInPo,
      ruleset,
      regionalLeague,
      dbRoster?.regionalRules,
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

  const starPlayersData = await Promise.all(
    starPlayersToHire.map(async (slug: string) => {
      const sp = await getStarPlayerBySlugDb(slug, ruleset);
      return { starPlayerSlug: slug, cost: sp?.cost || 0 };
    }),
  );

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
        regionalLeague,
        rerolls: 0,
        cheerleaders: 0,
        assistants: 0,
        apothecary: false,
        dedicatedFans: 1,
        currentValue: 0,
        tournamentRuleset: pack?.slug ?? null,
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

  // Journal d'équipe : étape 1 de la corrélation (création).
  await safeRecordTeamAudit(prisma as unknown as TeamAuditPrismaLike, {
    teamId: team.id,
    action: 'team.create.from-roster',
    before: null,
    details: {
      mode: 'from-roster',
      roster,
      ruleset,
      format,
      initialBudget: finalTeamValue,
      players: safePlayerRows.length,
      starPlayers: starPlayersData.length,
      tournamentRuleset: pack?.slug ?? null,
      regionalLeague,
    },
  });

  // Calculer automatiquement les valeurs d'equipe
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateTeamValues(prisma as any, team.id);
  // Règle BB : l'or non dépensé à la construction part en trésorerie.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await creditInitialTreasury(prisma as any, team.id);

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
    starPlayers: await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (withPlayers?.starPlayers ?? []).map(async (sp: any) => {
        const starPlayerData = await getStarPlayerBySlugDb(
          sp.starPlayerSlug,
          withPlayers!.ruleset as Ruleset,
        );
        return {
          id: sp.id,
          slug: sp.starPlayerSlug,
          cost: sp.cost,
          hiredAt: sp.hiredAt,
          ...starPlayerData,
        };
      }),
    ),
  };

  res.status(201).json({ team: enrichedTeam });
}
