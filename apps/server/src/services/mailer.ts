/**
 * Réengagement — Phase B : transport e-mail minimal avec dégradation
 * propre.
 *
 * Contexte : au MVP il n'existe PAS de transport SMTP/SendGrid dans le
 * repo — le flux password-reset se contente de logger le lien
 * serveur-side (cf. `password-reset.ts`). On suit le même principe : si
 * aucun transport n'est configuré (variables d'env absentes), on logge
 * l'e-mail serveur-side et on retourne `{ delivered: false }` sans
 * jamais throw. Le job de digest reste donc fonctionnel en dev/CI et
 * l'envoi réel se branche en prod via `setMailTransport` (ex: un
 * wrapper nodemailer/Resend) sans toucher au code appelant.
 *
 * Sécurité : aucune clé/API n'est hardcodée — un vrai transport lit ses
 * secrets depuis l'environnement au moment de son installation.
 */

import { serverLog } from "../utils/server-log";

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  /** Corps texte brut (fallback clients sans HTML). */
  readonly text: string;
  /** Corps HTML (optionnel). */
  readonly html?: string;
}

export interface MailDeliveryResult {
  /** true si un transport a effectivement accepté l'e-mail. */
  readonly delivered: boolean;
  /** Raison quand non délivré (ex: "no-transport", "error"). */
  readonly reason?: string;
}

export type MailTransport = (msg: EmailMessage) => Promise<void>;

let transport: MailTransport | null = null;

/**
 * Installe un transport réel (prod). Typiquement appelé au boot quand
 * les variables SMTP/API sont présentes. Idempotent (remplace).
 */
export function setMailTransport(impl: MailTransport | null): void {
  transport = impl;
}

/** true si un transport réel est branché. */
export function hasMailTransport(): boolean {
  return transport !== null;
}

/**
 * Envoie un e-mail. Ne throw jamais : en l'absence de transport, logge
 * le message serveur-side et retourne `{ delivered: false }`.
 */
export async function sendEmail(
  msg: EmailMessage,
): Promise<MailDeliveryResult> {
  if (!transport) {
    serverLog.info(
      `[mailer] aucun transport configuré — e-mail non envoyé (to=${msg.to}, subject="${msg.subject}"). ` +
        "Configurer un transport via setMailTransport en prod.",
    );
    return { delivered: false, reason: "no-transport" };
  }
  try {
    await transport(msg);
    return { delivered: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown";
    serverLog.error(`[mailer] échec d'envoi (to=${msg.to}): ${message}`);
    return { delivered: false, reason: "error" };
  }
}
