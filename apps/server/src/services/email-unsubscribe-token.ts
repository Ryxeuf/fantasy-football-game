/**
 * Réengagement — Phase B : token de désinscription e-mail signé
 * (RGPD : désinscription en un clic, sans login).
 *
 * Le token est **stateless** : `base64url(userId) + "." +
 * base64url(HMAC-SHA256(userId, secret))`. Pas de stockage — la
 * vérification recalcule la signature et compare en temps constant. Un
 * attaquant ne peut pas forger un token pour un autre user sans le
 * secret serveur.
 *
 * Les fonctions pures prennent le `secret` en argument (testables sans
 * env). `getUnsubscribeSecret()` lit l'environnement avec un fallback
 * de dev explicite — aucun secret hardcodé en prod.
 */

import { createHmac, timingSafeEqual } from "crypto";

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(userId: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(userId).digest());
}

/**
 * Construit un token de désinscription pour `userId`. Pur.
 */
export function buildUnsubscribeToken(userId: string, secret: string): string {
  const payload = b64url(Buffer.from(userId, "utf8"));
  return `${payload}.${sign(userId, secret)}`;
}

/**
 * Vérifie un token et retourne le `userId` si valide, sinon `null`.
 * Pur. Comparaison en temps constant.
 */
export function verifyUnsubscribeToken(
  token: string,
  secret: string,
): string | null {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  let userId: string;
  try {
    userId = fromB64url(payload).toString("utf8");
  } catch {
    return null;
  }
  if (!userId) return null;

  const expected = sign(userId, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return userId;
}

/**
 * Secret serveur pour la signature. Préfère un secret dédié, retombe
 * sur `JWT_SECRET`, puis sur un fallback de dev (jamais à utiliser en
 * prod — un avertissement est loggé ailleurs au besoin).
 */
export function getUnsubscribeSecret(): string {
  return (
    process.env.EMAIL_UNSUBSCRIBE_SECRET ||
    process.env.JWT_SECRET ||
    "dev-unsubscribe-secret-change-me"
  );
}
