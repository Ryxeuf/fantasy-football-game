/**
 * Suppression (soft delete) et restauration d'une équipe.
 *
 * Règle centrale, valable pour le coach comme pour l'admin : on ne
 * hard-delete JAMAIS une équipe. Elle reste référencée par l'historique des
 * compétitions (`LeagueParticipant`, `CupParticipant`, `TeamSelection`) qu'on
 * veut préserver — un `DELETE` violerait d'ailleurs ces clés étrangères dès
 * que l'équipe a joué. `deletedAt` la retire des listes, et la garde
 * restaurable.
 *
 * Deux chemins, deux postures :
 *
 *  - **coach** (`deleteTeam`) : refus si l'équipe est encore engagée dans une
 *    compétition NON terminée (anti-triche : on ne quitte pas une ligue en
 *    cours par la porte de service) ;
 *  - **admin** (`adminSoftDeleteTeam`) : jamais de refus — l'admin est
 *    précisément l'échappatoire quand une équipe doit disparaître d'une
 *    compétition en cours. L'action étant réversible (`restoreTeam`), le
 *    garde-fou n'a pas lieu d'être ; les engagements actifs sont renvoyés en
 *    `warnings` pour que la console les affiche avant/après coup.
 *
 * Erreurs typées (`TeamDeleteError.code`) pour que la route mappe le bon
 * status HTTP et que l'UI affiche le message tel quel.
 */

import { prisma } from "../prisma";
import {
  captureTeamState,
  safeRecordTeamAudit,
  type TeamAuditPrismaLike,
} from "./team-audit";

export type TeamDeleteErrorCode =
  | "not_found"
  | "in_active_league"
  | "in_active_cup"
  /** Suppression admin d'une équipe déjà supprimée (409). */
  | "already_deleted"
  /** Restauration d'une équipe qui n'est pas supprimée (409). */
  | "not_deleted";

export class TeamDeleteError extends Error {
  constructor(
    public readonly code: TeamDeleteErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TeamDeleteError";
  }
}

/** Statut de saison de ligue considéré comme terminé (autorise la suppression). */
const LEAGUE_SEASON_DONE = "completed";
/** Statuts de coupe considérés comme terminés (autorisent la suppression). */
const CUP_DONE_STATUSES = ["terminee", "archivee"];

/** Compétitions NON terminées auxquelles l'équipe est encore rattachée. */
export interface TeamActiveEngagements {
  /** Nom de la ligue en cours/à venir, `null` si aucune. */
  readonly leagueName: string | null;
  /** Nom de la coupe en cours/à venir, `null` si aucune. */
  readonly cupName: string | null;
}

/**
 * Engagements actifs de l'équipe. Sert de garde-fou côté coach et de simple
 * avertissement côté admin — d'où l'extraction, pour que les deux chemins ne
 * puissent pas diverger sur la définition de « engagée ».
 */
export async function findActiveEngagements(
  teamId: string,
): Promise<TeamActiveEngagements> {
  const [activeLeague, activeCup] = await Promise.all([
    prisma.leagueParticipant.findFirst({
      where: {
        teamId,
        status: "active",
        season: { status: { not: LEAGUE_SEASON_DONE } },
      },
      select: {
        season: { select: { league: { select: { name: true } } } },
      },
    }),
    prisma.cupParticipant.findFirst({
      where: {
        teamId,
        cup: { status: { notIn: CUP_DONE_STATUSES } },
      },
      select: { cup: { select: { name: true } } },
    }),
  ]);

  return {
    leagueName: activeLeague ? (activeLeague.season?.league?.name ?? "une ligue") : null,
    cupName: activeCup ? (activeCup.cup?.name ?? "une coupe") : null,
  };
}

/** Écrit `deletedAt` + l'étape de journal. Facteur commun coach / admin. */
async function markDeleted(
  teamId: string,
  details: Record<string, unknown>,
): Promise<Date> {
  const auditDb = prisma as unknown as TeamAuditPrismaLike;
  const before = await captureTeamState(auditDb, teamId);
  const deletedAt = new Date();
  await prisma.team.update({
    where: { id: teamId },
    data: { deletedAt },
  });
  await safeRecordTeamAudit(auditDb, {
    teamId,
    action: "team.delete",
    before,
    details,
  });
  return deletedAt;
}

