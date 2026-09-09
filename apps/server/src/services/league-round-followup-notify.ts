/**
 * Envoi des relances d'une journée de ligue (bouton « Relancer »).
 *
 * Partie I/O de `league-round-followup` : charge la journée, applique les
 * règles pures pour savoir qui relancer et pourquoi, puis écrit aux DEUX
 * coachs de chaque rencontre retenue.
 *
 * Trois canaux, dans le même ordre que le reste de l'application :
 *  1. notification interne (`league.round_followup`) — le seul canal garanti,
 *     indépendant des préférences push et d'une adresse e-mail valide ;
 *  2. push (best-effort) ;
 *  3. e-mail — c'est ce que le commissaire demande explicitement.
 *
 * Aucun de ces envois ne peut faire échouer la relance : un transport en
 * panne ne doit pas empêcher les autres coachs d'être prévenus. Le compte
 * rendu (`ReminderRunResult`) dit ce qui est parti, pour que la console du
 * commissaire ne mente pas — c'est aussi ce qui permet de rejouer la
 * relance sans se demander si elle a servi.
 *
 * IDEMPOTENCE : la relance est déclenchée à la main et peut être rejouée
 * (une journée qui traîne se relance plusieurs fois). Rien n'est donc
 * persisté au-delà des notifications elles-mêmes.
 */

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import { createInAppNotifications } from "./in-app-notifications";
import { sendEmail } from "./mailer";
import { sendPushToUser } from "./push-notifications";
import {
  buildReminderEmailText,
  buildReminderSubject,
  REMINDER_BODIES,
  REMINDER_SUBJECTS,
  selectReminderTargets,
  type ReminderReason,
} from "./league-round-followup";

export type LeagueRoundFollowupErrorCode = "round_not_found" | "forbidden";

export class LeagueRoundFollowupError extends Error {
  constructor(
    public readonly code: LeagueRoundFollowupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LeagueRoundFollowupError";
  }
}

export interface SendRoundFollowupsInput {
  readonly roundId: string;
  /** Auteur de la relance (doit être le commissaire de la ligue). */
  readonly userId: string;
  /** Origine web absolue, pour le lien de l'e-mail. */
  readonly baseUrl?: string | null;
  /** Injection de temps (tests) ; par défaut l'instant courant. */
  readonly now?: Date;
}

/** Une relance effectivement envoyée, telle que rendue au commissaire. */
export interface SentReminder {
  readonly pairingId: string;
  readonly reason: ReminderReason;
  readonly matchLabel: string;
  /** Coachs destinataires (nom d'affichage), dédoublonnés. */
  readonly coaches: string[];
  /** Nombre d'e-mails effectivement acceptés par le transport. */
  readonly emailsDelivered: number;
}

export interface ReminderRunResult {
  readonly roundId: string;
  readonly roundNumber: number;
  readonly leagueId: string;
  /** Rencontres relancées, dans l'ordre de la journée. */
  readonly reminders: SentReminder[];
  /** Coachs distincts prévenus, tous motifs confondus. */
  readonly coachesNotified: number;
  /** Rencontres passées en revue (y compris celles qui vont bien). */
  readonly pairingsChecked: number;
}

interface SideRow {
  team: {
    ownerId: string;
    name: string;
    owner: { coachName: string | null; email: string | null } | null;
  };
}

interface PairingRow {
  id: string;
  status: string;
  scheduledAt: Date | null;
  matchSheet: { status: string } | null;
  homeParticipant: SideRow;
  awayParticipant: SideRow;
}

const SIDE_SELECT = {
  team: {
    select: {
      ownerId: true,
      name: true,
      owner: { select: { coachName: true, email: true } },
    },
  },
} as const;

/** « Coach Bob » si connu, sinon le nom de l'équipe. */
function coachLabel(side: SideRow): string {
  return side.team.owner?.coachName ?? side.team.name;
}

/**
 * Relance une journée. Réservé au commissaire de la ligue — c'est lui qui
 * porte la discipline du calendrier, et c'est en son nom que le message part.
 */
