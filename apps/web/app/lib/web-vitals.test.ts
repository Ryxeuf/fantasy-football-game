/**
 * Tests pour le helper Core Web Vitals (Q.20 — Sprint 23).
 *
 * Le helper :
 *   - rateWebVital : map metrique + valeur -> rating "good" /
 *     "needs-improvement" / "poor" via les seuils Google officiels
 *   - WEB_VITALS_BUDGET : budget perf cible (seuils "good")
 *   - exceedsWebVitalsBudget : compare une valeur au budget
 *     (utile pour gates CI / alerting)
 */
import { describe, it, expect } from "vitest";
import {
  rateWebVital,
  WEB_VITALS_BUDGET,
  exceedsWebVitalsBudget,
  WEB_VITALS_THRESHOLDS,
  type WebVitalsName,
} from "./web-vitals";

describe("WEB_VITALS_THRESHOLDS", () => {
  it("expose les 5 metriques cibles avec un seuil good et needsImprovement", () => {
    const names: WebVitalsName[] = ["LCP", "INP", "CLS", "FCP", "TTFB"];
    for (const name of names) {
      const t = WEB_VITALS_THRESHOLDS[name];
      expect(t.good).toBeDefined();
      expect(t.needsImprovement).toBeDefined();
      expect(t.good).toBeLessThan(t.needsImprovement);
    }
  });

  it("respecte les seuils Google officiels sur LCP / INP / CLS", () => {
    expect(WEB_VITALS_THRESHOLDS.LCP).toEqual({ good: 2500, needsImprovement: 4000 });
    expect(WEB_VITALS_THRESHOLDS.INP).toEqual({ good: 200, needsImprovement: 500 });
    expect(WEB_VITALS_THRESHOLDS.CLS).toEqual({ good: 0.1, needsImprovement: 0.25 });
  });
});

describe("rateWebVital", () => {
  it("retourne good quand value < seuil good", () => {
    expect(rateWebVital("LCP", 1500)).toBe("good");
    expect(rateWebVital("CLS", 0.05)).toBe("good");
    expect(rateWebVital("INP", 100)).toBe("good");
  });

  it("retourne needs-improvement entre good et needsImprovement", () => {
    expect(rateWebVital("LCP", 3000)).toBe("needs-improvement");
    expect(rateWebVital("CLS", 0.15)).toBe("needs-improvement");
    expect(rateWebVital("INP", 350)).toBe("needs-improvement");
  });

  it("retourne poor au-dela du seuil needsImprovement", () => {
    expect(rateWebVital("LCP", 5000)).toBe("poor");
    expect(rateWebVital("CLS", 0.5)).toBe("poor");
    expect(rateWebVital("INP", 800)).toBe("poor");
  });

  it("traite les valeurs egales au seuil good comme good (borne inclusive cote bas)", () => {
    expect(rateWebVital("LCP", 2500)).toBe("good");
    expect(rateWebVital("CLS", 0.1)).toBe("good");
  });

  it("traite les valeurs negatives comme good (cas degenere)", () => {
    expect(rateWebVital("LCP", -10)).toBe("good");
  });
});

describe("WEB_VITALS_BUDGET", () => {
  it("est defini et matche les seuils good", () => {
    for (const name of Object.keys(WEB_VITALS_BUDGET) as WebVitalsName[]) {
      expect(WEB_VITALS_BUDGET[name]).toBe(WEB_VITALS_THRESHOLDS[name].good);
    }
  });
});

describe("exceedsWebVitalsBudget", () => {
  it("retourne false quand value <= budget", () => {
    expect(exceedsWebVitalsBudget("LCP", 2000)).toBe(false);
    expect(exceedsWebVitalsBudget("LCP", 2500)).toBe(false);
  });

  it("retourne true quand value > budget", () => {
    expect(exceedsWebVitalsBudget("LCP", 3000)).toBe(true);
    expect(exceedsWebVitalsBudget("CLS", 0.5)).toBe(true);
    expect(exceedsWebVitalsBudget("INP", 600)).toBe(true);
  });
});
