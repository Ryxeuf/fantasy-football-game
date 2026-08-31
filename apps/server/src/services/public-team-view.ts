/**
 * Vue publique enrichie d'une équipe partagée (`GET /api/public/teams/:token`).
 *
 * La page `/r/:token` ne servait qu'un roster nu : slugs de compétences
 * bruts, aucun coût par joueur, aucun coût de staff. Elle affiche
 * désormais la même chose que la fiche du coach — et doit donc recevoir
 * les MÊMES chiffres, calculés ICI et non re-dérivés côté web :
 *
 *  - `playerValues` — valeur de chaque joueur (embauche + surcoûts
 *    d'avancement), la même résolution que la VE (cf. `computePlayerValuesFor`) ;
 *  - `staffConfig` — coûts unitaires du staff (roster × format, base d'abord) ;
 *  - `budgetSummary` — postes de dépense et VE/VEA fraîches.
 *
 * Sans ça, la page publique annoncerait un tarif de recrue là où la fiche
 * affiche la valeur réelle du joueur, et une VE différente de celle du
 * coach — sur la seule surface que des inconnus consultent.
 *
 * Les trois sont des enrichissements d'AFFICHAGE : chacun est isolé (même
 * posture que `GET /team/:id`), un échec dégrade la page mais ne prive
 * jamais le visiteur du roster. La lecture reste STRICTEMENT en lecture
 * seule : contrairement à la fiche du coach, on ne persiste pas la VE
 * fraîche — un visiteur anonyme n'écrit pas dans l'équipe d'autrui.
 */

import {
  DEFAULT_RULESET,
  isGameFormat,
  type GameFormat,
  type RosterStaffConfig,
  type Ruleset,
} from '@bb/game-engine';
import { prisma } from '../prisma';
import { serverLog } from '../utils/server-log';
import {
  computePlayerValuesFor,
  type PlayerValueBreakdown,
} from '../utils/team-values';
import { resolveStaffConfigBySlug } from './roster-staff-config';
import {
  buildTeamBudgetSummary,
  type TeamBudgetSummary,
} from './team-budget-summary';
import { getPublicTeamByToken, type PublicTeam } from './team-share';

/** Joueur tel qu'exposé publiquement (pas d'historique de carrière). */
export interface PublicTeamPlayerView {
  readonly id: string;
  readonly name: string;
  readonly position: string;
  readonly number: number;
  readonly ma: number;
  readonly st: number;
  readonly ag: number;
  readonly pa: number | null;
  readonly av: number;
  readonly skills: string;
  readonly dead: boolean;
  readonly firedAt: Date | null;
  readonly imageUrl: string | null;
  /**
   * JSON des améliorations. Sert au REPLI de valorisation côté web quand
   * `playerValues` manque (serveur pré-correctif, enrichissement en
   * échec) : sans lui, un joueur augmenté retomberait sur son tarif de
   * recrue.
   */
  readonly advancements: string | null;
}

/** Star Player engagé, tel qu'exposé publiquement. */
export interface PublicTeamStarPlayerView {
  readonly id: string;
  readonly starPlayerSlug: string;
  readonly cost: number;
}

/**
 * Équipe publique servie à `/r/:token`.
 *
 * Vue EXPLICITE et non la ligne `Team` brute : le propriétaire
 * (`ownerId`) et le jeton de partage n'ont rien à faire dans une réponse
 * anonyme, et une colonne ajoutée plus tard au modèle ne doit pas devenir
 * publique par accident.
 */
