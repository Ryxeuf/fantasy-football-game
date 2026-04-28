/**
 * Sentry server-side init (tâche S25.2 — Sprint 25).
 *
 * Couvre les erreurs server-only de Next.js (route handlers, server
 * components, server actions). Le serveur Express vit a part dans
 * `apps/server/` et a son propre logger pino (S25.1) — on ne le double
 * pas avec Sentry tant que pino + Loki ne sont pas branches en prod.
 */

import * as Sentry from "@sentry/nextjs";

import {
  readSampleRateOverride,
  resolveSentryConfig,
} from "./app/lib/sentry-config";

const config = resolveSentryConfig({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment:
    process.env.SENTRY_ENVIRONMENT ||
    process.env.NODE_ENV ||
    "production",
  release: process.env.NEXT_PUBLIC_APP_VERSION,
  tracesSampleRateOverride: readSampleRateOverride(
    process.env as Record<string, string | undefined>,
  ),
});

if (config.enabled) {
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    tracesSampleRate: config.tracesSampleRate,
    integrations: [],
  });
}
