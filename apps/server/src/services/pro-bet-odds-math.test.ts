import { describe, expect, it } from "vitest";

import {
  DEFAULT_HOUSE_MARGIN,
  MAX_DECIMAL_ODDS,
  MIN_DECIMAL_ODDS,
  computeNuffleOccursProbabilities,
  computeOneXTwoProbabilities,
  computeOverUnderProbabilities,
  impliedProbability,
  probabilityToDecimalOdds,
} from "./pro-bet-odds-math";

describe("probabilityToDecimalOdds — sprint 1.D.3", () => {
  it("p=0.5, marge 0 → cote 2.0", () => {
    expect(probabilityToDecimalOdds(0.5, 0)).toBe(2);
  });

  it("p=0.5, marge 5% → cote ~1.90 (round 2dp)", () => {
    expect(probabilityToDecimalOdds(0.5, 0.05)).toBeCloseTo(1.9, 2);
  });

  it("p=0.25, marge 5% → cote ~3.81", () => {
    // (1/0.25) / 1.05 = 4 / 1.05 = 3.809... → round 3.81
    expect(probabilityToDecimalOdds(0.25, 0.05)).toBeCloseTo(3.81, 2);
  });

  it("p=0 → MAX_DECIMAL_ODDS (cap)", () => {
    expect(probabilityToDecimalOdds(0)).toBe(MAX_DECIMAL_ODDS);
  });

  it("p=1 → MIN_DECIMAL_ODDS (cap)", () => {
    expect(probabilityToDecimalOdds(1)).toBe(MIN_DECIMAL_ODDS);
  });

  it("p très haut (favori extrême) → clamp MIN", () => {
    expect(probabilityToDecimalOdds(0.99)).toBe(MIN_DECIMAL_ODDS);
  });

  it("p très bas (outsider extrême) → clamp MAX", () => {
    expect(probabilityToDecimalOdds(0.001)).toBe(MAX_DECIMAL_ODDS);
  });

  it("rejette houseMargin négative", () => {
    expect(() => probabilityToDecimalOdds(0.5, -0.05)).toThrow(/houseMargin/);
  });

  it("rejette inputs non-finite", () => {
    expect(() => probabilityToDecimalOdds(Number.NaN)).toThrow();
    expect(() => probabilityToDecimalOdds(0.5, Number.POSITIVE_INFINITY)).toThrow();
  });

  it("DEFAULT_HOUSE_MARGIN = 5%", () => {
    expect(DEFAULT_HOUSE_MARGIN).toBe(0.05);
  });
});

describe("impliedProbability — sprint 1.D.3", () => {
  it("inverse de odds → 1/odds", () => {
    expect(impliedProbability(2.0)).toBe(0.5);
    expect(impliedProbability(4.0)).toBe(0.25);
  });

  it("rejette odds invalides", () => {
    expect(() => impliedProbability(0)).toThrow();
    expect(() => impliedProbability(1.0)).toThrow();
    expect(() => impliedProbability(Number.NaN)).toThrow();
  });
});

describe("computeOneXTwoProbabilities — sprint 1.D.3", () => {
  it("probabilités somment à 1", () => {
    const out = computeOneXTwoProbabilities({
      home: 60,
      draws: 25,
      away: 15,
    });
    expect(out.home + out.draw + out.away).toBeCloseTo(1, 5);
    expect(out.home).toBeCloseTo(0.6, 5);
    expect(out.draw).toBeCloseTo(0.25, 5);
    expect(out.away).toBeCloseTo(0.15, 5);
  });

  it("renvoie 1/3 partout pour échantillon vide", () => {
    const out = computeOneXTwoProbabilities({ home: 0, draws: 0, away: 0 });
    expect(out.home).toBeCloseTo(1 / 3, 5);
    expect(out.draw).toBeCloseTo(1 / 3, 5);
    expect(out.away).toBeCloseTo(1 / 3, 5);
  });
});

describe("computeOverUnderProbabilities — sprint 1.D.3", () => {
  it("strictement > line", () => {
    // line=2.5, valeurs [0,1,2,3,4] → 2 valeurs > 2.5 → over = 0.4
    const out = computeOverUnderProbabilities([0, 1, 2, 3, 4], 2.5);
    expect(out.over).toBeCloseTo(0.4, 5);
    expect(out.under).toBeCloseTo(0.6, 5);
  });

  it("toutes valeurs sous le line → over=0", () => {
    const out = computeOverUnderProbabilities([0, 1, 2], 5.5);
    expect(out.over).toBe(0);
    expect(out.under).toBe(1);
  });

  it("échantillon vide → 50/50", () => {
    const out = computeOverUnderProbabilities([], 2.5);
    expect(out.over).toBe(0.5);
    expect(out.under).toBe(0.5);
  });
});

describe("computeNuffleOccursProbabilities — sprint 1.D.3", () => {
  it("yes = au moins 1 event", () => {
    // [0, 0, 2, 3, 0] → 2 occurrences (≥1) sur 5 = 0.4
    const out = computeNuffleOccursProbabilities([0, 0, 2, 3, 0]);
    expect(out.yes).toBeCloseTo(0.4, 5);
    expect(out.no).toBeCloseTo(0.6, 5);
  });

  it("zéros partout → yes=0", () => {
    const out = computeNuffleOccursProbabilities([0, 0, 0]);
    expect(out.yes).toBe(0);
    expect(out.no).toBe(1);
  });

  it("au moins 1 partout → yes=1", () => {
    const out = computeNuffleOccursProbabilities([1, 2, 3]);
    expect(out.yes).toBe(1);
    expect(out.no).toBe(0);
  });

  it("échantillon vide → 50/50", () => {
    const out = computeNuffleOccursProbabilities([]);
    expect(out.yes).toBe(0.5);
    expect(out.no).toBe(0.5);
  });
});
