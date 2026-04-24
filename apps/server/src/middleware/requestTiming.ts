import type { Request, Response, NextFunction } from "express";

/**
 * Logs `method path status duration_ms` for every HTTP request. Slow calls
 * (>= `warnThresholdMs`) are emitted at warn level so they stand out in logs.
 * Keeps the implementation in-process to avoid a full observability stack,
 * but is enough to pinpoint where an occasional >1s response comes from.
 *
 * `REQUEST_LOG=1` enables per-request info logging (useful when Loki is the
 * only view into what the API is doing). Healthcheck probes are silenced
 * unless they fail or run slow, since they fire every ~30s and would
 * otherwise dominate the stream.
 */
export function requestTiming(warnThresholdMs = 500) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const line = `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${durationMs.toFixed(1)}ms`;
      if (durationMs >= warnThresholdMs) {
        console.warn(`[slow] ${line}`);
        return;
      }
      if (process.env.REQUEST_LOG !== "1") return;
      const isHealth = req.path === "/health" && res.statusCode < 400;
      if (isHealth) return;
      console.log(line);
    });
    next();
  };
}
