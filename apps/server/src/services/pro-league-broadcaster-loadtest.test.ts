/**
 * Tests pour le harnais de load test broadcaster (Lot 4.C.1).
 *
 * On reste sur des configs très petites (1-3 matches × 10-50
 * subscribers × 5-10 events) pour rester sous quelques centaines de
 * ms. Les tests couvrent :
 *
 *   - sortie cohérente (totalListenerInvocations = matches × subscribers
 *     × events, dispatch lag p99 borné).
 *   - cas zero : `matches=0` resolve immédiatement avec 0 dispatched.
 *   - les percentiles sont correctement calculés.
 */

import { describe, expect, it } from "vitest";

import {
  formatLoadTestReport,
  runBroadcasterLoadTest,
} from "./pro-league-broadcaster-loadtest";

describe("runBroadcasterLoadTest — Lot 4.C.1", () => {
  it("dispatch tous les events à chaque subscriber", async () => {
    const out = await runBroadcasterLoadTest({
      matches: 2,
      subscribers: 5,
      events: 4,
      eventSpacingMs: 10,
      tickIntervalMs: 10,
    });
    // Chaque event est dispatché 1 fois par session, l'emitter.emit
    // invoque chaque listener (= subscribers).
    expect(out.totalEventsDispatched).toBe(2 * 4);
    expect(out.totalListenerInvocations).toBe(2 * 5 * 4);
    expect(out.dispatchLagMs.max).toBeGreaterThanOrEqual(0);
    expect(out.dispatchLagMs.p99).toBeGreaterThanOrEqual(out.dispatchLagMs.p50);
    expect(out.config.matches).toBe(2);
  });

  it("matches=0 resolve immédiatement", async () => {
    const out = await runBroadcasterLoadTest({
      matches: 0,
      subscribers: 100,
      events: 50,
    });
    expect(out.totalEventsDispatched).toBe(0);
    expect(out.totalListenerInvocations).toBe(0);
    expect(out.durationMs).toBeLessThan(50);
  });

  it("scale les listener invocations linéairement avec subscribers", async () => {
    const small = await runBroadcasterLoadTest({
      matches: 1,
      subscribers: 10,
      events: 3,
      eventSpacingMs: 5,
      tickIntervalMs: 5,
    });
    const big = await runBroadcasterLoadTest({
      matches: 1,
      subscribers: 50,
      events: 3,
      eventSpacingMs: 5,
      tickIntervalMs: 5,
    });
    // 5x plus de subscribers = 5x plus d'invocations pour le même
    // nombre d'events.
    expect(big.totalListenerInvocations).toBe(5 * small.totalListenerInvocations);
  });

  it("expose CPU + memory dans le résultat", async () => {
    const out = await runBroadcasterLoadTest({
      matches: 1,
      subscribers: 20,
      events: 3,
      eventSpacingMs: 5,
      tickIntervalMs: 5,
    });
    expect(out.cpuMs.user).toBeGreaterThanOrEqual(0);
    expect(out.cpuMs.system).toBeGreaterThanOrEqual(0);
    expect(out.memoryMb.rss).toBeGreaterThan(0);
    expect(out.memoryMb.heapUsed).toBeGreaterThan(0);
  });
});

describe("formatLoadTestReport — Lot 4.C.1", () => {
  it("imprime config + percentiles + ressources", async () => {
    const result = await runBroadcasterLoadTest({
      matches: 1,
      subscribers: 10,
      events: 3,
      eventSpacingMs: 5,
      tickIntervalMs: 5,
    });
    const report = formatLoadTestReport(result);
    expect(report).toContain("Broadcaster load test");
    expect(report).toContain("matches × 10 subscribers");
    expect(report).toContain("Dispatch lag (ms)");
    expect(report).toContain("CPU user/system");
    expect(report).toContain("RSS / heapUsed");
  });
});
