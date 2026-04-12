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
      process.env.NODE_ENV = "production";

      const { JWT_SECRET, MATCH_SECRET } = await import("./config");
      expect(JWT_SECRET).toBe("prod-jwt-secret");
      expect(MATCH_SECRET).toBe("prod-match-secret");
    });
  });
});
