import { describe, it, expect } from "vitest";
import {
  computePollDelay,
  WS_CONNECTED_DELAY_MS,
  BASE_FALLBACK_DELAY_MS,
  MAX_FALLBACK_DELAY_MS,
} from "./pollDelay";

describe("computePollDelay (S24.5)", () => {
  describe("WebSocket connected", () => {
    it("returns slow interval (30s) when WS is connected", () => {
      expect(computePollDelay({ wsConnected: true, failureCount: 0 })).toBe(
        WS_CONNECTED_DELAY_MS,
      );
    });

    it("ignores failureCount when WS is connected", () => {
      expect(computePollDelay({ wsConnected: true, failureCount: 5 })).toBe(
        WS_CONNECTED_DELAY_MS,
      );
    });

    it("uses 30000 ms as the connected default", () => {
      expect(WS_CONNECTED_DELAY_MS).toBe(30000);
    });
  });

  describe("WebSocket disconnected (fallback)", () => {
    it("starts at 10s base delay when no failures (S24.5: 3s -> 10s)", () => {
      expect(computePollDelay({ wsConnected: false, failureCount: 0 })).toBe(
        BASE_FALLBACK_DELAY_MS,
      );
      expect(BASE_FALLBACK_DELAY_MS).toBe(10000);
    });

    it("doubles delay after one failure (exponential backoff)", () => {
      expect(computePollDelay({ wsConnected: false, failureCount: 1 })).toBe(
        20000,
      );
    });

    it("doubles again after two failures", () => {
      expect(computePollDelay({ wsConnected: false, failureCount: 2 })).toBe(
        40000,
      );
    });

    it("caps at MAX_FALLBACK_DELAY_MS (60s) after three failures", () => {
      expect(computePollDelay({ wsConnected: false, failureCount: 3 })).toBe(
        MAX_FALLBACK_DELAY_MS,
      );
      expect(MAX_FALLBACK_DELAY_MS).toBe(60000);
    });

    it("stays capped for many consecutive failures", () => {
      expect(computePollDelay({ wsConnected: false, failureCount: 10 })).toBe(
        MAX_FALLBACK_DELAY_MS,
      );
      expect(computePollDelay({ wsConnected: false, failureCount: 100 })).toBe(
        MAX_FALLBACK_DELAY_MS,
      );
    });

    it("never returns less than the base delay", () => {
      const delay = computePollDelay({ wsConnected: false, failureCount: 0 });
      expect(delay).toBeGreaterThanOrEqual(BASE_FALLBACK_DELAY_MS);
    });

    it("treats negative failureCount as zero (defensive)", () => {
      expect(computePollDelay({ wsConnected: false, failureCount: -1 })).toBe(
        BASE_FALLBACK_DELAY_MS,
      );
    });
  });

  describe("regression: scale-safety bounds", () => {
    it("never polls faster than 10s in fallback (anti-stampede)", () => {
      for (let i = 0; i < 20; i++) {
        const delay = computePollDelay({ wsConnected: false, failureCount: i });
        expect(delay).toBeGreaterThanOrEqual(BASE_FALLBACK_DELAY_MS);
      }
    });

    it("never exceeds the cap, regardless of failure count", () => {
      for (let i = 0; i < 50; i++) {
        const delay = computePollDelay({ wsConnected: false, failureCount: i });
        expect(delay).toBeLessThanOrEqual(MAX_FALLBACK_DELAY_MS);
      }
    });
  });
});
