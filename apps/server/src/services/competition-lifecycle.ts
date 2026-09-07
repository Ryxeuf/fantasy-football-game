/**
 * Cycle de vie des compétitions : archivage et suppression d'une ligue ou
 * d'une coupe par son COMMISSAIRE (créateur) — ou par un administrateur.
 *
 * Jusqu'ici seul l'admin archivait une ligue (`/admin/leagues/:id/archive`),
 * une coupe ne s'archivait que depuis « terminée », et rien ne se supprimait.
 * Ce service porte les deux opérations pour les deux familles, avec une seule
 * règle d'autorisation et une seule classe d'erreur, plutôt que de les
 * disperser dans `routes/league.ts` (3 000 lignes) et `routes/cup.ts`.
 *
 * - L'archivage pose les valeurs DÉJÀ lues par les listes et pages
 *   d'archives (`League.status = "archived"`, `Cup.status = "archivee"`) :
 *   aucune nouvelle colonne de gating. Idempotent (`changed: false`).
 *   Aucun verrou de statut : clore une compétition en cours est une décision
 *   de commissaire (classements et feuilles restent consultables).
 * - La suppression est définitive : la cascade Prisma emporte saisons,
 *   poules, appariements, feuilles, invitations et documents ; les équipes et
 *   les matchs joués en ligne (`Match.leagueSeasonId` → null) survivent.
 *   Les destinataires sont résolus AVANT l'effacement (ils disparaissent avec
 *   lui) et notifiés APRÈS, pour ne jamais annoncer une suppression qui a
 *   échoué.
 * - Dans les deux cas, les coachs dont une équipe est inscrite sont notifiés
 *   dans l'application (hors auteur de l'action) via le fan-out jamais
 *   bloquant de `in-app-notifications`.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import {
  createInAppNotifications,
  type InAppNotificationPayload,
} from "./in-app-notifications";

export type CompetitionKind = "league" | "cup";

export type CompetitionLifecycleErrorCode = "not_found" | "forbidden";

export class CompetitionLifecycleError extends Error {
  constructor(
    public readonly code: CompetitionLifecycleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CompetitionLifecycleError";
  }
}

export interface LifecycleActor {
  readonly userId: string;
  readonly isAdmin: boolean;
}

export interface ArchiveCompetitionResult {
  readonly id: string;
  readonly kind: CompetitionKind;
  readonly status: string;
  readonly previousStatus: string;
  readonly changed: boolean;
  /** Coachs notifiés (0 si déjà archivée). */
  readonly notified: number;
}

export interface DeleteCompetitionResult {
  readonly id: string;
  readonly kind: CompetitionKind;
  readonly name: string;
  readonly notified: number;
}

export const LEAGUE_ARCHIVED_STATUS = "archived";
export const CUP_ARCHIVED_STATUS = "archivee";

interface CompetitionHead {
  readonly id: string;
  readonly name: string;
  readonly creatorId: string;
  readonly status: string;
}

const LABELS: Record<
  CompetitionKind,
  { notFound: string; forbidden: string; noun: string; feminine: boolean }
> = {
  league: {
    notFound: "Ligue introuvable",
    forbidden:
      "Seul le commissaire (createur) ou un administrateur peut gerer cette ligue",
    noun: "ligue",
    feminine: true,
  },
  cup: {
    notFound: "Coupe introuvable",
    forbidden:
      "Seul le commissaire (createur) ou un administrateur peut gerer cette coupe",
    noun: "coupe",
    feminine: true,
  },
};

async function loadHead(
  kind: CompetitionKind,
  id: string,
): Promise<CompetitionHead | null> {
  const select = { id: true, name: true, creatorId: true, status: true };
  const row =
    kind === "league"
      ? await prisma.league.findUnique({ where: { id }, select })
      : await prisma.cup.findUnique({ where: { id }, select });
  return (row as CompetitionHead | null) ?? null;
}

/** Charge la compétition et vérifie que l'acteur peut la gérer. */
async function loadManageable(
  kind: CompetitionKind,
  id: string,
  actor: LifecycleActor,
): Promise<CompetitionHead> {
  const head = await loadHead(kind, id);
  if (!head) {
    throw new CompetitionLifecycleError("not_found", LABELS[kind].notFound);
  }
  if (head.creatorId !== actor.userId && !actor.isAdmin) {
    throw new CompetitionLifecycleError("forbidden", LABELS[kind].forbidden);
  }
  return head;
}

function uniqueIds(ids: ReadonlyArray<string | null | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => !!id)));
}

/**
 * Coachs possédant une équipe ACTIVE inscrite à une saison de la ligue
 * (toutes saisons confondues), dédoublonnés.
 */
export async function listLeagueParticipantUserIds(
  leagueId: string,
): Promise<string[]> {
  const rows = (await prisma.leagueParticipant.findMany({
    where: { season: { leagueId }, status: "active" },
    select: { team: { select: { ownerId: true } } },
  })) as Array<{ team: { ownerId: string } | null }>;
  return uniqueIds(rows.map((r) => r.team?.ownerId));
}

