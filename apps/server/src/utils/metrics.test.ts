/**
 * Tests pour le registre Prometheus (tâche S25.3).
 *
 * On instancie un registre dedié par test pour eviter le state global et
 * verifier les helpers metiers (`recordPassAttempt`, `recordArmorBreak`,
 * gauges) et le rendu texte Prometheus (`exposition`).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildMetricsRegistry,
  metricsExposition,
  type MetricsRegistry,
} from "./metrics";

describe("metrics registry", () => {
  let metrics: MetricsRegistry;

  beforeEach(() => {
    metrics = buildMetricsRegistry();
  });

  afterEach(() => {
    metrics.registry.clear();
  });

  describe("custom metrics declared", () => {
    it("declare les 5 metriques custom requises par S25.3", async () => {
      const text = await metricsExposition(metrics.registry);
      expect(text).toContain("match_active_count");
      expect(text).toContain("matchmaking_queue_size");
      expect(text).toContain("ws_connections_open");
      expect(text).toContain("pass_attempts_total");
      expect(text).toContain("armor_break_total");
    });

    it("expose un histogramme de latence HTTP avec p95", async () => {
      // Quelques observations pour que p95 soit calculable.
      for (const ms of [10, 50, 80, 120, 200, 350, 500, 750, 1200]) {
        metrics.observeHttpDuration({ method: "GET", route: "/x", statusCode: 200 }, ms);
      }
      const text = await metricsExposition(metrics.registry);
      expect(text).toContain("http_request_duration_ms");
      expect(text).toMatch(/http_request_duration_ms_bucket\{[^}]*le="500"/);
    });
  });

  describe("counters & gauges", () => {
    it("recordPassAttempt incremente avec labels result", async () => {
      metrics.recordPassAttempt("success");
      metrics.recordPassAttempt("success");
      metrics.recordPassAttempt("fumble");
      expect(await metrics.snapshotCounter("pass_attempts_total")).toEqual({
        success: 2,
        fumble: 1,
      });
    });

    it("recordArmorBreak incremente armor_break_total", async () => {
      metrics.recordArmorBreak();
      metrics.recordArmorBreak();
      metrics.recordArmorBreak();
      expect((await metrics.snapshotCounter("armor_break_total")).default).toBe(
        3,
      );
    });

    it("setMatchActiveCount met a jour la gauge", async () => {
      metrics.setMatchActiveCount(42);
      expect(await metrics.snapshotGauge("match_active_count")).toBe(42);
      metrics.setMatchActiveCount(0);
      expect(await metrics.snapshotGauge("match_active_count")).toBe(0);
    });

    it("setMatchmakingQueueSize/setWsConnectionsOpen mettent a jour leurs gauges", async () => {
      metrics.setMatchmakingQueueSize(7);
      metrics.setWsConnectionsOpen(13);
      expect(await metrics.snapshotGauge("matchmaking_queue_size")).toBe(7);
      expect(await metrics.snapshotGauge("ws_connections_open")).toBe(13);
    });

    it("rejette les valeurs negatives sur les gauges (clamp a 0)", async () => {
      metrics.setMatchActiveCount(-3);
      expect(await metrics.snapshotGauge("match_active_count")).toBe(0);
    });
  });

  describe("exposition format", () => {
    it("retourne du texte au content-type Prometheus", async () => {
      const text = await metricsExposition(metrics.registry);
      expect(typeof text).toBe("string");
      expect(text).toContain("# HELP");
      expect(text).toContain("# TYPE");
    });
  });
});
