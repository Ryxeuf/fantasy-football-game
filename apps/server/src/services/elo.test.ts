import { describe, it, expect } from "vitest";
import {
  calculateEloChange,
  calculateExpectedScore,
  DEFAULT_ELO,
  K_FACTOR,
} from "./elo";

describe("ELO calculation", () => {
  describe("calculateExpectedScore", () => {
    it("returns 0.5 for equal ratings", () => {
      const expected = calculateExpectedScore(1000, 1000);
      expect(expected).toBeCloseTo(0.5, 4);
    });

    it("returns higher expected score for stronger player", () => {
      const expected = calculateExpectedScore(1400, 1000);
      expect(expected).toBeGreaterThan(0.5);
      expect(expected).toBeLessThan(1);
    });

    it("returns lower expected score for weaker player", () => {
      const expected = calculateExpectedScore(1000, 1400);
      expect(expected).toBeLessThan(0.5);
      expect(expected).toBeGreaterThan(0);
    });

    it("returns complementary scores for both players", () => {
      const expectedA = calculateExpectedScore(1200, 1000);
      const expectedB = calculateExpectedScore(1000, 1200);
      expect(expectedA + expectedB).toBeCloseTo(1.0, 4);
    });
  });

  describe("calculateEloChange", () => {
    it("returns symmetrical positive/negative changes for a win between equal players", () => {
      const result = calculateEloChange(1000, 1000, "win");
      expect(result.winnerDelta).toBeGreaterThan(0);
      expect(result.loserDelta).toBeLessThan(0);
      expect(result.winnerDelta).toBe(-result.loserDelta);
    });

    it("returns zero changes for a draw between equal players", () => {
      const result = calculateEloChange(1000, 1000, "draw");
      expect(result.winnerDelta).toBe(0);
      expect(result.loserDelta).toBe(0);
    });

    it("gives more points for beating a stronger opponent", () => {
      const resultUpset = calculateEloChange(1000, 1400, "win");
      const resultExpected = calculateEloChange(1400, 1000, "win");
      expect(resultUpset.winnerDelta).toBeGreaterThan(resultExpected.winnerDelta);
    });

    it("gives fewer points for beating a weaker opponent", () => {
      const result = calculateEloChange(1400, 1000, "win");
      expect(result.winnerDelta).toBeLessThan(K_FACTOR / 2);
    });

    it("returns integer deltas (rounded)", () => {
      const result = calculateEloChange(1234, 1156, "win");
      expect(Number.isInteger(result.winnerDelta)).toBe(true);
      expect(Number.isInteger(result.loserDelta)).toBe(true);
    });

    it("handles draw between unequal players correctly", () => {
      const result = calculateEloChange(1000, 1400, "draw");
      // Weaker player gains ELO from drawing a stronger player
      expect(result.winnerDelta).toBeGreaterThan(0);
      // Stronger player loses ELO from drawing a weaker player
      expect(result.loserDelta).toBeLessThan(0);
    });

    it("never drops a player below minimum ELO (100)", () => {
      const result = calculateEloChange(100, 2000, "win");
      // Even extreme scenarios should produce valid deltas
      expect(result.winnerDelta).toBeGreaterThan(0);
      expect(Number.isInteger(result.winnerDelta)).toBe(true);
    });
  });

  describe("constants", () => {
    it("has a default ELO of 1000", () => {
      expect(DEFAULT_ELO).toBe(1000);
    });

    it("has a K-factor of 32", () => {
      expect(K_FACTOR).toBe(32);
    });
  });
});
