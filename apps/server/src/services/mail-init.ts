/**
 * Branchement du transport e-mail réel (nodemailer SMTP) sur le `mailer`.
 *
 * Le `mailer` (cf. `mailer.ts`) est volontairement agnostique du transport :
 * il expose `setMailTransport(impl)` et dégrade proprement (log only) tant
 * qu'aucun transport n'est branché. Ce module lit la configuration SMTP
 * depuis l'environnement et installe un transport nodemailer.
 *
 * Unifié dev / prod :
 *   - **Dev** : Mailpit (SMTP local sans auth, cf. `docker-compose.yml`).
 *     `SMTP_HOST=mailpit`, `SMTP_PORT=1025`. L'UI web liste les messages
 *     captés (http://localhost:8025).
 *   - **Prod** : n'importe quel SMTP (fournisseur transactionnel ou relai).
 *     Renseigner `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`.
 *
 * Dégradation propre : si `SMTP_HOST` est absent, AUCUN transport n'est
 * branché — le mailer continue de logger les e-mails sans les envoyer.
 * Le boot n'échoue jamais à cause du mail.
 *
 * Sécurité : aucun secret n'est hardcodé. `SMTP_USER`/`SMTP_PASSWORD` sont
 * lus depuis l'environnement au moment de l'init.
 */

import nodemailer from "nodemailer";
import {
  setMailTransport,
  type EmailMessage,
  type MailTransport,
} from "./mailer";
import { serverLog } from "../utils/server-log";

/**
 * Sous-ensemble des variables d'environnement consommées. Typé pour rendre
 * `buildMailTransportFromEnv` testable sans toucher au vrai `process.env`.
 */
export interface SmtpEnv {
  readonly SMTP_HOST?: string;
  readonly SMTP_PORT?: string;
  readonly SMTP_USER?: string;
  readonly SMTP_PASSWORD?: string;
  /** "true" force le mode TLS implicite (sinon déduit de port === 465). */
  readonly SMTP_SECURE?: string;
  /** Expéditeur par défaut injecté sur chaque message. */
  readonly MAIL_FROM?: string;
}

/** Expéditeur par défaut si `MAIL_FROM` n'est pas renseigné. */
export const DEFAULT_MAIL_FROM = "Nuffle Arena <no-reply@nufflearena.fr>";

/** Port SMTP par défaut (submission STARTTLS) si `SMTP_PORT` est absent. */
const DEFAULT_SMTP_PORT = 587;

/**
 * Construit un `MailTransport` nodemailer à partir de l'environnement.
 * Retourne `null` quand `SMTP_HOST` est absent (= mailer reste en log only).
 */
export function buildMailTransportFromEnv(env: SmtpEnv): MailTransport | null {
  const host = env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = Number(env.SMTP_PORT) || DEFAULT_SMTP_PORT;
  // TLS implicite sur 465 ; STARTTLS (secure=false) sinon. Mailpit (1025)
  // ne fait pas de TLS → secure=false.
  const secure = env.SMTP_SECURE === "true" || port === 465;
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASSWORD;
  const from = env.MAIL_FROM?.trim() || DEFAULT_MAIL_FROM;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    // Auth optionnelle : Mailpit accepte les messages sans authentification.
    auth: user ? { user, pass } : undefined,
  });

  return async (msg: EmailMessage): Promise<void> => {
    await transporter.sendMail({
      from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
  };
}

/**
 * Lit la config SMTP de l'environnement et branche le transport sur le
 * mailer. Idempotent. À appeler une fois au boot (hors tests).
 */
export function initMailTransportFromEnv(
  env: SmtpEnv = process.env as unknown as SmtpEnv,
): void {
  const transport = buildMailTransportFromEnv(env);
  if (!transport) {
    serverLog.info(
      "[mail] SMTP_HOST absent — transport e-mail non branché (les e-mails " +
        "seront seulement loggés). Renseigner SMTP_HOST/SMTP_PORT pour activer " +
        "l'envoi.",
    );
    return;
  }
  setMailTransport(transport);
  const port = Number(env.SMTP_PORT) || DEFAULT_SMTP_PORT;
  serverLog.log(
    `[mail] transport SMTP branché (${env.SMTP_HOST?.trim()}:${port}).`,
  );
}
