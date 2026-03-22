import rateLimit from "express-rate-limit";

/**
 * Rate limiter strict pour les routes d'authentification.
 * 5 requêtes par minute par IP sur /login, /register.
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
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
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      "Trop de requêtes. Veuillez réessayer dans quelques instants.",
  },
});