export interface PublicTeamView {
  readonly id: string;
  readonly name: string;
  readonly roster: string;
  readonly ruleset: string;
  readonly format: string;
  readonly teamValue: number;
  readonly currentValue: number;
  readonly treasury: number;
  readonly rerolls: number;
  readonly cheerleaders: number;
  readonly assistants: number;
  readonly apothecary: boolean;
  readonly dedicatedFans: number;
  readonly logoUrl: string | null;
  readonly description: string | null;
  readonly players: readonly PublicTeamPlayerView[];
  readonly starPlayers: readonly PublicTeamStarPlayerView[];
  /** Coûts unitaires du staff (roster × format). Absent si non résolu. */
  readonly staffConfig?: RosterStaffConfig;
  /** Postes de dépense + VE/VEA. Absent si le calcul a échoué. */
  readonly budgetSummary?: TeamBudgetSummary;
  /** Valeur par joueur, indexée par `TeamPlayer.id`. */
  readonly playerValues?: Record<string, PlayerValueBreakdown>;
}

/**
 * Exécute un enrichissement d'affichage sans jamais faire échouer la
 * lecture : un échec est journalisé et rend `undefined`, le web ayant un
 * repli pour chaque champ optionnel.
 */
async function optionalEnrichment<T>(
  label: string,
  run: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await run();
  } catch (error: unknown) {
    serverLog.error(`[public-team-view] ${label}`, error);
    return undefined;
  }
}

function toPlayerView(
  player: PublicTeam['players'][number],
): PublicTeamPlayerView {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    number: player.number,
    ma: player.ma,
    st: player.st,
    ag: player.ag,
    pa: player.pa ?? null,
    av: player.av,
    skills: player.skills ?? '',
    dead: player.dead,
    firedAt: player.firedAt ?? null,
    imageUrl: player.imageUrl ?? null,
    advancements: player.advancements ?? null,
  };
}

/**
 * Projette une équipe déjà chargée en vue publique enrichie.
 *
 * Séparé de la résolution par token pour rester testable sans base.
 */
export async function buildPublicTeamView(
  team: PublicTeam,
): Promise<PublicTeamView> {
  const ruleset = (team.ruleset as Ruleset) ?? DEFAULT_RULESET;
  const format: GameFormat = isGameFormat(team.format) ? team.format : 'bb11';

  const [staffConfig, budgetSummary, playerValues] = await Promise.all([
    optionalEnrichment('config staff', () =>
      resolveStaffConfigBySlug(team.roster, ruleset, format),
    ),
    optionalEnrichment('resume budgetaire', () =>
      buildTeamBudgetSummary(prisma, team, team.players, team.starPlayers),
    ),
    optionalEnrichment('valeurs par joueur', () =>
      computePlayerValuesFor(prisma, team, team.players),
    ),
  ]);

  return {
    id: team.id,
    name: team.name,
    roster: team.roster,
    ruleset: String(team.ruleset),
    format: String(team.format),
    // VE/VEA fraîches quand le résumé a pu être calculé : la page publique
    // afficherait sinon une valeur d'équipe périmée là où la fiche du
    // coach en montre une autre. Aucune persistance ici (lecture anonyme).
    teamValue: budgetSummary?.teamValue ?? team.teamValue,
    currentValue: budgetSummary?.currentValue ?? team.currentValue,
    treasury: team.treasury,
    rerolls: team.rerolls,
    cheerleaders: team.cheerleaders,
    assistants: team.assistants,
    apothecary: team.apothecary,
    dedicatedFans: team.dedicatedFans,
    logoUrl: team.logoUrl ?? null,
    description: team.description ?? null,
    players: team.players.map(toPlayerView),
    starPlayers: team.starPlayers.map((sp) => ({
      id: sp.id,
      starPlayerSlug: sp.starPlayerSlug,
      cost: sp.cost,
    })),
    ...(staffConfig ? { staffConfig } : {}),
    ...(budgetSummary ? { budgetSummary } : {}),
    ...(playerValues ? { playerValues } : {}),
  };
}

/** Équipe publique enrichie résolue par son jeton de partage. */
export async function getPublicTeamViewByToken(
  token: string,
): Promise<PublicTeamView | null> {
  const team = await getPublicTeamByToken(token);
  if (!team) return null;
  return buildPublicTeamView(team);
}
