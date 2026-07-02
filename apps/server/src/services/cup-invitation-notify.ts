/**
 * Notification du coach invité dans une coupe (miroir de
 * `league-invitation-notify.ts`). Effet secondaire non bloquant : ne throw
 * JAMAIS (pattern « Hook post-settlement encapsulé »).
 *
 * Ciblage :
 *   1. `inviteeUserId` → push + e-mail (si adresse connue).
 *   2. `inviteeEmail` seul → e-mail.
 *   3. Aucun (lien public par `code`) → aucune notification.
 */

import { prisma } from "../prisma";
import { sendPushToUser, type PushPayload } from "./push-notifications";
import { sendEmail } from "./mailer";
import { serverLog } from "../utils/server-log";

export interface CupInvitationNotifyTarget {
  readonly inviteeUserId?: string | null;
  readonly inviteeEmail?: string | null;
  readonly code?: string | null;
}

export interface NotifyInvitedCoachParams {
  readonly invitation: CupInvitationNotifyTarget;
  readonly cupName: string;
  readonly baseUrl?: string | null;
}

const NOTIFY_TITLE = "Invitation à une coupe";

function buildBody(cupName: string): string {
  return `Tu es invité à rejoindre la coupe « ${cupName} »`;
}

/** Lien public d'acceptation `${baseUrl}/cups/invitations/${code}`. */
export function buildJoinUrl(
  baseUrl?: string | null,
  code?: string | null,
): string | null {
  if (!baseUrl || !code) return null;
  return `${baseUrl.replace(/\/+$/, "")}/cups/invitations/${code}`;
}

function buildEmailText(
  cupName: string,
  code?: string | null,
  baseUrl?: string | null,
): string {
  const base = buildBody(cupName);
  const url = buildJoinUrl(baseUrl, code);
  if (url) {
    return (
      `${base}.\n\n` +
      `Pour rejoindre la coupe, clique sur ce lien :\n${url}\n\n` +
      `Si tu n'es pas encore connecté, tu pourras te connecter puis rejoindre.\n\n` +
      `(Code d'invitation à saisir manuellement : ${code})`
    );
  }
  if (code) return `${base}.\n\nCode d'invitation : ${code}`;
  return `${base}.`;
}

async function notifyByUserId(
  userId: string,
  cupName: string,
  code?: string | null,
  baseUrl?: string | null,
): Promise<void> {
  const payload: PushPayload = {
    title: NOTIFY_TITLE,
    body: buildBody(cupName),
    icon: "/images/favicon-optimized.png",
    url: "/cups",
    tag: `cup-invitation-${userId}`,
    data: { kind: "cupInvitation", url: "/cups" },
  };
  try {
    await sendPushToUser(userId, payload);
  } catch (e: unknown) {
    serverLog.error(`[cup-invitation-notify] push failed for user ${userId}`, e);
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: NOTIFY_TITLE,
        text: buildEmailText(cupName, code, baseUrl),
      });
    }
  } catch (e: unknown) {
    serverLog.error(`[cup-invitation-notify] email failed for user ${userId}`, e);
  }
}

async function notifyByEmail(
  email: string,
  cupName: string,
  code?: string | null,
  baseUrl?: string | null,
): Promise<void> {
  try {
    await sendEmail({
      to: email,
      subject: NOTIFY_TITLE,
      text: buildEmailText(cupName, code, baseUrl),
    });
  } catch (e: unknown) {
    serverLog.error(`[cup-invitation-notify] email failed for address ${email}`, e);
  }
}

/** Notifie le coach invité. Ne throw jamais. */
export async function notifyInvitedCoach(
  params: NotifyInvitedCoachParams,
): Promise<void> {
  const { invitation, cupName, baseUrl } = params;
  try {
    if (invitation.inviteeUserId) {
      await notifyByUserId(invitation.inviteeUserId, cupName, invitation.code, baseUrl);
      return;
    }
    if (invitation.inviteeEmail) {
      await notifyByEmail(invitation.inviteeEmail, cupName, invitation.code, baseUrl);
      return;
    }
  } catch (e: unknown) {
    serverLog.error("[cup-invitation-notify] unexpected failure", e);
  }
}
