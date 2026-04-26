/**
 * Core Web Vitals helpers (Q.20 — Sprint 23).
 *
 * - WEB_VITALS_THRESHOLDS : seuils Google "good" / "needsImprovement"
 *   pour LCP, INP, CLS, FCP, TTFB. Source officielle :
 *   https://web.dev/articles/vitals
 * - rateWebVital : map (metrique, valeur) -> rating ternaire
 * - WEB_VITALS_BUDGET : budget perf cible (= seuils good), utile pour
 *   les gates CI / dashboards
 * - exceedsWebVitalsBudget : compare une valeur au budget
 *
 * Pure : pas de DOM, pas d'I/O, totalement testable.
 */

export type WebVitalsName = "LCP" | "INP" | "CLS" | "FCP" | "TTFB";
export type WebVitalsRating = "good" | "needs-improvement" | "poor";

export interface WebVitalsThreshold {
  /** Borne haute "good" (incluse). */
  good: number;
  /** Borne haute "needs-improvement" (exclusive — au-dela : poor). */
  needsImprovement: number;
}

export const WEB_VITALS_THRESHOLDS: Record<WebVitalsName, WebVitalsThreshold> = {
  // Largest Contentful Paint (ms)
  LCP: { good: 2500, needsImprovement: 4000 },
  // Interaction to Next Paint (ms) — replaces FID since 2024
  INP: { good: 200, needsImprovement: 500 },
  // Cumulative Layout Shift (unitless)
  CLS: { good: 0.1, needsImprovement: 0.25 },
  // First Contentful Paint (ms)
  FCP: { good: 1800, needsImprovement: 3000 },
  // Time to First Byte (ms)
  TTFB: { good: 800, needsImprovement: 1800 },
};

/**
 * Budget perf cible : on vise au moins le rating "good" sur chaque
 * metrique. Cf. `exceedsWebVitalsBudget` pour la comparaison.
 */
export const WEB_VITALS_BUDGET: Record<WebVitalsName, number> = {
  LCP: WEB_VITALS_THRESHOLDS.LCP.good,
  INP: WEB_VITALS_THRESHOLDS.INP.good,
  CLS: WEB_VITALS_THRESHOLDS.CLS.good,
  FCP: WEB_VITALS_THRESHOLDS.FCP.good,
  TTFB: WEB_VITALS_THRESHOLDS.TTFB.good,
};

/**
 * Rate une mesure Core Web Vitals selon les seuils Google :
 *   - value <= good        -> "good"
 *   - value <= needsImpr.  -> "needs-improvement"
 *   - sinon                -> "poor"
 *
 * Les valeurs negatives (cas degenere) sont traitees comme good.
 */
export function rateWebVital(name: WebVitalsName, value: number): WebVitalsRating {
  const t = WEB_VITALS_THRESHOLDS[name];
  if (value <= t.good) return "good";
  if (value <= t.needsImprovement) return "needs-improvement";
  return "poor";
}

/**
 * Retourne `true` si la mesure depasse le budget perf cible.
 * Egalite stricte : une valeur EGALE au budget passe (= good).
 */
export function exceedsWebVitalsBudget(name: WebVitalsName, value: number): boolean {
  return value > WEB_VITALS_BUDGET[name];
}
