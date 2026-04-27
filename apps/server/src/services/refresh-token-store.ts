import {
  signRefreshToken,
  verifyRefreshToken,
  REFRESH_TOKEN_TTL_SECONDS,
  type RefreshTokenPayload,
} from "./auth-tokens";

/**
 * Refresh token registry (S24.3b). Each refresh token carries a unique `jti`
 * claim. The store records the active jti per user, supports rotation
 * (revoke old + issue new atomically) and detects reuse of an already-revoked
 * token — a strong signal that the previous token was stolen. On reuse, every
 * refresh token of the user is revoked as a defense-in-depth measure.
 *
 * The current implementation is in-memory; persistence (Prisma) will land in a
 * follow-up slice without changing this interface.
 */

export interface RefreshTokenRecord {
  jti: string;
  sub: string;
  /** UNIX seconds. */
  expiresAt: number;
  revokedAt?: number;
}

export interface RefreshTokenStore {
  register(record: { jti: string; sub: string; expiresAt: number }): void;
  revoke(jti: string): void;
  revokeAllForUser(sub: string): void;
  isActive(jti: string): boolean;
  isRevoked(jti: string): boolean;
}

export class RefreshTokenReuseError extends Error {
  constructor(message = "Refresh token reuse detected") {
    super(message);
    this.name = "RefreshTokenReuseError";
  }
}

export class InMemoryRefreshTokenStore implements RefreshTokenStore {
  private readonly records = new Map<string, RefreshTokenRecord>();

  register(record: { jti: string; sub: string; expiresAt: number }): void {
    this.records.set(record.jti, { ...record });
  }

  revoke(jti: string): void {
    const existing = this.records.get(jti);
    if (!existing) return;
    this.records.set(jti, {
      ...existing,
      revokedAt: Math.floor(Date.now() / 1000),
    });
  }

  revokeAllForUser(sub: string): void {
    const now = Math.floor(Date.now() / 1000);
    for (const [jti, rec] of this.records.entries()) {
      if (rec.sub === sub && !rec.revokedAt) {
        this.records.set(jti, { ...rec, revokedAt: now });
      }
    }
  }

  isActive(jti: string): boolean {
    const rec = this.records.get(jti);
    if (!rec) return false;
    if (rec.revokedAt) return false;
    if (rec.expiresAt <= Math.floor(Date.now() / 1000)) return false;
    return true;
  }

  isRevoked(jti: string): boolean {
    const rec = this.records.get(jti);
    if (!rec) return false;
    return Boolean(rec.revokedAt);
  }
}

export interface RotateRefreshTokenResult {
  token: string;
  payload: RefreshTokenPayload;
  sub: string;
}

export function rotateRefreshToken(
  presentedToken: string,
  store: RefreshTokenStore,
): RotateRefreshTokenResult {
  const payload = verifyRefreshToken(presentedToken);

  if (store.isRevoked(payload.jti)) {
    store.revokeAllForUser(payload.sub);
    throw new RefreshTokenReuseError(
      "Refresh token reuse detected: all sessions revoked",
    );
  }

  if (!store.isActive(payload.jti)) {
    throw new Error("Refresh token: jti not registered or expired");
  }

  store.revoke(payload.jti);

  const newToken = signRefreshToken({ sub: payload.sub });
  const newPayload = verifyRefreshToken(newToken);
  store.register({
    jti: newPayload.jti,
    sub: newPayload.sub,
    expiresAt: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS,
  });

  return { token: newToken, payload: newPayload, sub: newPayload.sub };
}
