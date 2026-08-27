/**
 * Rosters autorisés côté serveur (création d'équipe, lecture
 * `/team/rosters/:id`).
 *
 * Lot 6.8 — la liste JOUABLE vient désormais de la base
 * (`services/roster-catalogue.isAllowedTeamRoster`, asynchrone). Ce module ne
 * garde que le catalogue COMPILÉ, qui sert de repli à ce service et de source
 * au seed : il ne doit plus être consulté directement par un handler, sinon un
 * roster créé en admin resterait refusé par le builder.
 */
import { ALLOWED_TEAMS as ENGINE_ALLOWED_TEAMS } from "@bb/game-engine";

export const ALLOWED_TEAMS: readonly string[] = ENGINE_ALLOWED_TEAMS;

/**
 * Repli COMPILÉ (synchrone) — cf. `services/roster-catalogue` pour la
 * résolution servie par la base, qui est celle que les routes utilisent.
 */
export function isCompiledTeamRoster(slug: string): boolean {
  return (ALLOWED_TEAMS as readonly string[]).includes(slug);
}