export async function deleteTeam(input: {
  teamId: string;
  userId: string;
}): Promise<void> {
  const { teamId, userId } = input;

  // Ownership + non déjà supprimée. `findFirst` filtre `deletedAt: null` pour
  // qu'une double suppression renvoie "introuvable" plutôt qu'un succès muet.
  const team = await prisma.team.findFirst({
    where: { id: teamId, ownerId: userId, deletedAt: null },
    select: { id: true },
  });
  if (!team) {
    throw new TeamDeleteError("not_found", "Équipe introuvable");
  }

  const { leagueName, cupName } = await findActiveEngagements(teamId);
  if (leagueName) {
    throw new TeamDeleteError(
      "in_active_league",
      `Impossible de supprimer : l'équipe est engagée dans la ligue « ${leagueName} » (en cours ou à venir). Retire-la d'abord.`,
    );
  }
  if (cupName) {
    throw new TeamDeleteError(
      "in_active_cup",
      `Impossible de supprimer : l'équipe est engagée dans la coupe « ${cupName} » (en cours ou à venir). Retire-la d'abord.`,
    );
  }

  await markDeleted(teamId, { userId });
}

/** Résultat d'une suppression admin : la date posée + ce qu'elle impacte. */
export interface AdminSoftDeleteResult {
  readonly deletedAt: Date;
  readonly teamName: string;
  readonly ownerId: string;
  /** Compétitions en cours dont l'équipe disparaît — à afficher, pas à bloquer. */
  readonly warnings: readonly string[];
}

/**
 * Suppression par un admin : soft delete inconditionnel.
 *
 * Contrairement au coach, aucun engagement ne bloque — mais chacun est
 * remonté en avertissement pour que la console dise ce qui vient d'être
 * impacté.
 */
export async function adminSoftDeleteTeam(input: {
  teamId: string;
}): Promise<AdminSoftDeleteResult> {
  const { teamId } = input;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, ownerId: true, deletedAt: true },
  });
  if (!team) {
    throw new TeamDeleteError("not_found", "Équipe non trouvée");
  }
  if (team.deletedAt) {
    // Idempotence explicite : sans ce refus, un double clic réécrivait la
    // date de suppression et faussait la chronologie du journal.
    throw new TeamDeleteError(
      "already_deleted",
      "Cette équipe est déjà supprimée",
    );
  }

  const { leagueName, cupName } = await findActiveEngagements(teamId);
  const warnings: string[] = [];
  if (leagueName) {
    warnings.push(
      `L'équipe était engagée dans la ligue « ${leagueName} » (en cours ou à venir).`,
    );
  }
  if (cupName) {
    warnings.push(
      `L'équipe était engagée dans la coupe « ${cupName} » (en cours ou à venir).`,
    );
  }

  const deletedAt = await markDeleted(teamId, { admin: true, warnings });

  return {
    deletedAt,
    teamName: team.name,
    ownerId: team.ownerId,
    warnings,
  };
}

/** Résultat d'une restauration. */
export interface TeamRestoreResult {
  readonly teamName: string;
  readonly ownerId: string;
  /** Date de suppression qui vient d'être effacée (trace pour l'audit admin). */
  readonly previousDeletedAt: Date;
}

/**
 * Restauration d'une équipe soft-deletée (admin).
 *
 * On remet simplement `deletedAt` à `null` : les joueurs, Star Players et
 * rattachements n'ayant jamais été supprimés, l'équipe revient telle quelle.
 * Refus 409 si l'équipe est déjà active — restaurer une équipe vivante n'a
 * pas de sens et masquerait une erreur d'identifiant.
 */
export async function restoreTeam(input: {
  teamId: string;
}): Promise<TeamRestoreResult> {
  const { teamId } = input;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, ownerId: true, deletedAt: true },
  });
  if (!team) {
    throw new TeamDeleteError("not_found", "Équipe non trouvée");
  }
  if (!team.deletedAt) {
    throw new TeamDeleteError("not_deleted", "Cette équipe n'est pas supprimée");
  }

  const auditDb = prisma as unknown as TeamAuditPrismaLike;
  const before = await captureTeamState(auditDb, teamId);
  await prisma.team.update({
    where: { id: teamId },
    data: { deletedAt: null },
  });
  await safeRecordTeamAudit(auditDb, {
    teamId,
    action: "team.restore",
    before,
    details: { admin: true, previousDeletedAt: team.deletedAt.toISOString() },
  });

  return {
    teamName: team.name,
    ownerId: team.ownerId,
    previousDeletedAt: team.deletedAt,
  };
}
