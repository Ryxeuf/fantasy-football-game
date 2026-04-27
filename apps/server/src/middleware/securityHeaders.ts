import helmet from "helmet";
import type { RequestHandler } from "express";

/**
 * Security headers envelope for the API. Sets HSTS (1 year, includeSubDomains,
 * preload), X-Frame-Options DENY, X-Content-Type-Options nosniff, a strict
 * Referrer-Policy and a baseline CSP that ships in Report-Only mode by default
 * so it can be observed in production before being enforced.
 *
 * CSP is configurable via SECURITY_CSP_MODE:
 *   - "report-only" (default): Content-Security-Policy-Report-Only header
 *   - "enforce": Content-Security-Policy header
 *   - "off": no CSP header (escape hatch for emergencies)
 *
 * The directive set is intentionally permissive at first (allows 'unsafe-inline'
 * for styles to keep Tailwind happy and 'self' for scripts) so we can roll out
 * the rest of the envelope without breaking Pixi.js bundles, Umami analytics
 * or inline styles. Tightening to nonces/hashes is a follow-up task.
 */
const ONE_YEAR_SECONDS = 31_536_000;

type CspMode = "report-only" | "enforce" | "off";

function resolveCspMode(): CspMode {
  const raw = (process.env.SECURITY_CSP_MODE || "report-only").toLowerCase();
  if (raw === "enforce" || raw === "off") return raw;
  return "report-only";
}

export function securityHeaders(): RequestHandler {
  const cspMode = resolveCspMode();

  const cspDirectives = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:", "https:"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    "connect-src": ["'self'", "https:", "wss:"],
    "worker-src": ["'self'", "blob:"],
    "form-action": ["'self'"],
  };

  const cspOption =
    cspMode === "off"
      ? false
      : {
          useDefaults: false,
          directives: cspDirectives,
          reportOnly: cspMode === "report-only",
        };

  return helmet({
    contentSecurityPolicy: cspOption,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    strictTransportSecurity: {
      maxAge: ONE_YEAR_SECONDS,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: "deny" },
    noSniff: true,
    hidePoweredBy: true,
  });
}
