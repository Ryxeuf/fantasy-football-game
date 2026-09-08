/**
 * Date prévisionnelle d'une rencontre de ligue.
 *
 * Les deux coachs d'un appariement (ou le commissaire) s'entendent sur
 * une date de match : elle est portée par `LeaguePairing.scheduledAt` et
 * fait passer la rencontre de « À jouer » à « Prévu le … » dans le
 * calendrier. Le commissaire garde par ailleurs `PATCH /pairings/:id`
 * (édition manuelle, deadline, déplacement de journée).
 *
 * Garde-fous :
 *   - seuls les propriétaires des deux équipes et le créateur de la ligue
 *     peuvent poser ou retirer la date (`forbidden`) ;
 *   - une rencontre jouée, forfaitée ou annulée n'a plus de date à
 *     prévoir (`pairing_closed`).
 *
 * Effet secondaire non bloquant : les autres coachs impliqués reçoivent
 * une notification interne (`league.pairing_scheduled`).
 */

import { prisma } from "../prisma";
import { createInAppNotification } from "./in-app-notifications";

export type LeaguePairingScheduleErrorCode =
  | "pairing_not_found"
  | "forbidden"
  | "pairing_closed";

export class LeaguePairingScheduleError extends Error {
  constructor(
    public readonly code: LeaguePairingScheduleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LeaguePairingScheduleError";
  }
}

export type PairingScheduleActorRole = "commissioner" | "home" | "away";

export interface SchedulePairingInput {
  readonly pairingId: string;
  readonly userId: string;
  /** `null` efface la date prévisionnelle. */
  readonly scheduledAt: Date | null;
}

export interface SchedulePairingResult {
  readonly pairingId: string;
  readonly scheduledAt: Date | null;
  readonly actorRole: PairingScheduleActorRole;
  /** Nombre de coachs notifiés (hors auteur). */
  readonly notified: number;
}

/** Statuts pour lesquels une date reste à prévoir. */
const OPEN_STATUSES: ReadonlySet<string> = new Set(["scheduled", "in_progress"]);

interface PairingSide {
  team: {
    ownerId: string;
    name: string;
    owner: { coachName: string | null } | null;
  };
}

interface PairingRow {
  id: string;
  status: string;
  scheduledAt: Date | null;
  round: {
    roundNumber: number;
    season: { id: string; league: { id: string; creatorId: string } };
  };
  homeParticipant: PairingSide;
  awayParticipant: PairingSide;
}

/**
 * Rôle de l'acteur sur la rencontre, ou `null` s'il n'y est pour rien.
 * Pur : sert aussi à l'UI (qui voit le bouton « Planifier »).
 */
export function pairingScheduleRole(input: {
  userId: string;
  creatorId: string;
  homeOwnerId: string;
  awayOwnerId: string;
}): PairingScheduleActorRole | null {
  if (input.userId === input.creatorId) return "commissioner";
  if (input.userId === input.homeOwnerId) return "home";
  if (input.userId === input.awayOwnerId) return "away";
  return null;
}

function formatDateFr(date: Date): string {
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export async function schedulePairing(
  input: SchedulePairingInput,
): Promise<SchedulePairingResult> {
  const pairing = (await prisma.leaguePairing.findUnique({
    where: { id: input.pairingId },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      round: {
        select: {
          roundNumber: true,
          season: {
            select: {
              id: true,
              league: { select: { id: true, creatorId: true } },
            },
          },
        },
      },
      homeParticipant: {
        select: {
          team: {
            select: {
              ownerId: true,
              name: true,
              owner: { select: { coachName: true } },
            },
          },
        },
      },
      awayParticipant: {
        select: {
          team: {
            select: {
              ownerId: true,
              name: true,
              owner: { select: { coachName: true } },
            },
          },
        },
      },
    },
  })) as PairingRow | null;

  if (!pairing) {
    throw new LeaguePairingScheduleError(
      "pairing_not_found",
      `Rencontre introuvable: ${input.pairingId}`,
    );
  }

  const home = pairing.homeParticipant.team;
  const away = pairing.awayParticipant.team;
  const role = pairingScheduleRole({
    userId: input.userId,
    creatorId: pairing.round.season.league.creatorId,
    homeOwnerId: home.ownerId,
    awayOwnerId: away.ownerId,
  });
  if (!role) {
    throw new LeaguePairingScheduleError(
      "forbidden",
      "Seuls les deux coachs de la rencontre et le commissaire peuvent la planifier",
    );
  }
  if (!OPEN_STATUSES.has(pairing.status)) {
    throw new LeaguePairingScheduleError(
      "pairing_closed",
      `Rencontre ${pairing.status === "cancelled" ? "annulée" : "déjà jouée"} : plus de date à prévoir`,
    );
  }

  await prisma.leaguePairing.update({
    where: { id: pairing.id },
    data: { scheduledAt: input.scheduledAt },
    select: { id: true },
  });

  // Notification des AUTRES coachs impliqués (jamais bloquante).
  const actorLabel =
    role === "home"
      ? home.owner?.coachName ?? home.name
      : role === "away"
        ? away.owner?.coachName ?? away.name
        : "Le commissaire";
  const recipients = Array.from(
    new Set(
      [home.ownerId, away.ownerId].filter(
        (id) => !!id && id !== input.userId,
      ),
    ),
  );
  const leagueId = pairing.round.season.league.id;
  const matchLabel = `${home.name} vs ${away.name} (J${pairing.round.roundNumber})`;
  const body = input.scheduledAt
    ? `${actorLabel} propose de jouer ${matchLabel} le ${formatDateFr(input.scheduledAt)}`
    : `${actorLabel} a retiré la date prévue pour ${matchLabel}`;
  let notified = 0;
  for (const userId of recipients) {
    const created = await createInAppNotification({
      userId,
      kind: "league.pairing_scheduled",
      title: input.scheduledAt ? "Rencontre planifiée" : "Date de rencontre retirée",
      body,
      url: `/leagues/${leagueId}`,
      meta: {
        leagueId,
        seasonId: pairing.round.season.id,
        pairingId: pairing.id,
        scheduledAt: input.scheduledAt?.toISOString() ?? null,
      },
    });
    if (created) notified += 1;
  }

  return {
    pairingId: pairing.id,
    scheduledAt: input.scheduledAt,
    actorRole: role,
    notified,
  };
}
