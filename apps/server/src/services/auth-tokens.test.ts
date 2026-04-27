import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "./auth-tokens";
import { JWT_SECRET } from "../config";

describe("Rule: auth-tokens helpers (S24.3a)", () => {
  describe("TTL constants", () => {
    it("access token TTL is 15 minutes", () => {
      expect(ACCESS_TOKEN_TTL_SECONDS).toBe(15 * 60);
    });

    it("refresh token TTL is 7 days", () => {
      expect(REFRESH_TOKEN_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
    });

    it("access TTL is shorter than refresh TTL", () => {
      expect(ACCESS_TOKEN_TTL_SECONDS).toBeLessThan(
        REFRESH_TOKEN_TTL_SECONDS,
      );
    });
  });

  describe("signAccessToken", () => {
    it("includes sub, role, roles and typ='access' in payload", () => {
      const token = signAccessToken({
        sub: "user-1",
        role: "user",
        roles: ["user"],
      });
      const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
      expect(decoded.sub).toBe("user-1");
      expect(decoded.role).toBe("user");
      expect(decoded.roles).toEqual(["user"]);
      expect(decoded.typ).toBe("access");
    });

    it("token expires within 15 minutes (+/- 2s tolerance)", () => {
      const before = Math.floor(Date.now() / 1000);
      const token = signAccessToken({
        sub: "user-1",
        role: "user",
        roles: ["user"],
      });
      const decoded = jwt.verify(token, JWT_SECRET) as Record<string, number>;
      const expectedExp = before + ACCESS_TOKEN_TTL_SECONDS;
      expect(decoded.exp).toBeGreaterThanOrEqual(expectedExp - 2);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 2);
    });

    it("supports admin role with multiple roles", () => {
      const token = signAccessToken({
        sub: "admin-1",
        role: "admin",
        roles: ["user", "admin"],
      });
      const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
      expect(decoded.roles).toEqual(["user", "admin"]);
    });
  });

  describe("signRefreshToken", () => {
    it("includes sub and typ='refresh' but no role/roles", () => {
      const token = signRefreshToken({ sub: "user-1" });
      const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
      expect(decoded.sub).toBe("user-1");
      expect(decoded.typ).toBe("refresh");
      expect(decoded.role).toBeUndefined();
      expect(decoded.roles).toBeUndefined();
    });

    it("token expires in 7 days (+/- 2s tolerance)", () => {
      const before = Math.floor(Date.now() / 1000);
      const token = signRefreshToken({ sub: "user-1" });
      const decoded = jwt.verify(token, JWT_SECRET) as Record<string, number>;
      const expectedExp = before + REFRESH_TOKEN_TTL_SECONDS;
      expect(decoded.exp).toBeGreaterThanOrEqual(expectedExp - 2);
      expect(decoded.exp).toBeLessThanOrEqual(expectedExp + 2);
    });

    it("auto-generates a unique jti when none is provided", () => {
      const t1 = signRefreshToken({ sub: "user-1" });
      const t2 = signRefreshToken({ sub: "user-1" });
      const d1 = jwt.verify(t1, JWT_SECRET) as Record<string, unknown>;
      const d2 = jwt.verify(t2, JWT_SECRET) as Record<string, unknown>;
      expect(typeof d1.jti).toBe("string");
      expect(typeof d2.jti).toBe("string");
      expect((d1.jti as string).length).toBeGreaterThan(0);
      expect(d1.jti).not.toEqual(d2.jti);
    });

    it("uses the provided jti when supplied", () => {
      const token = signRefreshToken({ sub: "user-1", jti: "fixed-jti-123" });
      const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
      expect(decoded.jti).toBe("fixed-jti-123");
    });
  });

  describe("verifyRefreshToken", () => {
    it("returns payload for a valid refresh token", () => {
      const token = signRefreshToken({ sub: "user-1" });
      const payload = verifyRefreshToken(token);
      expect(payload).toEqual(
        expect.objectContaining({ sub: "user-1", typ: "refresh" }),
      );
    });

    it("returns the jti claim for a valid refresh token", () => {
      const token = signRefreshToken({ sub: "user-1", jti: "abc-123" });
      const payload = verifyRefreshToken(token);
      expect(payload.jti).toBe("abc-123");
    });

    it("rejects a refresh token without jti", () => {
      const token = jwt.sign(
        { sub: "user-1", typ: "refresh" },
        JWT_SECRET,
        { expiresIn: "7d" },
      );
      expect(() => verifyRefreshToken(token)).toThrow(/missing jti/i);
    });

    it("rejects an access token by typ check", () => {
      const accessToken = signAccessToken({
        sub: "user-1",
        role: "user",
        roles: ["user"],
      });
      expect(() => verifyRefreshToken(accessToken)).toThrow(
        /not a refresh token/i,
      );
    });

    it("rejects a token signed with a different secret", () => {
      const fakeToken = jwt.sign(
        { sub: "user-1", typ: "refresh" },
        "wrong-secret",
        { expiresIn: "7d" },
      );
      expect(() => verifyRefreshToken(fakeToken)).toThrow();
    });

    it("rejects an expired refresh token", () => {
      const expired = jwt.sign(
        { sub: "user-1", typ: "refresh" },
        JWT_SECRET,
        { expiresIn: "-1s" },
      );
      expect(() => verifyRefreshToken(expired)).toThrow(
        /jwt expired|TokenExpiredError/i,
      );
    });

    it("rejects a token without typ claim", () => {
      const token = jwt.sign({ sub: "user-1" }, JWT_SECRET, {
        expiresIn: "7d",
      });
      expect(() => verifyRefreshToken(token)).toThrow(/not a refresh token/i);
    });

    it("rejects malformed tokens", () => {
      expect(() => verifyRefreshToken("not-a-jwt")).toThrow();
    });
  });
});
