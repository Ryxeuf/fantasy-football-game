/**
 * Rosters autorisés côté serveur (création d'équipe, lecture `/team/rosters/:id`).
 *
 * Source unique : `@bb/game-engine` (`TEAM_ROSTERS` / Season 3 par défaut).
 * Ne pas dupliquer la liste dans les handlers — sinon un roster ajouté au
 * moteur (ex. bretonnian) apparaît dans le catalogue public mais échoue
 * au builder authentifié.
 */
import { ALLOWED_TEAMS as ENGINE_ALLOWED_TEAMS } from "@bb/game-engine";

export const ALLOWED_TEAMS: readonly string[] = ENGINE_ALLOWED_TEAMS;

export function isAllowedTeamRoster(slug: string): boolean {
  return (ALLOWED_TEAMS as readonly string[]).includes(slug);
}
