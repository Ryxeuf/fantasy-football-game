/**
 * Next.js 14 instrumentation hook (tâche S25.2 — Sprint 25).
 *
 * Charge la config Sentry appropriee selon le runtime. Next.js appelle
 * cette fonction une seule fois au demarrage du process. Sentry
 * @sentry/nextjs fournit un helper `captureRequestError` qu'on expose
 * pour brancher l'auto-capture des erreurs de routes server-side.
 */

import * as Sentry from "@sentry/nextjs";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
