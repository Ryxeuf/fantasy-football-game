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
  /**
   * DSN unique façon Symfony Mailer : `smtp://user:pass@host:port?secure=...`.
   * Prioritaire sur les variables `SMTP_*` quand renseigné. `smtps://` ou le
   * port 465 ⇒ TLS implicite. user/pass doivent être percent-encodés
   * (ex: `%40` pour `@`).
   */
  readonly MAILER_DSN?: string;
  readonly SMTP_HOST?: string;
  readonly SMTP_PORT?: string;
  readonly SMTP_USER?: string;
  readonly SMTP_PASSWORD?: string;
  /** "true" force le mode TLS implicite (sinon déduit de port === 465). */
  readonly SMTP_SECURE?: string;
  /** Expéditeur par défaut injecté sur chaque message. */
  readonly MAIL_FROM?: string;
}

/** Config SMTP normalisée, indépendante de la source (DSN ou SMTP_*). */
interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user?: string;
  readonly pass?: string;
}

/** Expéditeur par défaut si `MAIL_FROM` n'est pas renseigné. */
export const DEFAULT_MAIL_FROM = "Nuffle Arena <no-reply@nufflearena.fr>";

/** Port SMTP par défaut (submission STARTTLS) si `SMTP_PORT` est absent. */
const DEFAULT_SMTP_PORT = 587;

/**
 * Parse un DSN Symfony-style `smtp://user:pass@host:port?secure=true`.
 * `smtps://` ou le port 465 ⇒ TLS implicite. user/pass sont percent-décodés.
 * Retourne `null` si le DSN est invalide ou d'un schéma non supporté.
 */
export function parseMailerDsn(dsn: string): SmtpConfig | null {
  let url: URL;
  try {
    url = new URL(dsn);
  } catch {
    return null;
  }
  const scheme = url.protocol.replace(/:$/, "").toLowerCase();
  if (scheme !== "smtp" && scheme !== "smtps") return null;
  const host = url.hostname;
  if (!host) return null;

  const port = url.port
    ? Number(url.port)
    : scheme === "smtps"
      ? 465
      : DEFAULT_SMTP_PORT;
  const secure =
    scheme === "smtps" ||
    port === 465 ||
    url.searchParams.get("secure") === "true";

  return {
    host,
    port,
    secure,
    user: url.username ? decodeURIComponent(url.username) : undefined,
    pass: url.password ? decodeURIComponent(url.password) : undefined,
  };
}

/** Config SMTP issue des variables `SMTP_*`. Null si `SMTP_HOST` absent. */
function smtpConfigFromVars(env: SmtpEnv): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(env.SMTP_PORT) || DEFAULT_SMTP_PORT;
  // TLS implicite sur 465 ; STARTTLS (secure=false) sinon. Mailpit (1025)
  // ne fait pas de TLS → secure=false.
  const secure = env.SMTP_SECURE === "true" || port === 465;
  return {
    host,
    port,
    secure,
    user: env.SMTP_USER?.trim() || undefined,
    pass: env.SMTP_PASSWORD,
  };
}

/**
 * Construit un `MailTransport` nodemailer à partir de l'environnement.
 * Priorité à `MAILER_DSN` ; sinon variables `SMTP_*`. Retourne `null` quand
 * aucune source n'est configurée (= mailer reste en log only).
 */
export function buildMailTransportFromEnv(env: SmtpEnv): MailTransport | null {
  const dsn = env.MAILER_DSN?.trim();
  const cfg = (dsn ? parseMailerDsn(dsn) : null) ?? smtpConfigFromVars(env);
  if (!cfg) return null;

  const from = env.MAIL_FROM?.trim() || DEFAULT_MAIL_FROM;

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    // Auth optionnelle : Mailpit accepte les messages sans authentification.
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
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
      "[mail] aucun transport configuré (ni MAILER_DSN ni SMTP_HOST) — les " +
        "e-mails seront seulement loggés. Renseigner MAILER_DSN " +
        "(smtp://user:pass@host:port) ou SMTP_HOST/SMTP_PORT pour activer l'envoi.",
    );
    return;
  }
  setMailTransport(transport);
  // On ne logge JAMAIS le DSN (il contient le mot de passe) : juste la source.
  const source = env.MAILER_DSN?.trim()
    ? "MAILER_DSN"
    : `${env.SMTP_HOST?.trim()}:${Number(env.SMTP_PORT) || DEFAULT_SMTP_PORT}`;
  serverLog.log(`[mail] transport SMTP branché (${source}).`);
}
