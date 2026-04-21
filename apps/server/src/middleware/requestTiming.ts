import type { Request, Response, NextFunction } from "express";

/**
 * Logs `method path status duration_ms` for every HTTP request. Slow calls
 * (>= `warnThresholdMs`) are emitted at warn level so they stand out in logs.
 * Keeps the implementation in-process to avoid a full observability stack,
 * but is enough to pinpoint where an occasional >1s response comes from.
 */
export function requestTiming(warnThresholdMs = 500) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const line = `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${durationMs.toFixed(1)}ms`;
      if (durationMs >= warnThresholdMs) {
        console.warn(`[slow] ${line}`);
      } else if (process.env.REQUEST_LOG === "1") {
        console.log(line);
      }
    });
    next();
  };
}
