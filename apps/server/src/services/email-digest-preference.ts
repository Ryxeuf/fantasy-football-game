/**
 * Réengagement — Phase B : lecture/écriture du consentement digest
 * e-mail + désinscription par token signé.
 *
 * RGPD : opt-in explicite (défaut false). La désinscription via token
 * ne requiert pas de login.
 */

import { prisma } from "../prisma";
import {
  verifyUnsubscribeToken,
  getUnsubscribeSecret,
} from "./email-unsubscribe-token";

export interface EmailDigestPreferenceView {
  readonly enabled: boolean;
}

export async function getEmailDigestPreference(
  userId: string,
): Promise<EmailDigestPreferenceView> {
  const row = await prisma.emailDigestPreference.findUnique({
    where: { userId },
    select: { enabled: true },
  });
  return { enabled: row?.enabled ?? false };
}

export async function setEmailDigestPreference(
  userId: string,
  enabled: boolean,
): Promise<EmailDigestPreferenceView> {
  const row = await prisma.emailDigestPreference.upsert({
    where: { userId },
    create: {
      userId,
      enabled,
      unsubscribedAt: enabled ? null : new Date(),
    },
    update: {
      enabled,
      // Trace la dernière désinscription sans effacer l'historique.
      unsubscribedAt: enabled ? null : new Date(),
    },
    select: { enabled: true },
  });
  return { enabled: row.enabled };
}

/**
 * Désinscription en un clic via token signé. Retourne `true` si le
 * token est valide (et la préférence mise à jour), `false` sinon.
 * Idempotent : désinscrire un user déjà désinscrit renvoie `true`.
 */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  const userId = verifyUnsubscribeToken(token, getUnsubscribeSecret());
  if (!userId) return false;

  await prisma.emailDigestPreference.upsert({
    where: { userId },
    create: { userId, enabled: false, unsubscribedAt: new Date() },
    update: { enabled: false, unsubscribedAt: new Date() },
    select: { enabled: true },
  });
  return true;
}
