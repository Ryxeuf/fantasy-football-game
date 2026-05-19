/**
 * Sprint P — Lot P.C.1 : password reset self-service.
 *
 * Service pur encapsulant la generation + consommation des tokens de
 * reset. Anti-enumeration : la fonction `requestPasswordReset` ne
 * revele JAMAIS si l'email existe — elle return juste un summary
 * `{requested: true, link?: string}` (link uniquement en dev pour
 * tests).
 *
 * Securite
 * --------
 * - `token` = 32 octets crypto random encode en base64url (256 bits).
 * - `tokenHash` = SHA-256 hex du token. Seul le hash est persiste.
 * - Single-use : `usedAt` set des le reset reussi.
 * - Expiration 24h.
 * - Au reset reussi : tous les refresh tokens du user sont revoqued
 *   (force re-login).
 * - Audit log : `auth.password_reset.requested` (avec tokenId pas le
 *   token plain) + `auth.password_reset.completed`.
 *
 * Email transport
 * ---------------
 * Pas de SMTP/SendGrid au MVP : le lien est logue serveur-side via
 * `serverLog.info('[password-reset] link=...')` + audit log. Un admin
 * peut recuperer le lien depuis Loki/Datadog. Brancher un transport
 * via `sendPasswordResetEmail()` callback est trivial en v2.
 */

import { createHash, randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { prisma } from "../prisma";
import { getRefreshTokenStore } from "./refresh-token-store-singleton";
import { serverLog } from "../utils/server-log";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

export class PasswordResetError extends Error {
  constructor(
    public readonly code:
      | "INVALID_TOKEN"
      | "TOKEN_EXPIRED"
      | "TOKEN_USED"
      | "WEAK_PASSWORD",
    message: string,
  ) {
    super(message);
    this.name = "PasswordResetError";
  }
}

export interface RequestPasswordResetInput {
  readonly email: string;
  readonly requestIp?: string;
  /** Origin URL (ex: "https://nufflearena.fr") pour batir le link. */
  readonly origin: string;
}

export interface RequestPasswordResetResult {
  /** Toujours true (anti-enumeration cote API). */
  readonly requested: true;
  /**
   * Lien complet `${origin}/reset-password?token=...`. Set uniquement
   * quand l'user existe ET en environnement non-production (NODE_ENV
   * !== "production") pour les tests. En prod, ce champ est toujours
   * `null` — le link est uniquement logue serveur-side.
   */
  readonly devLink: string | null;
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
 * Genere un token reset pour l'email donne si l'user existe et n'est
 * pas soft-deleted/banned. Retourne toujours `requested: true` pour
 * eviter l'enumeration cote API. Log + audit cote serveur.
 */
export async function requestPasswordReset(
  input: RequestPasswordResetInput,
): Promise<RequestPasswordResetResult> {
  const emailNormalized = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: emailNormalized },
    select: { id: true, email: true, deletedAt: true, bannedUntil: true },
  });

  if (!user || user.deletedAt) {
    // Anti-enumeration : on simule le delai d'un user existant en
    // restant silencieux (le caller a deja eu son 200 OK).
    return { requested: true, devLink: null };
  }
  if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
    // User banni : on retourne aussi 200 OK silencieux pour eviter de
    // signaler le ban via le canal forgot-password.
    return { requested: true, devLink: null };
  }

  const tokenPlain = generateTokenPlain();
  const tokenHash = hashToken(tokenPlain);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const persisted = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      requestIp: input.requestIp ?? null,
    },
    select: { id: true },
  });

  const link = `${input.origin}/reset-password?token=${tokenPlain}`;
  serverLog.info("[password-reset] link generated", {
    event: "auth.password_reset.requested",
    userId: user.id,
    tokenId: persisted.id,
    expiresAt: expiresAt.toISOString(),
    // Le link contient le token plain — visible UNIQUEMENT cote logs
    // serveur. Ne pas le retourner via response API en prod.
    link,
  });

  const isProd = process.env.NODE_ENV === "production";
  return {
    requested: true,
    devLink: isProd ? null : link,
  };
}

export interface ConsumeResetTokenInput {
  readonly token: string;
  readonly newPassword: string;
}

export interface ConsumeResetTokenResult {
  readonly userId: string;
  readonly email: string;
}

/**
 * Valide le token (existe, non-expire, non-used) et applique le nouveau
 * password. Revoque toutes les sessions actives. Throw `PasswordResetError`
 * si invalide. Audit log a l'appelant.
 */
export async function consumeResetToken(
  input: ConsumeResetTokenInput,
): Promise<ConsumeResetTokenResult> {
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordResetError(
      "WEAK_PASSWORD",
      `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caracteres.`,
    );
  }
  const tokenHash = hashToken(input.token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { id: true, email: true, deletedAt: true } },
    },
  });
  if (!record || record.user.deletedAt) {
    throw new PasswordResetError(
      "INVALID_TOKEN",
      "Lien de reinitialisation invalide.",
    );
  }
  if (record.usedAt) {
    throw new PasswordResetError(
      "TOKEN_USED",
      "Ce lien a deja ete utilise.",
    );
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    throw new PasswordResetError(
      "TOKEN_EXPIRED",
      "Ce lien de reinitialisation a expire.",
    );
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 10);

  // BUG fix audit round 7 (HIGH/TOCTOU) : avant, `record.usedAt` etait
  // check hors transaction, et l'update du token etait inconditionnel
  // (`update({ where: { id }, data: { usedAt } })`). Deux soumissions
  // simultanees du meme token : both check usedAt=null, both succeed,
  // last passwordHash wins. Pire, un attaquant qui steal le token et
  // race le user legitime peut set son propre password.
  // Fix : updateMany conditionnel WHERE usedAt: null → un seul appel
  // reussit. Si count === 0, throw TOKEN_USED (race detectee).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(async (tx: any) => {
    const tokenUpdate = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (tokenUpdate.count === 0) {
      throw new PasswordResetError(
        "TOKEN_USED",
        "Ce lien a deja ete utilise.",
      );
    }
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, mustChangePassword: false },
    });
  });

  // Revoque toutes les sessions actives — force re-login avec le
  // nouveau password. Best-effort : si la revocation echoue, le
  // password est deja change donc les tokens existants seront refuses
  // par le check d'integrite au prochain refresh.
  try {
    await getRefreshTokenStore().revokeAllForUser(record.userId);
  } catch (err) {
    serverLog.warn("[password-reset] revoke refresh tokens failed", {
      userId: record.userId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }

  serverLog.info("[password-reset] completed", {
    event: "auth.password_reset.completed",
    userId: record.userId,
    tokenId: record.id,
  });

  return { userId: record.userId, email: record.user.email };
}