export async function sendRoundFollowups(
  input: SendRoundFollowupsInput,
): Promise<ReminderRunResult> {
  const round = await prisma.leagueRound.findUnique({
    where: { id: input.roundId },
    select: {
      id: true,
      roundNumber: true,
      season: {
        select: {
          league: { select: { id: true, name: true, creatorId: true } },
        },
      },
      pairings: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          scheduledAt: true,
          matchSheet: { select: { status: true } },
          homeParticipant: { select: SIDE_SELECT },
          awayParticipant: { select: SIDE_SELECT },
        },
      },
    },
  });

  if (!round) {
    throw new LeagueRoundFollowupError(
      "round_not_found",
      `Journée introuvable: ${input.roundId}`,
    );
  }

  const league = round.season.league;
  if (league.creatorId !== input.userId) {
    throw new LeagueRoundFollowupError(
      "forbidden",
      "Seul le commissaire de la ligue peut relancer une journée",
    );
  }

  const pairings = round.pairings as unknown as PairingRow[];
  const targets = selectReminderTargets(
    pairings.map((p) => ({
      ...p,
      matchSheetStatus: p.matchSheet?.status ?? null,
    })),
    input.now ?? new Date(),
  );

  const leagueUrl = input.baseUrl
    ? `${input.baseUrl.replace(/\/+$/, "")}/leagues/${league.id}#journee-${round.roundNumber}`
    : null;
  const inAppUrl = `/leagues/${league.id}#journee-${round.roundNumber}`;

  const reminders: SentReminder[] = [];
  const everyCoach = new Set<string>();

  for (const { pairing, reason } of targets) {
    const home = pairing.homeParticipant;
    const away = pairing.awayParticipant;
    const matchLabel = `${home.team.name} vs ${away.team.name}`;
    const context = {
      leagueName: league.name,
      roundNumber: round.roundNumber,
      matchLabel,
      leagueUrl,
    };
    const subject = buildReminderSubject(reason, context);
    const text = buildReminderEmailText(reason, context);

    // Le même coach peut posséder les deux équipes (ligue de test) : une
    // seule relance dans ce cas.
    const sides = [home, away].filter(
      (side, index, all) =>
        !!side.team.ownerId &&
        all.findIndex((s) => s.team.ownerId === side.team.ownerId) === index,
    );
    const userIds = sides.map((s) => s.team.ownerId);
    for (const id of userIds) everyCoach.add(id);

    // 1. Historique interne — jamais bloquant (ne throw pas).
    await createInAppNotifications(userIds, {
      kind: "league.round_followup",
      title: `${REMINDER_SUBJECTS[reason]} — J${round.roundNumber}`,
      body: REMINDER_BODIES[reason],
      url: inAppUrl,
      meta: {
        leagueId: league.id,
        roundId: round.id,
        pairingId: pairing.id,
        reason,
      },
    });

    // 2. Push — best-effort, un échec par coach n'arrête pas les suivants.
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          await sendPushToUser(userId, {
            title: `${REMINDER_SUBJECTS[reason]} — ${league.name}`,
            body: REMINDER_BODIES[reason],
            icon: "/images/favicon-optimized.png",
            url: inAppUrl,
            tag: `league-round-reminder-${round.id}-${pairing.id}`,
            data: { kind: "leagueRoundFollowup", url: inAppUrl },
          });
        } catch (e: unknown) {
          serverLog.error(
            `[league-round-followup] push failed for user ${userId}`,
            e,
          );
        }
      }),
    );

    // 3. E-mail — le canal explicitement demandé. Un coach sans adresse est
    //    simplement sauté : il a sa notification interne.
    let emailsDelivered = 0;
    await Promise.all(
      sides.map(async (side) => {
        const email = side.team.owner?.email;
        if (!email) return;
        try {
          const result = await sendEmail({ to: email, subject, text });
          if (result.delivered) emailsDelivered += 1;
        } catch (e: unknown) {
          serverLog.error(
            `[league-round-followup] email failed for ${side.team.ownerId}`,
            e,
          );
        }
      }),
    );

    reminders.push({
      pairingId: pairing.id,
      reason,
      matchLabel,
      coaches: sides.map(coachLabel),
      emailsDelivered,
    });
  }

  serverLog.info(
    `[league-round-followup] round=${round.id} (J${round.roundNumber}) — ` +
      `${reminders.length}/${pairings.length} rencontre(s) relancée(s), ` +
      `${everyCoach.size} coach(s) prévenu(s)`,
  );

  return {
    roundId: round.id,
    roundNumber: round.roundNumber,
    leagueId: league.id,
    reminders,
    coachesNotified: everyCoach.size,
    pairingsChecked: pairings.length,
  };
}
