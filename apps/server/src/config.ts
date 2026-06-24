/**
 * Centralized configuration for secrets and environment variables.
 *
 * In production (NODE_ENV=production), missing secrets cause an immediate crash
 * to prevent the server from running with insecure fallback values.
 * In development/test, sensible defaults are used for convenience.
 */

function getRequiredSecret(name: string, devDefault: string): string {
  const value = process.env[name];
  if (value) return value;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `FATAL: Missing required environment variable "${name}". ` +
        `The server cannot start in production without it.`,
    );
  }

  return devDefault;
}

export const JWT_SECRET = getRequiredSecret(
  "JWT_SECRET",
  "dev-secret-change-me",
);

export const MATCH_SECRET = getRequiredSecret(
  "MATCH_SECRET",
  "dev-match-secret",
);

/**
 * Allowed CORS origins, parsed from a comma-separated env var.
 * In production, CORS_ORIGINS must be set explicitly.
 * In dev/test, defaults to the Next.js dev server origin.
 */
function parseCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS;
  if (raw) {
    return raw
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `FATAL: Missing required environment variable "CORS_ORIGINS". ` +
        `The server cannot start in production without it.`,
    );
  }

  return ["http://localhost:3100"];
}

export const CORS_ORIGINS: string[] = parseCorsOrigins();

/**
 * Résout l'origine web absolue à utiliser pour construire des liens dans les
 * e-mails (acceptation d'invitation, reset password…). On valide le header
 * `Origin` de la requête contre `CORS_ORIGINS` (anti-spoofing) ; à défaut on
 * retombe sur `FRONTEND_PUBLIC_URL` puis sur le défaut prod. Même logique que
 * `routes/auth.ts` (forgot-password), centralisée ici pour réutilisation.
 */
export function resolveWebOrigin(rawOriginHeader: string | undefined): string {
  const rawOrigin = (rawOriginHeader || "").toString().slice(0, 256);
  const allowedOrigin = CORS_ORIGINS.includes(rawOrigin) ? rawOrigin : null;
  return (
    allowedOrigin ||
    process.env.FRONTEND_PUBLIC_URL ||
    "https://nufflearena.fr"
  );
}

/**
 * Verification token that Ko-fi includes in every webhook payload.
 * Set it in your Ko-fi webhook settings and export it as env here.
 * In dev/test a fixed fallback is used so local tests run without env setup.
 */
export const KOFI_VERIFICATION_TOKEN: string = getRequiredSecret(
  "KOFI_VERIFICATION_TOKEN",
  "dev-kofi-verification-token",
);
