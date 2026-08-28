/**
 * Périmètre d'accès à une équipe pour la page d'édition.
 *
 * Les handlers d'édition filtrent tous `{ id, ownerId: req.user!.id }` : un
 * admin ne pouvait donc éditer AUCUNE équipe, ni corriger une erreur de
 * saisie, ni ajuster un roster litigieux. La console admin n'avait qu'une
 * fiche en lecture seule.
 *
 * Deux règles, centralisées ici pour que les handlers ne puissent pas
 * diverger :
 *
 *  1. **Qui** — le coach reste limité à SES équipes ; un admin agit sur
 *     n'importe laquelle (`teamAccessWhere`).
 *  2. **Le gel** — `isTeamRosterFrozen` est un garde-fou ANTI-TRICHE : un
 *     coach ne remanie pas la composition d'une équipe déjà engagée. Un
 *     admin, lui, intervient précisément sur ces équipes-là (erreur de
 *     saisie, litige de ligue) : le gel ne s'applique pas à lui
 *     (`isRosterFrozenFor`).
 *
 * Rien n'est perdu en traçabilité : `TeamAuditEvent` journalise chaque
 * mutation, et `resolveActorRole` marque l'étape `admin` dès que l'acteur
 * n'est pas le propriétaire de l'équipe.
 */

import type { AuthenticatedRequest } from "../middleware/authUser";
import { hasRole } from "../utils/roles";
import { isTeamRosterFrozen } from "./team-lock-status";

/** `where` Prisma d'accès à UNE équipe : `ownerId` sauf pour un admin. */
export interface TeamAccessWhere {
  readonly id: string;
  readonly ownerId?: string;
}

/** L'appelant porte-t-il le rôle admin ? */
export function isAdminRequest(req: AuthenticatedRequest): boolean {
  return hasRole(req.user?.roles ?? req.user?.role, "admin");
}

/**
 * Filtre d'accès à l'équipe visée. Le coach ne voit que les siennes ; un
 * admin n'est pas contraint par `ownerId`.
 */
export function teamAccessWhere(
  req: AuthenticatedRequest,
  teamId: string,
): TeamAccessWhere {
  return isAdminRequest(req)
    ? { id: teamId }
    : { id: teamId, ownerId: req.user!.id };
}

/**
 * Le roster est-il gelé POUR CET APPELANT ?
 *
 * Toujours `false` pour un admin : le gel protège du remaniement d'une
 * équipe engagée par son propre coach, pas de l'intervention d'un
 * administrateur.
 */
export async function isRosterFrozenFor(
  req: AuthenticatedRequest,
  teamId: string,
): Promise<boolean> {
  if (isAdminRequest(req)) return false;
  return isTeamRosterFrozen(teamId);
}
