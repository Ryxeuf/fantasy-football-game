/**
 * Description (fluff) d'une équipe, saisie par son coach.
 *
 * Champ purement COSMÉTIQUE — au même titre que le nom
 * (`services/team-rename.ts`) : il n'entre ni dans le calcul de la VE, ni
 * dans le budget, ni dans la composition du roster. Il ne passe donc PAS
 * par le verrou anti-triche `isTeamRosterFrozen` : une équipe engagée en
 * ligue, en coupe ou dans un match en cours reste descriptible.
 *
 * Sa raison d'être : c'est le texte servi dans l'aperçu de partage
 * (`/r/:token`, `/me/teams/:id`) à la place de la description générique du
 * site. « Pas de description » et « description vide » ne sont donc PAS
 * deux états distincts — une chaîne blanche est normalisée en `null`, pour
 * que les lecteurs n'aient jamais à arbitrer entre les deux.
 *
 * Contrepartie de l'ouverture (comme pour le renommage) : chaque
 * modification effective écrit une étape `team.description.update` dans le
 * journal d'équipe.
 */

import { prisma } from "../prisma";
import {
  captureTeamState,
  safeRecordTeamAudit,
  type TeamAuditPrismaLike,
} from "./team-audit";

export type TeamDescriptionErrorCode = "not_found" | "invalid_description";

export class TeamDescriptionError extends Error {
  constructor(
    public readonly code: TeamDescriptionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TeamDescriptionError";
  }
}

/** Borne du fluff, alignée sur `updateTeamDescriptionSchema`. */
export const TEAM_DESCRIPTION_MAX_LENGTH = 1000;

export interface TeamDescriptionResult {
  readonly id: string;
  readonly description: string | null;
  /** Valeur avant l'opération — `undefined` si aucune écriture. */
  readonly previousDescription?: string | null;
}

/**
 * Normalise une saisie en valeur stockable : trim, puis chaîne vide =>
 * `null`. Pur, exporté pour que les appels hors route (scripts, tests)
 * appliquent la même règle que la route.
 */
export function normalizeTeamDescription(
  raw: string | null | undefined,
): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Écrit la description de l'équipe `teamId` possédée par `ownerId`.
 *
 * Écrire la valeur courante est un succès SANS écriture ni étape de
 * journal : le champ de la fiche d'édition renverrait sinon une étape à
 * chaque sauvegarde, et le journal deviendrait illisible (même règle que
 * `renameTeam`).
 *
 * @throws TeamDescriptionError `not_found` si l'équipe n'existe pas,
 *   n'appartient pas à `ownerId` ou est déjà soft-deletée (les trois cas
 *   sont volontairement indiscernables côté API).
 * @throws TeamDescriptionError `invalid_description` au-delà de 1000
 *   caractères (garde-fou pour les appels hors route ; la route valide
 *   déjà via `updateTeamDescriptionSchema`).
 */
export async function updateTeamDescription(input: {
  teamId: string;
  ownerId: string;
  description: string | null;
}): Promise<TeamDescriptionResult> {
  const { teamId, ownerId } = input;
  const description = normalizeTeamDescription(input.description);

  if (description !== null && description.length > TEAM_DESCRIPTION_MAX_LENGTH) {
    throw new TeamDescriptionError(
      "invalid_description",
      `La description ne peut pas dépasser ${TEAM_DESCRIPTION_MAX_LENGTH} caractères`,
    );
  }

  // `deletedAt: null` pour qu'une équipe supprimée réponde « introuvable »
  // plutôt que d'accepter une écriture muette (même règle que `renameTeam`).
  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId, deletedAt: null },
    select: { id: true, description: true },
  });
  if (!team) {
    throw new TeamDescriptionError("not_found", "Équipe introuvable");
  }

  const current = normalizeTeamDescription(team.description);
  if (current === description) {
    return { id: team.id, description };
  }

  const auditDb = prisma as unknown as TeamAuditPrismaLike;
  const before = await captureTeamState(auditDb, teamId);

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: { description },
    select: { id: true, description: true },
  });

  await safeRecordTeamAudit(auditDb, {
    teamId,
    action: "team.description.update",
    entity: "Team",
    entityId: teamId,
    before,
    details: { from: current, to: description },
  });

  return {
    id: updated.id,
    description: updated.description,
    previousDescription: current,
  };
}
