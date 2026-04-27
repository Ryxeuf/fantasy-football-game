import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryRefreshTokenStore,
  rotateRefreshToken,
  RefreshTokenReuseError,
  type RefreshTokenStore,
} from "./refresh-token-store";
import { signRefreshToken, verifyRefreshToken } from "./auth-tokens";

describe("Rule: refresh-token-store (S24.3b/c)", () => {
  let store: RefreshTokenStore;

  beforeEach(() => {
    store = new InMemoryRefreshTokenStore();
  });

  describe("InMemoryRefreshTokenStore.register / isActive / isRevoked", () => {
    it("an unregistered jti is neither active nor revoked", async () => {
      expect(await store.isActive("unknown")).toBe(false);
      expect(await store.isRevoked("unknown")).toBe(false);
    });

    it("after register, jti is active and not revoked", async () => {
      await store.register({
        jti: "j1",
        sub: "user-1",
        expiresAt: Math.floor(Date.now() / 1000) + 60,
      });
      expect(await store.isActive("j1")).toBe(true);
      expect(await store.isRevoked("j1")).toBe(false);
    });

    it("after revoke, jti is no longer active and is revoked", async () => {
      await store.register({
        jti: "j1",
        sub: "user-1",
        expiresAt: Math.floor(Date.now() / 1000) + 60,
      });
      await store.revoke("j1");
      expect(await store.isActive("j1")).toBe(false);
      expect(await store.isRevoked("j1")).toBe(true);
    });

    it("an expired jti is no longer active (auto eviction)", async () => {
      await store.register({
        jti: "j1",
        sub: "user-1",
        expiresAt: Math.floor(Date.now() / 1000) - 1,
      });
      expect(await store.isActive("j1")).toBe(false);
    });

    it("revokeAllForUser revokes every jti owned by a user", async () => {
      const expiresAt = Math.floor(Date.now() / 1000) + 60;
      await store.register({ jti: "j1", sub: "user-1", expiresAt });
      await store.register({ jti: "j2", sub: "user-1", expiresAt });
      await store.register({ jti: "j3", sub: "user-2", expiresAt });
      await store.revokeAllForUser("user-1");
      expect(await store.isRevoked("j1")).toBe(true);
      expect(await store.isRevoked("j2")).toBe(true);
      expect(await store.isRevoked("j3")).toBe(false);
    });
  });

  describe("rotateRefreshToken", () => {
    it("issues a new refresh token, registers its jti, revokes the old one", async () => {
      const oldToken = signRefreshToken({ sub: "user-1", jti: "old-jti" });
      await store.register({
        jti: "old-jti",
        sub: "user-1",
        expiresAt: Math.floor(Date.now() / 1000) + 60,
      });

      const result = await rotateRefreshToken(oldToken, store);

      expect(result.sub).toBe("user-1");
      expect(typeof result.token).toBe("string");
      expect(result.token).not.toEqual(oldToken);
      expect(await store.isRevoked("old-jti")).toBe(true);

      const newPayload = verifyRefreshToken(result.token);
      expect(newPayload.sub).toBe("user-1");
      expect(await store.isActive(newPayload.jti)).toBe(true);
    });

    it("rejects a refresh token whose jti was never registered", async () => {
      const orphanToken = signRefreshToken({
        sub: "user-1",
        jti: "never-issued",
      });
      await expect(rotateRefreshToken(orphanToken, store)).rejects.toThrow();
    });

    it("rejects an already-revoked refresh token and signals reuse", async () => {
      const token = signRefreshToken({ sub: "user-1", jti: "j1" });
      await store.register({
        jti: "j1",
        sub: "user-1",
        expiresAt: Math.floor(Date.now() / 1000) + 60,
      });
      await store.revoke("j1");

      await expect(rotateRefreshToken(token, store)).rejects.toThrow(
        RefreshTokenReuseError,
      );
    });

    it("on reuse, revokes ALL refresh tokens for that user (defense in depth)", async () => {
      const expiresAt = Math.floor(Date.now() / 1000) + 60;
      const oldToken = signRefreshToken({ sub: "user-1", jti: "old-jti" });
      await store.register({ jti: "old-jti", sub: "user-1", expiresAt });
      await store.register({ jti: "other-jti", sub: "user-1", expiresAt });
      await store.revoke("old-jti");

      await expect(rotateRefreshToken(oldToken, store)).rejects.toThrow(
        RefreshTokenReuseError,
      );
      expect(await store.isRevoked("other-jti")).toBe(true);
    });

    it("rejects a malformed or invalid signature token", async () => {
      await expect(rotateRefreshToken("not-a-jwt", store)).rejects.toThrow();
    });
  });
});
