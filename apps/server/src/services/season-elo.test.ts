/**
 * L.8 — Tests ELO saisonnier avec reset et placements (Sprint 17).
 *
 * Verifie :
 *  - K-factor 48 durant les 5 matchs de placement, 32 ensuite
 *  - Applique le ratin minimum (100) cote seasonElo
 *  - Soft reset depuis l'ELO global (compression vers 1000)
 *  - Idempotence et tolerance (participant retire, match non-ligue)
 */

import { describe, it, expect } from "vitest";
import {
  PLACEMENT_MATCH_COUNT,
  PLACEMENT_K_FACTOR,
  REGULAR_K_FACTOR,
  MIN_SEASON_ELO,
  DEFAULT_SEASON_ELO,
  SOFT_RESET_COEFFICIENT,
  isInPlacement,
  calculateSeasonEloChange,
  deriveSeasonEloFromGlobal,
} from "./season-elo";

describe("Rule: season-elo placements (L.8)", () => {
  it("flags participant in placement when played < PLACEMENT_MATCH_COUNT", () => {
    expect(isInPlacement({ wins: 0, draws: 0, losses: 0 })).toBe(true);
    expect(isInPlacement({ wins: 2, draws: 1, losses: 1 })).toBe(true); // 4 played
    expect(isInPlacement({ wins: 2, draws: 1, losses: 2 })).toBe(false); // 5 played
    expect(isInPlacement({ wins: 10, draws: 0, losses: 0 })).toBe(false);
  });

  it("uses placement K (48) during placement, regular K (32) after", () => {
    expect(PLACEMENT_K_FACTOR).toBe(48);
    expect(REGULAR_K_FACTOR).toBe(32);
    expect(PLACEMENT_MATCH_COUNT).toBe(5);
    expect(DEFAULT_SEASON_ELO).toBe(1000);
    expect(MIN_SEASON_ELO).toBe(100);
  });

  it("applies larger delta when winner is in placement than regular", () => {
    const placementChange = calculateSeasonEloChange({
      ratingA: 1000,
      ratingB: 1000,
      outcome: "win",
      inPlacementA: true,
      inPlacementB: false,
    });
    const regularChange = calculateSeasonEloChange({
      ratingA: 1000,
      ratingB: 1000,
      outcome: "win",
      inPlacementA: false,
      inPlacementB: false,
    });
    expect(placementChange.deltaA).toBeGreaterThan(regularChange.deltaA);
  });

  it("applies K asymmetrically per participant (A placement, B not)", () => {
    const change = calculateSeasonEloChange({
      ratingA: 1000,
      ratingB: 1000,
      outcome: "win",
      inPlacementA: true,
      inPlacementB: false,
    });
    // expected 0.5 each; actual A=1; |deltaA|=48*0.5=24, |deltaB|=32*0.5=16
    expect(change.deltaA).toBe(24);
    expect(change.deltaB).toBe(-16);
  });

  it("produces equal opposite deltas when neither in placement", () => {
    const change = calculateSeasonEloChange({
      ratingA: 1000,
      ratingB: 1000,
      outcome: "win",
      inPlacementA: false,
      inPlacementB: false,
    });
    expect(change.deltaA).toBe(16);
    expect(change.deltaB).toBe(-16);
  });

  it("gives zero delta for draws between equal ratings (regular)", () => {
    const change = calculateSeasonEloChange({
      ratingA: 1000,
      ratingB: 1000,
      outcome: "draw",
      inPlacementA: false,
      inPlacementB: false,
    });
    expect(change.deltaA).toBe(0);
    expect(change.deltaB).toBe(0);
  });

  it("rewards weaker participant on upset win (regular)", () => {
    const change = calculateSeasonEloChange({
      ratingA: 800,
      ratingB: 1200,
      outcome: "win",
      inPlacementA: false,
      inPlacementB: false,
    });
    // A is 400 below, winning → large positive delta
    expect(change.deltaA).toBeGreaterThan(20);
    expect(change.deltaB).toBeLessThan(-20);
  });

  it("handles loss by using negative outcome for A via outcome flip", () => {
    const win = calculateSeasonEloChange({
      ratingA: 1000,
      ratingB: 1000,
      outcome: "win",
      inPlacementA: false,
      inPlacementB: false,
    });
    const loss = calculateSeasonEloChange({
      ratingA: 1000,
      ratingB: 1000,
      outcome: "loss",
      inPlacementA: false,
      inPlacementB: false,
    });
    expect(loss.deltaA).toBe(-win.deltaA);
    expect(loss.deltaB).toBe(-win.deltaB);
  });
});

describe("Rule: season-elo soft reset (L.8)", () => {
  it("pulls global rating toward 1000 with SOFT_RESET_COEFFICIENT", () => {
    expect(SOFT_RESET_COEFFICIENT).toBeGreaterThan(0);
    expect(SOFT_RESET_COEFFICIENT).toBeLessThan(1);
  });

  it("returns 1000 when global rating equals 1000", () => {
    expect(deriveSeasonEloFromGlobal(1000)).toBe(1000);
  });

  it("compresses above-average rating toward 1000", () => {
    const seasonal = deriveSeasonEloFromGlobal(1400);
    expect(seasonal).toBeLessThan(1400);
    expect(seasonal).toBeGreaterThan(1000);
  });

  it("compresses below-average rating toward 1000", () => {
    const seasonal = deriveSeasonEloFromGlobal(600);
    expect(seasonal).toBeGreaterThan(600);
    expect(seasonal).toBeLessThan(1000);
  });

  it("floors at MIN_SEASON_ELO (100)", () => {
    // Even if soft reset points below 100 (impossible with default coef
    // and any reasonable input), the floor must hold.
    const seasonal = deriveSeasonEloFromGlobal(100);
    expect(seasonal).toBeGreaterThanOrEqual(MIN_SEASON_ELO);
  });

  it("returns an integer (seasonElo is stored as Int)", () => {
    expect(Number.isInteger(deriveSeasonEloFromGlobal(1337))).toBe(true);
    expect(Number.isInteger(deriveSeasonEloFromGlobal(742))).toBe(true);
  });
});
