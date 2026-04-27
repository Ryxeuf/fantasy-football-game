import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryRefreshTokenStore,
  rotateRefreshToken,
  RefreshTokenReuseError,
  type RefreshTokenStore,
} from "./refresh-token-store";
import { signRefreshToken, verifyRefreshToken } from "./auth-tokens";

describe("Rule: refresh-token-store (S24.3b)", () => {
  let store: RefreshTokenStore;

  beforeEach(() => {
    store = new InMemoryRefreshTokenStore();
  });

  describe("InMemoryRefreshTokenStore.register / isActive / isRevoked", () => {
    it("an unregistered jti is neither active nor revoked", () => {
      expect(store.isActive("unknown")).toBe(false);
      expect(store.isRevoked("unknown")).toBe(false);
    });

    it("after register, jti is active and not revoked", () => {
      store.register({
        jti: "j1",
        sub: "user-1",
        expiresAt: Math.floor(Date.now() / 1000) + 60,
      });
      expect(store.isActive("j1")).toBe(true);
      expect(store.isRevoked("j1")).toBe(false);
    });

    it("after revoke, jti is no longer active and is revoked", () => {
      store.register({
        jti: "j1",
        sub: "user-1",
        expiresAt: Math.floor(Date.now() / 1000) + 60,
      });
      store.revoke("j1");
      expect(store.isActive("j1")).toBe(false);
      expect(store.isRevoked("j1")).toBe(true);
    });

    it("an expired jti is no longer active (auto eviction)", () => {
      store.register({
        jti: "j1",
        sub: "user-1",
        expiresAt: Math.floor(Date.now() / 1000) - 1,
      });
      expect(store.isActive("j1")).toBe(false);
    });

    it("revokeAllForUser revokes every jti owned by a user", () => {
      const expiresAt = Math.floor(Date.now() / 1000) + 60;
      store.register({ jti: "j1", sub: "user-1", expiresAt });
      store.register({ jti: "j2", sub: "user-1", expiresAt });
      store.register({ jti: "j3", sub: "user-2", expiresAt });
      store.revokeAllForUser("user-1");
      expect(store.isRevoked("j1")).toBe(true);
      expect(store.isRevoked("j2")).toBe(true);
      expect(store.isRevoked("j3")).toBe(false);
    });
  });

  describe("rotateRefreshToken", () => {
    it("issues a new refresh token, registers its jti, revokes the old one", () => {
      const oldToken = signRefreshToken({ sub: "user-1", jti: "old-jti" });
      store.register({
        jti: "old-jti",
        sub: "user-1",
        expiresAt: Math.floor(Date.now() / 1000) + 60,
      });

      const result = rotateRefreshToken(oldToken, store);

      expect(result.sub).toBe("user-1");
      expect(typeof result.token).toBe("string");
      expect(result.token).not.toEqual(oldToken);
      expect(store.isRevoked("old-jti")).toBe(true);

      const newPayload = verifyRefreshToken(result.token);
      expect(newPayload.sub).toBe("user-1");
      expect(store.isActive(newPayload.jti)).toBe(true);
    });

    it("rejects a refresh token whose jti was never registered", () => {
      const orphanToken = signRefreshToken({
        sub: "user-1",
        jti: "never-issued",
      });
      expect(() => rotateRefreshToken(orphanToken, store)).toThrow();
    });

    it("rejects an already-revoked refresh token and signals reuse", () => {
      const token = signRefreshToken({ sub: "user-1", jti: "j1" });
      store.register({
        jti: "j1",
        sub: "user-1",
        expiresAt: Math.floor(Date.now() / 1000) + 60,
      });
      store.revoke("j1");

      expect(() => rotateRefreshToken(token, store)).toThrow(
        RefreshTokenReuseError,
      );
    });

    it("on reuse, revokes ALL refresh tokens for that user (defense in depth)", () => {
      const expiresAt = Math.floor(Date.now() / 1000) + 60;
      const oldToken = signRefreshToken({ sub: "user-1", jti: "old-jti" });
      store.register({ jti: "old-jti", sub: "user-1", expiresAt });
      store.register({ jti: "other-jti", sub: "user-1", expiresAt });
      store.revoke("old-jti");

      expect(() => rotateRefreshToken(oldToken, store)).toThrow(
        RefreshTokenReuseError,
      );
      expect(store.isRevoked("other-jti")).toBe(true);
    });

    it("rejects a malformed or invalid signature token", () => {
      expect(() => rotateRefreshToken("not-a-jwt", store)).toThrow();
    });
  });
});
