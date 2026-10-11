/**
 * Clés API d'administration — règles PURES (change OpenSpec
 * `admin-api-keys`, doc `docs/admin-api-keys.md`).
 *
 * Tout ce qui DÉCIDE vit ici, sans Prisma ni Express : format du secret,
 * extraction depuis les en-têtes, éligibilité d'une clé et de son
 * propriétaire, portée, expiration, échantillonnage du dernier usage. Le
 * service (`api-keys.ts`) ne fait que lire et écrire.
 */
import { createHash, randomBytes } from "node:crypto";

import { hasRole, normalizeRoles } from "../utils/roles";

/** « Nuffle Arena Key ». Un JWT commence par `eyJ` : aucun recouvrement. */
export const API_KEY_PREFIX = "nak_";

/** Longueur du préfixe d'identification stocké (`nak_` + 8 caractères). */
export const API_KEY_DISPLAY_PREFIX_LENGTH = 12;

/** 32 octets = 256 bits ⇒ 43 caractères base64url. */
const SECRET_BYTES = 32;
const API_KEY_PATTERN = /^nak_[A-Za-z0-9_-]{43}$/;

export const API_KEY_SCOPES = ["read", "write"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

/** Bornes de l'expiration choisie à la création (`null` = sans expiration). */
export const API_KEY_MAX_EXPIRY_DAYS = 365;

/** Méthodes qu'une clé `read` peut employer. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Au plus une écriture du dernier usage par clé et par fenêtre. */
export const API_KEY_LAST_USED_WINDOW_MS = 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GeneratedApiKey {
  /** Secret complet, à remettre UNE fois au créateur. */
  readonly secret: string;
  /** Préfixe d'identification, stockable et affichable. */
  readonly keyPrefix: string;
  /** Empreinte stockée. */
  readonly keyHash: string;
}

/** Empreinte SHA-256 hex d'un secret (même posture que `PasswordResetToken`). */
export function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** Génère un secret neuf. `random` est injectable pour les tests. */
export function generateApiKey(
  random: (size: number) => Buffer = randomBytes,
): GeneratedApiKey {
  const secret = `${API_KEY_PREFIX}${random(SECRET_BYTES).toString("base64url")}`;
  return {
    secret,
    keyPrefix: secret.slice(0, API_KEY_DISPLAY_PREFIX_LENGTH),
    keyHash: hashApiKey(secret),
  };
}

/** Vrai si la chaîne a la FORME d'une clé (pas qu'elle existe). */
export function isApiKeyFormat(value: string): boolean {
  return API_KEY_PATTERN.test(value);
}

type HeaderValue = string | string[] | undefined;

function firstHeader(value: HeaderValue): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * Secret candidat présent dans la requête, ou `null`.
 *
 * Reconnu : `X-API-Key: nak_…` et `Authorization: Bearer nak_…`. Seul le
 * PRÉFIXE aiguille : un `Bearer nak_` mal formé reste une clé (refusée
 * plus loin, 401) et n'est jamais retenté comme JWT. Tout autre contenu de
 * `Authorization` est laissé au chemin JWT.
 */
export function extractApiKey(headers: {
  authorization?: HeaderValue;
  "x-api-key"?: HeaderValue;
}): string | null {
  const explicit = firstHeader(headers["x-api-key"]).trim();
  if (explicit.startsWith(API_KEY_PREFIX)) return explicit;

  const [scheme, token] = firstHeader(headers.authorization).trim().split(/\s+/);
  if (
    scheme &&
    scheme.toLowerCase() === "bearer" &&
    token &&
    token.startsWith(API_KEY_PREFIX)
  ) {
    return token;
  }
  return null;
}

/** Ligne de clé chargée avec son propriétaire (cf. `resolveApiKey`). */
export interface ApiKeyRow {
  readonly id: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly scope: string;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly user: {
    readonly id: string;
    readonly role: string | null;
    readonly roles: unknown;
    readonly valid: boolean;
    readonly deletedAt: Date | null;
    readonly bannedUntil: Date | null;
  } | null;
}

export type ApiKeyRejection =
  | "unknown"
  | "revoked"
  | "expired"
  | "owner-missing"
  | "owner-deleted"
  | "owner-banned"
  | "owner-disabled"
  | "owner-not-admin";

export interface ApiKeyIdentity {
  readonly apiKeyId: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly scope: ApiKeyScope;
  readonly userId: string;
  readonly roles: string[];
}

export type ApiKeyEvaluation =
  | { readonly ok: true; readonly identity: ApiKeyIdentity }
  | { readonly ok: false; readonly reason: ApiKeyRejection };

/** Portée stockée ⇒ portée effective. Inconnue ⇒ la plus restrictive. */
export function parseApiKeyScope(raw: string | null | undefined): ApiKeyScope {
  return raw === "write" ? "write" : "read";
}

/**
 * Une clé est-elle utilisable à `now` ? Les rôles sont ceux du
 * PROPRIÉTAIRE en base : rétrograder un admin neutralise ses clés.
 */
export function evaluateApiKey(
  row: ApiKeyRow | null,
  now: Date,
): ApiKeyEvaluation {
  if (!row) return { ok: false, reason: "unknown" };
  if (row.revokedAt) return { ok: false, reason: "revoked" };
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  const owner = row.user;
  if (!owner) return { ok: false, reason: "owner-missing" };
  if (owner.deletedAt) return { ok: false, reason: "owner-deleted" };
  if (owner.bannedUntil && owner.bannedUntil.getTime() > now.getTime()) {
    return { ok: false, reason: "owner-banned" };
  }
  if (!owner.valid) return { ok: false, reason: "owner-disabled" };

  // Même résolution que la connexion et `adminOnly` (`roles ?? role`) : une
  // clé n'a jamais d'autres rôles que ceux qu'aurait la session du
  // propriétaire. `roles` est un tableau (PG) ou une chaîne JSON (sqlite).
  const roles = normalizeRoles(
    (owner.roles as string[] | string | null | undefined) ?? owner.role,
  );
  if (!hasRole(roles, "admin")) {
    return { ok: false, reason: "owner-not-admin" };
  }

  return {
    ok: true,
    identity: {
      apiKeyId: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      scope: parseApiKeyScope(row.scope),
      userId: owner.id,
      roles,
    },
  };
}

/** La portée autorise-t-elle cette méthode HTTP ? */
export function isMethodAllowedForScope(
  scope: ApiKeyScope,
  method: string,
): boolean {
  if (scope === "write") return true;
  return SAFE_METHODS.has(method.toUpperCase());
}

/** Échéance d'une clé créée à `now` (`null` = sans expiration). */
export function computeApiKeyExpiry(
  now: Date,
  expiresInDays: number | null,
): Date | null {
  if (expiresInDays === null) return null;
  return new Date(now.getTime() + expiresInDays * DAY_MS);
}

/** Faut-il réécrire le dernier usage ? (au plus une fois par fenêtre) */
export function shouldTouchLastUsed(
  lastUsedAt: Date | null,
  now: Date,
): boolean {
  if (!lastUsedAt) return true;
  return now.getTime() - lastUsedAt.getTime() >= API_KEY_LAST_USED_WINDOW_MS;
}

export type ApiKeyStatus = "active" | "revoked" | "expired";

/** Statut affiché dans l'admin. */
export function apiKeyStatus(
  key: { readonly revokedAt: Date | null; readonly expiresAt: Date | null },
  now: Date,
): ApiKeyStatus {
  if (key.revokedAt) return "revoked";
  if (key.expiresAt && key.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return "active";
}
