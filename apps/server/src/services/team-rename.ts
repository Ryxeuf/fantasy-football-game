/**
 * Renommage d'une équipe par son coach.
 *
 * Le nom d'équipe est purement COSMÉTIQUE : il n'entre ni dans le calcul
 * de la VE (`utils/team-values`), ni dans le budget, ni dans la
 * composition du roster. Il ne passe donc PAS par le verrou anti-triche
 * `isTeamRosterFrozen` — même posture que l'identité d'un joueur
 * (`PATCH /team/:id/players/:playerId/identity`, E12) : une équipe
 * engagée en ligue, en coupe ou dans un match en cours reste renommable.
 *
 * Un match déjà démarré n'est pas affecté : `setupPreMatchWithTeams`
 * COPIE le nom dans l'état de jeu au coup d'envoi (`match-start.ts`,
 * `local-match.ts`), l'état en cours et les replays gardent donc le nom
 * qu'ils ont figé.
 *
 * Contrepartie de cette ouverture : chaque renommage effectif écrit une
 * étape `team.rename` dans le journal d'équipe (`name` fait partie de
 * `DIFFED_FIELDS`, le diff porte donc `{ from, to }`).
 */

import { prisma } from "../prisma";
import {
  captureTeamState,
  safeRecordTeamAudit,
  type TeamAuditPrismaLike,
} from "./team-audit";

export type TeamRenameErrorCode = "not_found" | "invalid_name";

export class TeamRenameError extends Error {
  constructor(
    public readonly code: TeamRenameErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TeamRenameError";
  }
}

/** Bornes du nom, alignées sur la création (`createFromRosterSchema`). */
export const TEAM_NAME_MAX_LENGTH = 100;

export interface TeamRenameResult {
  readonly id: string;
  readonly name: string;
  /** Nom avant l'opération — `null` si aucune écriture (nom identique). */
  readonly previousName: string | null;
}

/**
 * Renomme l'équipe `teamId` possédée par `ownerId`.
 *
 * Renommer avec le nom courant est un succès SANS écriture ni étape de
 * journal : le champ inline de la fiche renvoie sinon une étape à chaque
 * ouverture/fermeture, et le journal devient illisible.
 *
 * @throws TeamRenameError `not_found` si l'équipe n'existe pas, ne
 *   appartient pas à `ownerId` ou est déjà soft-deletée (les trois cas
 *   sont volontairement indiscernables côté API).
 * @throws TeamRenameError `invalid_name` si le nom est vide après trim ou
 *   dépasse 100 caractères (garde-fou pour les appels hors route, la
 *   route valide déjà via `renameTeamSchema`).
 */
export async function renameTeam(input: {
  teamId: string;
  ownerId: string;
  name: string;
}): Promise<TeamRenameResult> {
  const { teamId, ownerId } = input;
  const name = input.name.trim();

  if (name.length === 0) {
    throw new TeamRenameError(
      "invalid_name",
      "Le nom de l'équipe ne peut pas être vide",
    );
  }
  if (name.length > TEAM_NAME_MAX_LENGTH) {
    throw new TeamRenameError(
      "invalid_name",
      `Le nom de l'équipe ne peut pas dépasser ${TEAM_NAME_MAX_LENGTH} caractères`,
    );
  }

  // `deletedAt: null` pour qu'une équipe supprimée réponde « introuvable »
  // plutôt que d'accepter un renommage muet (même règle que `deleteTeam`).
  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!team) {
    throw new TeamRenameError("not_found", "Équipe introuvable");
  }

  if (team.name === name) {
    return { id: team.id, name, previousName: null };
  }

  const auditDb = prisma as unknown as TeamAuditPrismaLike;
  const before = await captureTeamState(auditDb, teamId);

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: { name },
    select: { id: true, name: true },
  });

  await safeRecordTeamAudit(auditDb, {
    teamId,
    action: "team.rename",
    entity: "Team",
    entityId: teamId,
    before,
    details: { from: team.name, to: name },
  });

  return { id: updated.id, name: updated.name, previousName: team.name };
}
