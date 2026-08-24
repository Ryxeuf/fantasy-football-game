/**
 * Résumé budgétaire d'une équipe — source unique du bloc « Résumé du
 * budget » de la fiche d'équipe.
 *
 * Motivation : le web re-dérivait ces montants de son côté
 * (`getPlayerCost(position, roster)` sans le ruleset de l'équipe, sans les
 * surcoûts d'avancement, avec sa propre formule de staff). Résultat : un
 * « Coût actuel » et un « Budget restant » qui ne collaient ni à la VE
 * calculée par le serveur, ni à la trésorerie affichée juste en dessous.
 * Le serveur calcule désormais tous les postes une seule fois, à partir du
 * même `computeTeamValueBreakdown` que `updateTeamValues`.
 *
 * Unités : tous les montants sont en **pièces d'or** (po), y compris
 * `initialBudget` — la colonne `Team.initialBudget` est stockée en kpo.
 */

import {
  defaultStaffConfig,
  isGameFormat,
  type GameFormat,
  type Ruleset,
} from '@bb/game-engine';
import { DEFAULT_RULESET } from '@bb/game-engine';
import { computeTeamValueBreakdownFor } from '../utils/team-values';

export interface TeamBudgetSummary {
  /** Budget de construction, en po (`Team.initialBudget` × 1000). */
  readonly initialBudget: number;
  /** Coût de tous les joueurs engagés (base + surcoûts d'avancement). */
  readonly playersCost: number;
  /** Coût des Star Players recrutés. */
  readonly starPlayersCost: number;
  /** Cheerleaders + assistants + apothicaire. */
  readonly staffCost: number;
  /** Relances d'équipe. */
  readonly rerollsCost: number;
  /**
   * Fans dévoués achetés (le premier est offert à la création). Compte au
   * budget de construction mais PAS dans la VE/VEA.
   */
  readonly dedicatedFansCost: number;
  /** Somme des postes ci-dessus (hors budget initial). */
  readonly totalSpent: number;
  /**
   * Reliquat du budget de construction (`initialBudget - totalSpent`).
   * À la création il est crédité à la trésorerie ; il peut être négatif si
   * une équipe a été éditée en admin au-delà de son budget.
   */
  readonly remaining: number;
  /** Trésorerie réelle de l'équipe (po) — la monnaie d'après-création. */
  readonly treasury: number;
  /** VE — Valeur d'Équipe. */
  readonly teamValue: number;
  /** VEA — Valeur d'Équipe Actuelle. */
  readonly currentValue: number;
}

interface BudgetTeamRow {
  readonly roster: string;
  readonly ruleset?: string | null;
  readonly format?: string | null;
  readonly rerolls: number;
  readonly cheerleaders: number;
  readonly assistants: number;
  readonly apothecary: boolean;
  readonly dedicatedFans: number;
  readonly initialBudget: number;
  readonly treasury: number;
}

interface BudgetPlayerRow {
  readonly position: string;
  readonly dead?: boolean | null;
  readonly firedAt?: Date | null;
  readonly missNextMatch?: boolean | null;
  readonly advancements?: string | null;
}

interface BudgetStarPlayerRow {
  readonly cost?: number | null;
}

/**
 * Coût d'achat des fans dévoués : le premier fan est offert à la création,
 * les suivants coûtent `dedicatedFanCost`. (Leur valeur n'entre pas dans la
 * VE — cf. `calculateStaffCost` dans le moteur.)
 */
export function dedicatedFansPurchaseCost(
  dedicatedFans: number,
  dedicatedFanCost: number,
): number {
  return Math.max(0, dedicatedFans - 1) * dedicatedFanCost;
}

/**
 * Construit le résumé budgétaire d'une équipe déjà chargée (équipe +
 * joueurs + Star Players).
 */
