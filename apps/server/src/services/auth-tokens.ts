import { randomUUID } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { JWT_SECRET } from "../config";

/**
 * Token TTLs (S24.3). Splitting the previous 7-day session token into a
 * short-lived access token and a long-lived refresh token reduces the window
 * during which a stolen access token is usable. The refresh path (rotation +
 * blacklist + endpoint) is implemented in follow-up slices.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * TTL d'un token d'impersonation (admin « se connecter en tant que »).
 * Volontairement court et SANS refresh token associe : la session
 * d'impersonation expire d'elle-meme et ne peut pas etre renouvelee
 * silencieusement, ce qui borne la fenetre d'usurpation a 1 heure.
 */
export const IMPERSONATION_TOKEN_TTL_SECONDS = 60 * 60;

interface AccessTokenClaims {
  sub: string;
  role: string;
  roles: string[];
}

interface ImpersonationTokenClaims {
  /** Utilisateur cible (impersonne) — devient le `sub` du token. */
  sub: string;
  role: string;
  roles: string[];
  /** Admin a l'origine de l'impersonation (claim « actor », cf. RFC 8693). */
  act: string;
}

interface RefreshTokenClaims {
  sub: string;
  jti?: string;
}

export interface AccessTokenPayload extends AccessTokenClaims {
  typ: "access";
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  typ: "refresh";
  iat: number;
  exp: number;
}

const COMMON_OPTIONS: SignOptions = {
  algorithm: "HS256",
};

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(
    { ...claims, typ: "access" },
    JWT_SECRET,
    { ...COMMON_OPTIONS, expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );
}

/**
 * Token d'impersonation : un access token normal (`typ: "access"`) dont le
 * `sub` est l'utilisateur cible et dont les `roles` sont ceux de la cible
 * (l'admin n'a que les droits de l'utilisateur pendant l'impersonation). Le
 * claim `act` trace l'admin a l'origine, et `imp: true` signale a `/auth/me`
 * et a l'UI qu'il s'agit d'une session usurpee.
 */
export function signImpersonationToken(claims: ImpersonationTokenClaims): string {
  return jwt.sign(
    { sub: claims.sub, role: claims.role, roles: claims.roles, act: claims.act, imp: true, typ: "access" },
    JWT_SECRET,
    { ...COMMON_OPTIONS, expiresIn: IMPERSONATION_TOKEN_TTL_SECONDS },
  );
}

export function signRefreshToken(claims: RefreshTokenClaims): string {
  const jti = claims.jti ?? randomUUID();
  return jwt.sign(
    { sub: claims.sub, jti, typ: "refresh" },
    JWT_SECRET,
    { ...COMMON_OPTIONS, expiresIn: REFRESH_TOKEN_TTL_SECONDS },
  );
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Refresh token: invalid payload");
  }
  const payload = decoded as Record<string, unknown>;
  if (payload.typ !== "refresh") {
    throw new Error("Refresh token: not a refresh token");
  }
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Refresh token: missing sub claim");
  }
  if (typeof payload.jti !== "string" || !payload.jti) {
    throw new Error("Refresh token: missing jti claim");
  }
  return payload as unknown as RefreshTokenPayload;
}
