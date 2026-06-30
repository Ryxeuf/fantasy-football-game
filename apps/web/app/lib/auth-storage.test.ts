import { describe, it, expect, beforeEach } from "vitest";
import {
  clearAuthTokens,
  getAuthToken,
  getRefreshToken,
  isAccessTokenExpired,
  setAuthTokens,
  startImpersonation,
  stopImpersonation,
  isImpersonating,
  getImpersonationTargetLabel,
} from "./auth-storage";

/** Construit un JWT minimal (header.payload.sig) avec le payload donné. */
function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.sig`;
}

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

describe("Rule: impersonation admin (« se connecter en tant que »)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("isImpersonating est false par défaut", () => {
    expect(isImpersonating()).toBe(false);
    expect(getImpersonationTargetLabel()).toBeNull();
  });

  it("startImpersonation sauvegarde les tokens admin et bascule sur la cible", () => {
    setAuthTokens({ token: "admin-access", refreshToken: "admin-refresh" });

    startImpersonation("target-access", "TargetCoach");

    // Token actif = cible, refresh retiré (pas de renouvellement silencieux).
    expect(getAuthToken()).toBe("target-access");
    expect(getRefreshToken()).toBeNull();
    expect(isImpersonating()).toBe(true);
    expect(getImpersonationTargetLabel()).toBe("TargetCoach");
  });

  it("stopImpersonation restaure les tokens admin sauvegardés", () => {
    setAuthTokens({ token: "admin-access", refreshToken: "admin-refresh" });
    startImpersonation("target-access", "TargetCoach");

    const restored = stopImpersonation();

    expect(restored).toBe(true);
    expect(getAuthToken()).toBe("admin-access");
    expect(getRefreshToken()).toBe("admin-refresh");
    expect(isImpersonating()).toBe(false);
    expect(getImpersonationTargetLabel()).toBeNull();
  });

  it("stopImpersonation hors session d'impersonation retourne false", () => {
    setAuthTokens({ token: "normal-access", refreshToken: "normal-refresh" });
    expect(stopImpersonation()).toBe(false);
    // La session normale n'est pas perturbée.
    expect(getAuthToken()).toBe("normal-access");
    expect(getRefreshToken()).toBe("normal-refresh");
  });

  it("round-trip complet : démarrage puis retour ne perd aucun token admin", () => {
    setAuthTokens({ token: "A", refreshToken: "R" });
    startImpersonation("imp", "label");
    stopImpersonation();
    expect(getAuthToken()).toBe("A");
    expect(getRefreshToken()).toBe("R");
  });
});

describe("Rule: isAccessTokenExpired (proactive refresh trigger)", () => {
  const now = () => Math.floor(Date.now() / 1000);

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("treats a missing access token as expired", () => {
    expect(isAccessTokenExpired()).toBe(true);
  });

  it("returns false for a token whose exp is comfortably in the future", () => {
    setAuthTokens({ token: makeJwt({ exp: now() + 600 }) });
    expect(isAccessTokenExpired()).toBe(false);
  });

  it("returns true for a token whose exp is already in the past", () => {
    setAuthTokens({ token: makeJwt({ exp: now() - 10 }) });
    expect(isAccessTokenExpired()).toBe(true);
  });

  it("returns true within the skew window (token about to expire)", () => {
    // exp dans 10s, skew par défaut 30s → considéré expiré.
    setAuthTokens({ token: makeJwt({ exp: now() + 10 }) });
    expect(isAccessTokenExpired()).toBe(true);
  });

  it("treats an unreadable token as NOT expired (reactive path will handle it)", () => {
    setAuthTokens({ token: "not-a-jwt" });
    expect(isAccessTokenExpired()).toBe(false);
  });

  it("treats a token without exp claim as NOT expired", () => {
    setAuthTokens({ token: makeJwt({ sub: "user-1" }) });
    expect(isAccessTokenExpired()).toBe(false);
  });
});
