/**
 * Sentry edge runtime init (tâche S25.2 — Sprint 25).
 *
 * Couvre les middlewares Next.js et les routes edge. Meme guard DSN
 * que les configs client/server pour eviter les call sans projet
 * Sentry configure.
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
