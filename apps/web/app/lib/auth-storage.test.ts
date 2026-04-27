import { describe, it, expect, beforeEach } from "vitest";
import {
  clearAuthTokens,
  getAuthToken,
  getRefreshToken,
  setAuthTokens,
} from "./auth-storage";

describe("Rule: auth-storage helpers (S24.3)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when no token has been stored", () => {
    expect(getAuthToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("setAuthTokens stores both access and refresh tokens", () => {
    setAuthTokens({ token: "access-1", refreshToken: "refresh-1" });
    expect(getAuthToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");
  });

  it("setAuthTokens with no refreshToken keeps the existing refresh token untouched", () => {
    setAuthTokens({ token: "access-1", refreshToken: "refresh-1" });
    setAuthTokens({ token: "access-2" });
    expect(getAuthToken()).toBe("access-2");
    expect(getRefreshToken()).toBe("refresh-1");
  });

  it("clearAuthTokens removes both access and refresh tokens", () => {
    setAuthTokens({ token: "access-1", refreshToken: "refresh-1" });
    clearAuthTokens();
    expect(getAuthToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("uses the legacy 'auth_token' key for backward compatibility with existing code", () => {
    setAuthTokens({ token: "abc", refreshToken: "def" });
    expect(window.localStorage.getItem("auth_token")).toBe("abc");
    expect(window.localStorage.getItem("auth_refresh_token")).toBe("def");
  });
});
