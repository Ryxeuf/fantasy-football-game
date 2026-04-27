import rateLimit from "express-rate-limit";
import type { Request } from "express";

// En mode test SQLite on désactive les rate limits — les suites E2E font
// énormément de login/register en rafale et dépasseraient les quotas de prod.
const TEST_MODE = process.env.TEST_SQLITE === "1";

/**
 * IPs whitelistées (pas de rate limiting).
 * Configuré via RATE_LIMIT_WHITELIST (IPs séparées par des virgules).
 */
const WHITELISTED_IPS: Set<string> = new Set(
  (process.env.RATE_LIMIT_WHITELIST || "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean),
);

export function isWhitelisted(req: Request): boolean {
  return WHITELISTED_IPS.has(req.ip || "");
}

// Quotas exportés pour permettre aux tests et au monitoring de valider
// la configuration sans dépendre des internals d'express-rate-limit.
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const AUTH_RATE_LIMIT_MAX_PROD = 10;
export const API_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const API_RATE_LIMIT_MAX_PROD = 100;

/**
 * Rate limiter strict pour les routes sensibles d'authentification.
 * 10 requêtes par fenêtre de 15 minutes par IP sur /login, /register.
 */
export const authRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: TEST_MODE ? 10_000 : AUTH_RATE_LIMIT_MAX_PROD,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isWhitelisted,
  message: {
    error:
      "Trop de tentatives. Veuillez réessayer dans quelques instants.",
  },
});

/**
 * Rate limiter global pour toutes les routes API.
 * 100 requêtes par minute par IP.
 */
export const apiRateLimiter = rateLimit({
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  max: TEST_MODE ? 100_000 : API_RATE_LIMIT_MAX_PROD,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isWhitelisted,
  message: {
    error:
      "Trop de requêtes. Veuillez réessayer dans quelques instants.",
  },
});
