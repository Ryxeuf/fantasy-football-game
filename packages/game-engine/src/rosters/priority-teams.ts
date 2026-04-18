/**
 * P2.7 — Equipes prioritaires du MVP.
 *
 * Les 5 rosters doivent recevoir un contenu complet (skills, star players,
 * descriptions, images, tests) avant d'etendre le jeu aux autres equipes.
 * Voir TODO.md, Sprints 13-14.
 */
import {
  getAvailableStarPlayers,
  type StarPlayerDefinition,
} from './star-players';
import { DEFAULT_RULESET, type Ruleset } from './positions';

/**
 * Slugs des rosters prioritaires (MVP), dans l'ordre roadmap.
 */
export const PRIORITY_TEAM_ROSTERS = [
  'skaven',
  'gnome',
  'lizardmen',
  'dwarf',
  'imperial_nobility',
] as const;

export type PriorityTeamRoster = (typeof PRIORITY_TEAM_ROSTERS)[number];

/**
 * Retourne les star players hirables par chacune des 5 equipes prioritaires.
 *
 * Le resultat derive du flag `hirableBy` de chaque star player croise avec les
 * `regionalRules` du roster prioritaire. Les taches aval (P2.8, P2.9, P2.10)
 * iterent sur cette structure pour rediger le contenu manquant.
 *
 * Chaque invocation retourne des listes neuves : safe pour mutation locale.
 */
export function getStarPlayersHirableByPriorityTeams(
  ruleset: Ruleset = DEFAULT_RULESET,
): Record<PriorityTeamRoster, StarPlayerDefinition[]> {
  const result = {} as Record<PriorityTeamRoster, StarPlayerDefinition[]>;
  for (const roster of PRIORITY_TEAM_ROSTERS) {
    result[roster] = [...getAvailableStarPlayers(roster, [], ruleset)];
  }
  return result;
}