/** Coachs possédant une équipe inscrite à la coupe, dédoublonnés. */
export async function listCupParticipantUserIds(
  cupId: string,
): Promise<string[]> {
  const rows = (await prisma.cupParticipant.findMany({
    where: { cupId },
    select: { team: { select: { ownerId: true } } },
  })) as Array<{ team: { ownerId: string } | null }>;
  return uniqueIds(rows.map((r) => r.team?.ownerId));
}

function actorLabel(head: CompetitionHead, actor: LifecycleActor): string {
  return actor.userId === head.creatorId
    ? "par son commissaire"
    : "par un administrateur";
}

async function notifyParticipants(
  recipients: readonly string[],
  actor: LifecycleActor,
  payload: InAppNotificationPayload,
): Promise<number> {
  const others = recipients.filter((id) => id !== actor.userId);
  return createInAppNotifications(others, payload);
}

async function archive(
  kind: CompetitionKind,
  id: string,
  actor: LifecycleActor,
): Promise<ArchiveCompetitionResult> {
  const head = await loadManageable(kind, id, actor);
  const archivedStatus =
    kind === "league" ? LEAGUE_ARCHIVED_STATUS : CUP_ARCHIVED_STATUS;
  if (head.status === archivedStatus) {
    return {
      id,
      kind,
      status: archivedStatus,
      previousStatus: head.status,
      changed: false,
      notified: 0,
    };
  }

  if (kind === "league") {
    await prisma.league.update({
      where: { id },
      data: { status: archivedStatus },
    });
  } else {
    await prisma.cup.update({ where: { id }, data: { status: archivedStatus } });
  }

  const recipients =
    kind === "league"
      ? await listLeagueParticipantUserIds(id)
      : await listCupParticipantUserIds(id);
  const noun = LABELS[kind].noun;
  const notified = await notifyParticipants(recipients, actor, {
    kind: kind === "league" ? "league.archived" : "cup.archived",
    title: kind === "league" ? "Ligue archivée" : "Coupe archivée",
    body: `La ${noun} « ${head.name} » a été archivée ${actorLabel(head, actor)}. Elle reste consultable en lecture seule.`,
    url: kind === "league" ? `/leagues/${id}` : `/cups/${id}`,
    meta: kind === "league" ? { leagueId: id } : { cupId: id },
  });

  serverLog.info(
    `[competition-lifecycle] ${kind} archived: id=${id} (was ${head.status}) by user=${actor.userId}${actor.isAdmin ? " (admin)" : ""} — ${notified} coach(s) notifie(s)`,
  );
  return {
    id,
    kind,
    status: archivedStatus,
    previousStatus: head.status,
    changed: true,
    notified,
  };
}

async function remove(
  kind: CompetitionKind,
  id: string,
  actor: LifecycleActor,
): Promise<DeleteCompetitionResult> {
  const head = await loadManageable(kind, id, actor);
  // Résolus AVANT l'effacement : la cascade emporte les inscriptions.
  const recipients =
    kind === "league"
      ? await listLeagueParticipantUserIds(id)
      : await listCupParticipantUserIds(id);

  if (kind === "league") {
    await prisma.league.delete({ where: { id } });
  } else {
    await prisma.cup.delete({ where: { id } });
  }

  const noun = LABELS[kind].noun;
  const notified = await notifyParticipants(recipients, actor, {
    kind: kind === "league" ? "league.deleted" : "cup.deleted",
    title: kind === "league" ? "Ligue supprimée" : "Coupe supprimée",
    body: `La ${noun} « ${head.name} » a été supprimée ${actorLabel(head, actor)}.`,
    // Plus de cible : la compétition n'existe plus.
    url: null,
    meta: { name: head.name },
  });

  serverLog.info(
    `[competition-lifecycle] ${kind} deleted: id=${id} name="${head.name}" (was ${head.status}) by user=${actor.userId}${actor.isAdmin ? " (admin)" : ""} — ${notified} coach(s) notifie(s)`,
  );
  return { id, kind, name: head.name, notified };
}

export function archiveLeague(
  leagueId: string,
  actor: LifecycleActor,
): Promise<ArchiveCompetitionResult> {
  return archive("league", leagueId, actor);
}

export function deleteLeague(
  leagueId: string,
  actor: LifecycleActor,
): Promise<DeleteCompetitionResult> {
  return remove("league", leagueId, actor);
}

export function archiveCup(
  cupId: string,
  actor: LifecycleActor,
): Promise<ArchiveCompetitionResult> {
  return archive("cup", cupId, actor);
}

export function deleteCup(
  cupId: string,
  actor: LifecycleActor,
): Promise<DeleteCompetitionResult> {
  return remove("cup", cupId, actor);
}
