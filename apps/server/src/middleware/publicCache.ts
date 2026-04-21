import type { Request, Response, NextFunction } from "express";

/**
 * HTTP caching middleware for public reference endpoints (rosters, skills,
 * positions). These payloads change only when the database is reseeded, so
 * clients and edge caches can safely serve a stored copy for an hour while
 * revalidating in the background.
 *
 * Applied as a pre-handler: the header is written before the route runs, and
 * routes that return an error should call `res.setHeader('Cache-Control',
 * 'no-store')` themselves before sending (Express lets you override headers
 * up to the moment they're flushed to the wire).
 */
export function publicCache(maxAgeSeconds = 3600, swrSeconds = 86400) {
  const value = `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${swrSeconds}`;
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", value);
    res.setHeader("Vary", "Accept-Encoding");
    next();
  };
}
