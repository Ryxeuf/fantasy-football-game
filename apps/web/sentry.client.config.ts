/**
 * Sentry client-side init (tâche S25.2 — Sprint 25).
 *
 * Initialisation guardee par DSN : aucune call si `NEXT_PUBLIC_SENTRY_DSN`
 * est absente, ce qui permet de garder le SDK present sans envoyer de
 * traffic en dev local ou en preview sans projet Sentry.
 *
 * Le sample rate est calcule via `app/lib/sentry-config.ts` (10% en prod,
 * 100% en dev/preview/staging, 0 en test). Override possible via
 * `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`.
 */

import * as Sentry from "@sentry/nextjs";

import {
  readSampleRateOverride,
  resolveSentryConfig,
} from "./app/lib/sentry-config";

const config = resolveSentryConfig({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
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
    // Replays : off par defaut. Q.20 monitore deja les Web Vitals via
    // Umami, donc on n'active pas Session Replay tant qu'on n'a pas
    // un budget clair sur le volume.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Pas d'auto-instrumentation des fetch sortants : Q.20 et le
    // serveur loguent deja la latence cote pino.
    integrations: [],
  });
}
