/**
 * Tests pour les helpers de configuration Sentry (tâche S25.2).
 *
 * Logique pure : pas de side-effect Sentry, juste les decisions d'init
 * (DSN gate + sample rate par environnement). Ces helpers sont consommes
 * par `sentry.client.config.ts` et `sentry.server.config.ts` qui appellent
 * `Sentry.init` uniquement si `isSentryEnabled` retourne true.
 */

import { describe, expect, it } from "vitest";

import {
  computeTracesSampleRate,
  isSentryEnabled,
  resolveSentryConfig,
} from "./sentry-config";

describe("isSentryEnabled", () => {
  it("retourne false si la DSN est absente (string vide)", () => {
    expect(isSentryEnabled({ dsn: "", environment: "production" })).toBe(false);
  });

  it("retourne false si la DSN est undefined", () => {
    expect(isSentryEnabled({ dsn: undefined, environment: "production" })).toBe(
      false,
    );
  });

  it("retourne false si la DSN ne ressemble pas a une URL https", () => {
    expect(
      isSentryEnabled({ dsn: "not-a-url", environment: "production" }),
    ).toBe(false);
  });

  it("retourne true si la DSN est une URL https valide", () => {
    expect(
      isSentryEnabled({
        dsn: "https://abc@o123.ingest.sentry.io/456",
        environment: "production",
      }),
    ).toBe(true);
  });
});

describe("computeTracesSampleRate", () => {
  it("retourne 0.1 (10%) en production", () => {
    expect(computeTracesSampleRate("production")).toBe(0.1);
  });

  it("retourne 1.0 (100%) en development pour faciliter le debug", () => {
    expect(computeTracesSampleRate("development")).toBe(1);
  });

  it("retourne 1.0 en preview/staging", () => {
    expect(computeTracesSampleRate("preview")).toBe(1);
    expect(computeTracesSampleRate("staging")).toBe(1);
  });

  it("retourne 0 en test pour ne jamais flooder Sentry depuis CI", () => {
    expect(computeTracesSampleRate("test")).toBe(0);
  });

  it("default a 0 quand l'environnement n'est pas reconnu", () => {
    expect(computeTracesSampleRate("unknown")).toBe(0);
  });
});

describe("resolveSentryConfig", () => {
  it("retourne disabled=true sans DSN, sans appeler Sentry", () => {
    const config = resolveSentryConfig({
      dsn: "",
      environment: "production",
      release: "1.74.0",
    });
    expect(config.enabled).toBe(false);
    expect(config.tracesSampleRate).toBe(0);
  });

  it("retourne enabled=true avec DSN valide en prod", () => {
    const config = resolveSentryConfig({
      dsn: "https://abc@o123.ingest.sentry.io/456",
      environment: "production",
      release: "1.74.0",
    });
    expect(config.enabled).toBe(true);
    expect(config.tracesSampleRate).toBe(0.1);
    expect(config.dsn).toBe("https://abc@o123.ingest.sentry.io/456");
    expect(config.environment).toBe("production");
    expect(config.release).toBe("1.74.0");
  });

  it("plafonne tracesSampleRate dans [0, 1]", () => {
    const negative = resolveSentryConfig({
      dsn: "https://abc@o123.ingest.sentry.io/456",
      environment: "production",
      release: undefined,
      tracesSampleRateOverride: -0.5,
    });
    expect(negative.tracesSampleRate).toBe(0);

    const above = resolveSentryConfig({
      dsn: "https://abc@o123.ingest.sentry.io/456",
      environment: "production",
      release: undefined,
      tracesSampleRateOverride: 5,
    });
    expect(above.tracesSampleRate).toBe(1);
  });

  it("permet de surcharger tracesSampleRate via env (string parsable)", () => {
    const config = resolveSentryConfig({
      dsn: "https://abc@o123.ingest.sentry.io/456",
      environment: "production",
      release: undefined,
      tracesSampleRateOverride: 0.25,
    });
    expect(config.tracesSampleRate).toBe(0.25);
  });
});
