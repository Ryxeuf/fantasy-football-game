/**
 * Helpers de configuration Sentry (tâche S25.2 — Sprint 25).
 *
 * Centralise la decision « doit-on initialiser Sentry et avec quel
 * sample rate ? ». Garde la logique pure pour la tester unitairement,
 * sans toucher l'API Sentry. Les fichiers `sentry.{client,server}.config.ts`
 * consomment ces helpers et appellent `Sentry.init(config)` uniquement
 * quand `enabled` est vrai.
 *
 * Sample rate par defaut :
 *   - production : 0.1 (10%) — Q.20 monitor deja LCP/INP/CLS, on veut
 *     juste capter les exceptions + un echantillon de transactions.
 *   - preview / staging : 1.0 — pour valider l'integration avant prod.
 *   - development : 1.0 — pour debug local.
 *   - test : 0 — silence en CI, jamais de network call.
 *
 * Override possible via `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`.
 */

export interface SentryConfigInput {
  dsn: string | undefined;
  environment: string;
  release?: string;
  /** Override numerique (0..1). Si non-numerique ou hors bornes, ignore. */
  tracesSampleRateOverride?: number;
}

export interface SentryConfig {
  enabled: boolean;
  dsn: string;
  environment: string;
  release: string | undefined;
  tracesSampleRate: number;
}

const DSN_PATTERN = /^https?:\/\/[^@]+@[^/]+\/\d+$/;

/** Vrai si la DSN est presente et ressemble a une URL Sentry valide. */
export function isSentryEnabled(input: {
  dsn: string | undefined;
  environment: string;
}): boolean {
  if (!input.dsn) return false;
  return DSN_PATTERN.test(input.dsn);
}

/** Sample rate par defaut selon l'environnement. */
export function computeTracesSampleRate(environment: string): number {
  switch (environment) {
    case "production":
      return 0.1;
    case "preview":
    case "staging":
    case "development":
      return 1;
    case "test":
      return 0;
    default:
      return 0;
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Resout la configuration finale. Si Sentry n'est pas enabled, on
 * retourne quand meme un objet pour eviter le cout d'un null-check
 * cote consommateur. Les call sites doivent regarder `enabled` avant
 * d'appeler `Sentry.init(...)`.
 */
export function resolveSentryConfig(input: SentryConfigInput): SentryConfig {
  const enabled = isSentryEnabled(input);
  const baseRate = computeTracesSampleRate(input.environment);
  const tracesSampleRate =
    input.tracesSampleRateOverride !== undefined
      ? clamp01(input.tracesSampleRateOverride)
      : enabled
        ? baseRate
        : 0;

  return {
    enabled,
    dsn: input.dsn ?? "",
    environment: input.environment,
    release: input.release,
    tracesSampleRate,
  };
}

/**
 * Lit l'override `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` depuis les
 * variables d'environnement. Retourne `undefined` si absent ou non
 * parsable comme nombre.
 */
export function readSampleRateOverride(
  env: Record<string, string | undefined>,
): number | undefined {
  const raw = env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE;
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}
