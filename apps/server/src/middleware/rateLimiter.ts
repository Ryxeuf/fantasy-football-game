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

function isWhitelisted(req: Request): boolean {
  return WHITELISTED_IPS.has(req.ip || "");
}

/**
 * Rate limiter strict pour les routes sensibles d'authentification.
 * 10 requêtes par fenêtre de 15 minutes par IP sur /login, /register.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: TEST_MODE ? 10_000 : 10,
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
  windowMs: 60 * 1000, // 1 minute
  max: TEST_MODE ? 100_000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isWhitelisted,
  message: {
    error:
      "Trop de requêtes. Veuillez réessayer dans quelques instants.",
  },
});
