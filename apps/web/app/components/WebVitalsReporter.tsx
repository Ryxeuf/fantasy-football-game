"use client";

/**
 * Core Web Vitals reporter (Q.20 — Sprint 23).
 *
 * Branche `useReportWebVitals` (built-in Next.js) sur trackUmamiEvent
 * pour faire remonter les LCP / INP / CLS / FCP / TTFB dans Umami.
 * Chaque event inclut le rating ('good' / 'needs-improvement' / 'poor')
 * derive des seuils Google pour faciliter l'agregation cote dashboard.
 */

import { useReportWebVitals } from "next/web-vitals";
import {
  rateWebVital,
  type WebVitalsName,
  WEB_VITALS_THRESHOLDS,
} from "../lib/web-vitals";
import { trackUmamiEvent, type UmamiEventName } from "../lib/umami-events";

const KNOWN_NAMES = new Set<WebVitalsName>(
  Object.keys(WEB_VITALS_THRESHOLDS) as WebVitalsName[],
);

function isKnownName(value: string): value is WebVitalsName {
  return KNOWN_NAMES.has(value as WebVitalsName);
}

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    const name = metric.name;
    if (!isKnownName(name)) return;
    const rating = rateWebVital(name, metric.value);
    trackUmamiEvent("web-vitals" as UmamiEventName, {
      name,
      // Arrondi a l'entier pour LCP/INP/FCP/TTFB (ms), 3 decimales pour CLS.
      value: name === "CLS" ? Number(metric.value.toFixed(3)) : Math.round(metric.value),
      rating,
      navigationType: metric.navigationType,
    });
  });

  return null;
}