export async function buildTeamBudgetSummary(
  db: unknown,
  team: BudgetTeamRow,
  players: readonly BudgetPlayerRow[],
  starPlayers: readonly BudgetStarPlayerRow[] = [],
): Promise<TeamBudgetSummary> {
  const ruleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
  const format: GameFormat = isGameFormat(team.format) ? team.format : 'bb11';

  const breakdown = await computeTeamValueBreakdownFor(db, team, players);

  // Le coût du fan dévoué n'entre pas dans la VE : il n'est donc pas dans
  // le breakdown et se résout à part (config DB si présente, défaut sinon).
  const fanCost = await resolveDedicatedFanCost(db, team.roster, ruleset, format);
  const dedicatedFansCost = dedicatedFansPurchaseCost(
    team.dedicatedFans,
    fanCost,
  );

  const starPlayersCost = starPlayers.reduce(
    (sum, sp) => sum + (sp.cost ?? 0),
    0,
  );

  const initialBudget = team.initialBudget * 1000;
  const totalSpent =
    breakdown.playersCost +
    starPlayersCost +
    breakdown.staffCost +
    breakdown.rerollsCost +
    dedicatedFansCost;

  return {
    initialBudget,
    playersCost: breakdown.playersCost,
    starPlayersCost,
    staffCost: breakdown.staffCost,
    rerollsCost: breakdown.rerollsCost,
    dedicatedFansCost,
    totalSpent,
    remaining: initialBudget - totalSpent,
    treasury: team.treasury,
    teamValue: breakdown.teamValue,
    currentValue: breakdown.currentValue,
  };
}

/** Coût unitaire d'un fan dévoué (config DB par roster × format, ou défaut). */
async function resolveDedicatedFanCost(
  db: unknown,
  rosterSlug: string,
  ruleset: Ruleset,
  format: GameFormat,
): Promise<number> {
  const fallback = defaultStaffConfig(rosterSlug, format).dedicatedFanCost;
  try {
    const client = db as {
      roster: { findUnique: (args: unknown) => Promise<{ id: string } | null> };
      rosterStaffConfig: {
        findUnique: (
          args: unknown,
        ) => Promise<{ dedicatedFanCost: number } | null>;
      };
    };
    const roster = await client.roster.findUnique({
      where: { slug_ruleset: { slug: rosterSlug, ruleset } },
      select: { id: true },
    });
    if (!roster) return fallback;
    const row = await client.rosterStaffConfig.findUnique({
      where: { rosterId_format: { rosterId: roster.id, format } },
      select: { dedicatedFanCost: true },
    });
    return row?.dedicatedFanCost ?? fallback;
  } catch {
    return fallback;
  }
}


/**
 * Crédite à la trésorerie le reliquat du budget de construction.
 *
 * Appelé une seule fois, juste après la création d'une équipe (et après
 * `updateTeamValues`, pour que le calcul parte des joueurs réellement
 * créés). Sans ce crédit, l'or non dépensé au build disparaissait : la
 * fiche affichait « Budget restant 10K » face à une trésorerie à 0.
 *
 * No-op si le reliquat est nul ou négatif (équipe éditée au-delà de son
 * budget) ou si la trésorerie a déjà été créditée.
 */
export async function creditInitialTreasury(
  prisma: PrismaLikeForTreasury,
  teamId: string,
): Promise<number> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { players: true, starPlayers: true },
  });
  if (!team || team.treasury !== 0) return team?.treasury ?? 0;

  const summary = await buildTeamBudgetSummary(
    prisma,
    team,
    team.players,
    team.starPlayers,
  );
  const treasury = Math.max(0, summary.remaining);
  if (treasury === 0) return 0;

  await prisma.team.update({ where: { id: teamId }, data: { treasury } });
  return treasury;
}

/** Sous-ensemble du client Prisma utilisé par `creditInitialTreasury`. */
interface PrismaLikeForTreasury {
  team: {
    findUnique: (args: unknown) => Promise<
      | (BudgetTeamRow & {
          players: BudgetPlayerRow[];
          starPlayers: BudgetStarPlayerRow[];
        })
      | null
    >;
    update: (args: unknown) => Promise<unknown>;
  };
}
