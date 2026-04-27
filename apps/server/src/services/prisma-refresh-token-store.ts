import { prisma } from "../prisma";
import type { RefreshTokenStore } from "./refresh-token-store";

/**
 * Prisma-backed implementation of {@link RefreshTokenStore} (S24.3c).
 *
 * The interface uses UNIX seconds for `expiresAt`; this adapter converts to
 * `Date` for Prisma. Records are never deleted on revoke — `revokedAt` is set
 * so reuse can still be detected (a stolen token presented again hits the
 * revoked-row branch and triggers `revokeAllForUser`).
 *
 * Note on the `revoke` path: when the jti is not present in the DB, Prisma
 * raises `P2025`. We swallow it because revoke is idempotent — caller code
 * (e.g. logout, rotation cleanup) does not need to distinguish "already gone"
 * from "successfully revoked".
 */
export class PrismaRefreshTokenStore implements RefreshTokenStore {
  async register(record: {
    jti: string;
    sub: string;
    expiresAt: number;
  }): Promise<void> {
    await prisma.refreshToken.create({
      data: {
        jti: record.jti,
        userId: record.sub,
        expiresAt: new Date(record.expiresAt * 1000),
      },
    });
  }

  async revoke(jti: string): Promise<void> {
    try {
      await prisma.refreshToken.update({
        where: { jti },
        data: { revokedAt: new Date() },
      });
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "P2025") return;
      throw err;
    }
  }

  async revokeAllForUser(sub: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId: sub, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async isActive(jti: string): Promise<boolean> {
    const row = await prisma.refreshToken.findUnique({ where: { jti } });
    if (!row) return false;
    if (row.revokedAt) return false;
    if (row.expiresAt.getTime() <= Date.now()) return false;
    return true;
  }

  async isRevoked(jti: string): Promise<boolean> {
    const row = await prisma.refreshToken.findUnique({ where: { jti } });
    if (!row) return false;
    return Boolean(row.revokedAt);
  }
}
