import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("getRequiredEnv", () => {
    it("returns env value when set", async () => {
      process.env.JWT_SECRET = "my-jwt-secret";
      process.env.MATCH_SECRET = "my-match-secret";
      process.env.NODE_ENV = "development";

      const { JWT_SECRET, MATCH_SECRET } = await import("./config");
      expect(JWT_SECRET).toBe("my-jwt-secret");
      expect(MATCH_SECRET).toBe("my-match-secret");
    });

    it("returns dev defaults when env vars are missing in development", async () => {
      delete process.env.JWT_SECRET;
      delete process.env.MATCH_SECRET;
      process.env.NODE_ENV = "development";

      const { JWT_SECRET, MATCH_SECRET } = await import("./config");
      expect(JWT_SECRET).toBe("dev-secret-change-me");
      expect(MATCH_SECRET).toBe("dev-match-secret");
    });

    it("returns dev defaults when env vars are missing in test", async () => {
      delete process.env.JWT_SECRET;
      delete process.env.MATCH_SECRET;
      process.env.NODE_ENV = "test";

      const { JWT_SECRET, MATCH_SECRET } = await import("./config");
      expect(JWT_SECRET).toBe("dev-secret-change-me");
      expect(MATCH_SECRET).toBe("dev-match-secret");
    });

    it("throws when JWT_SECRET is missing in production", async () => {
      delete process.env.JWT_SECRET;
      process.env.MATCH_SECRET = "some-match-secret";
      process.env.NODE_ENV = "production";

      await expect(() => import("./config")).rejects.toThrow(
        "JWT_SECRET"
      );
    });

    it("throws when MATCH_SECRET is missing in production", async () => {
      process.env.JWT_SECRET = "some-jwt-secret";
      delete process.env.MATCH_SECRET;
      process.env.NODE_ENV = "production";

      await expect(() => import("./config")).rejects.toThrow(
        "MATCH_SECRET"
      );
    });

    it("throws when both secrets are missing in production", async () => {
      delete process.env.JWT_SECRET;
      delete process.env.MATCH_SECRET;
      process.env.NODE_ENV = "production";

      await expect(() => import("./config")).rejects.toThrow(
        "JWT_SECRET"
      );
    });

    it("succeeds in production when all secrets are provided", async () => {
      process.env.JWT_SECRET = "prod-jwt-secret";
      process.env.MATCH_SECRET = "prod-match-secret";
      process.env.KOFI_VERIFICATION_TOKEN = "prod-kofi-token";
      process.env.CORS_ORIGINS = "https://nuffle-arena.com";
      process.env.NODE_ENV = "production";

      const { JWT_SECRET, MATCH_SECRET, KOFI_VERIFICATION_TOKEN } = await import(
        "./config"
      );
      expect(JWT_SECRET).toBe("prod-jwt-secret");
      expect(MATCH_SECRET).toBe("prod-match-secret");
      expect(KOFI_VERIFICATION_TOKEN).toBe("prod-kofi-token");
    });

    it("throws when KOFI_VERIFICATION_TOKEN is missing in production", async () => {
      process.env.JWT_SECRET = "s";
      process.env.MATCH_SECRET = "s";
      process.env.CORS_ORIGINS = "https://nuffle-arena.com";
      delete process.env.KOFI_VERIFICATION_TOKEN;
      process.env.NODE_ENV = "production";

      await expect(() => import("./config")).rejects.toThrow(
        "KOFI_VERIFICATION_TOKEN",
      );
    });
  });

  describe("CORS_ORIGINS", () => {
    it("returns dev default when CORS_ORIGINS is not set in development", async () => {
      delete process.env.CORS_ORIGINS;
      process.env.JWT_SECRET = "s";
      process.env.MATCH_SECRET = "s";
      process.env.NODE_ENV = "development";

      const { CORS_ORIGINS } = await import("./config");
      expect(CORS_ORIGINS).toEqual(["http://localhost:3100"]);
    });

    it("parses comma-separated origins from env var", async () => {
      process.env.CORS_ORIGINS = "https://nuffle-arena.com,https://www.nuffle-arena.com";
      process.env.JWT_SECRET = "s";
      process.env.MATCH_SECRET = "s";
      process.env.NODE_ENV = "development";

      const { CORS_ORIGINS } = await import("./config");
      expect(CORS_ORIGINS).toEqual([
        "https://nuffle-arena.com",
        "https://www.nuffle-arena.com",
      ]);
    });

    it("trims whitespace from origins", async () => {
      process.env.CORS_ORIGINS = " https://a.com , https://b.com ";
      process.env.JWT_SECRET = "s";
      process.env.MATCH_SECRET = "s";
      process.env.NODE_ENV = "development";

      const { CORS_ORIGINS } = await import("./config");
      expect(CORS_ORIGINS).toEqual(["https://a.com", "https://b.com"]);
    });

    it("filters out empty entries from trailing commas", async () => {
      process.env.CORS_ORIGINS = "https://a.com,,https://b.com,";
      process.env.JWT_SECRET = "s";
      process.env.MATCH_SECRET = "s";
      process.env.NODE_ENV = "development";

      const { CORS_ORIGINS } = await import("./config");
      expect(CORS_ORIGINS).toEqual(["https://a.com", "https://b.com"]);
    });

    it("throws when CORS_ORIGINS is missing in production", async () => {
      delete process.env.CORS_ORIGINS;
      process.env.JWT_SECRET = "s";
      process.env.MATCH_SECRET = "s";
      process.env.NODE_ENV = "production";

      await expect(() => import("./config")).rejects.toThrow("CORS_ORIGINS");
    });

    it("uses CORS_ORIGINS from env in production", async () => {
      process.env.CORS_ORIGINS = "https://nuffle-arena.com";
      process.env.JWT_SECRET = "s";
      process.env.MATCH_SECRET = "s";
      process.env.KOFI_VERIFICATION_TOKEN = "s";
      process.env.NODE_ENV = "production";

      const { CORS_ORIGINS } = await import("./config");
      expect(CORS_ORIGINS).toEqual(["https://nuffle-arena.com"]);
    });
  });
});
