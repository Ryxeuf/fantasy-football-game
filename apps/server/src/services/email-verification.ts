/**
 * Sprint O — Lot O.B.2 : email verification (light).
 *
 * Service pur encapsulant la generation + consommation des tokens de
 * verification email. Modele identique a `password-reset.ts` :
 *   - token plain genere cote serveur, envoye dans l'email (clear),
 *   - hash SHA-256 hex stocke en base (le plain n'est jamais persiste),
 *   - single-use via `usedAt`, expiration absolue via `expiresAt` (24h).
 *
 * UX
 * --
 * Pas bloquant pour la connexion. L'utilisateur recoit le mail au signup
 * (best-effort) et une banniere s'affiche sur `/me` tant que
 * `User.emailVerifiedAt` est null. Endpoint `/auth/resend-verification`
 * (auth) permet de re-emettre un token.
 *
 * Email transport
 * ---------------
 * Pas de SMTP/SendGrid au MVP : le lien est logue serveur-side via
 * `serverLog.info('[email-verify] link=...')` + audit log. Un admin peut
 * recuperer le lien depuis les logs. Brancher un transport via
 * `sendEmailVerificationEmail()` callback est trivial en v2.
 */

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export class EmailVerificationError extends Error {
  constructor(
    public readonly code:
      | "INVALID_TOKEN"
      | "TOKEN_EXPIRED"
      | "TOKEN_USED"
      | "USER_DELETED"
      | "ALREADY_VERIFIED",
    message: string,
  ) {
    super(message);
    this.name = "EmailVerificationError";
  }
}

export interface RequestEmailVerificationInput {
  readonly userId: string;
  readonly requestIp?: string;
  /** Origin URL (ex: "https://nufflearena.fr") pour batir le link. */
  readonly origin: string;
}

export interface RequestEmailVerificationResult {
  readonly requested: true;
  /**
   * Lien complet `${origin}/verify-email?token=...`. Set uniquement en
   * environnement non-production (NODE_ENV !== "production") pour les
   * tests. En prod, ce champ est toujours `null` — le link est uniquement
   * logue serveur-side.
   */
  readonly devLink: string | null;
  /**
   * `true` si l'email du user est deja verifie : aucun token n'a ete
   * cree, le caller peut afficher un message "deja verifie".
   */
  readonly alreadyVerified: boolean;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateTokenPlain(): string {
  // base64url sans padding pour eviter les chars URL-unsafe.
  return randomBytes(TOKEN_BYTES)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Genere un token de verification pour l'user donne. Retourne
 * `alreadyVerified: true` si l'email est deja verifie (aucun token
 * cree). Anti-enumeration : `requestEmailVerification` n'est exposable
 * que via une route authentifiee (l'identifiant user vient du JWT, pas
 * d'un body) — pas de risque d'enumeration email.
 *
 * Idempotent : appeler plusieurs fois cree plusieurs tokens (le dernier
 * reste valide ; les precedents le restent aussi jusqu'a expiration).
 * Pas de throttle au MVP — le caller (route) limite le rythme via
 * rate-limit middleware si necessaire.
 */
export async function requestEmailVerification(
  input: RequestEmailVerificationInput,
): Promise<RequestEmailVerificationResult> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      deletedAt: true,
      emailVerifiedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    throw new EmailVerificationError(
      "USER_DELETED",
      "Compte introuvable ou supprime.",
    );
  }
  if (user.emailVerifiedAt !== null) {
    return { requested: true, devLink: null, alreadyVerified: true };
  }

  const tokenPlain = generateTokenPlain();
  const tokenHash = hashToken(tokenPlain);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const persisted = await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      requestIp: input.requestIp ?? null,
    },
    select: { id: true },
  });

  const link = `${input.origin}/verify-email?token=${tokenPlain}`;
  serverLog.info("[email-verify] link generated", {
    event: "auth.email_verification.requested",
    userId: user.id,
    tokenId: persisted.id,
    email: user.email,
    expiresAt: expiresAt.toISOString(),
    // Le link contient le token plain — visible UNIQUEMENT cote logs
    // serveur. Ne pas le retourner via response API en prod.
    link,
  });

  const isProd = process.env.NODE_ENV === "production";
  return {
    requested: true,
    devLink: isProd ? null : link,
    alreadyVerified: false,
  };
}

export interface ConsumeEmailVerificationTokenInput {
  readonly token: string;
}

export interface ConsumeEmailVerificationTokenResult {
  readonly userId: string;
  readonly email: string;
  readonly verifiedAt: Date;
}

/**
 * Valide le token (existe, non-expire, non-used, user non-deleted) et
 * marque l'email du user comme verifie (`emailVerifiedAt = now`). Throw
 * `EmailVerificationError` si invalide. Audit log a l'appelant.
 *
 * Idempotent au sens "verification deja faite" : si `emailVerifiedAt`
 * etait deja set, on remet `usedAt` sur le token (pour cleanup) mais on
 * retourne le verifiedAt existant — pas d'erreur.
 */
export async function consumeEmailVerificationToken(
  input: ConsumeEmailVerificationTokenInput,
): Promise<ConsumeEmailVerificationTokenResult> {
  const tokenHash = hashToken(input.token);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          deletedAt: true,
          emailVerifiedAt: true,
        },
      },
    },
  });
  if (!record || record.user.deletedAt) {
    throw new EmailVerificationError(
      "INVALID_TOKEN",
      "Lien de verification invalide.",
    );
  }
  if (record.usedAt) {
    // Si l'email est deja verifie, on tolere : le user a clique 2x sur
    // le meme lien, c'est OK. Sinon (used mais pas verified — incoherent),
    // on rejette.
    if (record.user.emailVerifiedAt !== null) {
      return {
        userId: record.userId,
        email: record.user.email,
        verifiedAt: record.user.emailVerifiedAt,
      };
    }
    throw new EmailVerificationError(
      "TOKEN_USED",
      "Ce lien a deja ete utilise.",
    );
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    throw new EmailVerificationError(
      "TOKEN_EXPIRED",
      "Ce lien de verification a expire.",
    );
  }

  const now = new Date();
  // Si l'email est deja verifie (cas d'un 2eme token consomme apres
  // verification reussie avec un autre token), on retourne le timestamp
  // existant pour rester idempotent.
  const verifiedAt = record.user.emailVerifiedAt ?? now;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: verifiedAt },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    }),
  ]);

  serverLog.info("[email-verify] completed", {
    event: "auth.email_verification.completed",
    userId: record.userId,
    tokenId: record.id,
  });

  return {
    userId: record.userId,
    email: record.user.email,
    verifiedAt,
  };
}
