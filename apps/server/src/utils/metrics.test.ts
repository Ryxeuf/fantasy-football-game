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

  describe("Pro League sim metrics (Lot 2.A.2)", () => {
    it("declare toutes les metriques nuffle_* attendues", async () => {
      // Touch chaque métrique au moins une fois pour qu'elle apparaisse
      // dans la sortie Prometheus (les histogrammes/counters non touchés
      // peuvent être omis du rendu).
      metrics.observeSimMatchDuration(
        { engineVer: "0.16.0", driver: "hybrid", outcome: "home" },
        0.05,
      );
      metrics.recordSimMatch({ status: "success", driver: "hybrid" });
      metrics.observeReplaySize({ engineVer: "0.16.0" }, 4096);
      metrics.setBroadcasterActiveSessions(3);
      metrics.setBroadcasterTotalSubscribers(12);
      metrics.observeBroadcasterDispatchLag(45);
      metrics.setEngineDrift(
        { metric: "tdMean", race: "Wood Elf", seasonId: "S2026" },
        0.04,
      );
      const text = await metricsExposition(metrics.registry);
      for (const name of [
        "nuffle_sim_match_duration_seconds",
        "nuffle_sim_match_total",
        "nuffle_replay_size_bytes",
        "nuffle_broadcaster_active_sessions",
        "nuffle_broadcaster_total_subscribers",
        "nuffle_broadcaster_event_dispatch_lag_ms",
        "nuffle_engine_drift",
      ]) {
        expect(text).toContain(name);
      }
    });

    it("recordSimMatch incremente le compteur par labels {status, driver}", async () => {
      metrics.recordSimMatch({ status: "success", driver: "hybrid" });
      metrics.recordSimMatch({ status: "success", driver: "hybrid" });
      metrics.recordSimMatch({ status: "failed", driver: "hybrid" });
      metrics.recordSimMatch({ status: "success", driver: "full" });
      const text = await metricsExposition(metrics.registry);
      expect(text).toMatch(/nuffle_sim_match_total\{[^}]*status="success"[^}]*driver="hybrid"[^}]*\} 2/);
      expect(text).toMatch(/nuffle_sim_match_total\{[^}]*status="failed"[^}]*driver="hybrid"[^}]*\} 1/);
      expect(text).toMatch(/nuffle_sim_match_total\{[^}]*status="success"[^}]*driver="full"[^}]*\} 1/);
    });

    it("setBroadcasterActiveSessions / setBroadcasterTotalSubscribers clampent a 0", async () => {
      metrics.setBroadcasterActiveSessions(-5);
      metrics.setBroadcasterTotalSubscribers(-1);
      expect(await metrics.snapshotGauge("nuffle_broadcaster_active_sessions")).toBe(0);
      expect(await metrics.snapshotGauge("nuffle_broadcaster_total_subscribers")).toBe(0);
      metrics.setBroadcasterActiveSessions(7);
      metrics.setBroadcasterTotalSubscribers(42);
      expect(await metrics.snapshotGauge("nuffle_broadcaster_active_sessions")).toBe(7);
      expect(await metrics.snapshotGauge("nuffle_broadcaster_total_subscribers")).toBe(42);
    });

    it("observeBroadcasterDispatchLag clamp les valeurs <=0 a 0", async () => {
      // Si le wallclock recule, on observe 0 plutôt que de polluer.
      metrics.observeBroadcasterDispatchLag(-50);
      metrics.observeBroadcasterDispatchLag(120);
      const text = await metricsExposition(metrics.registry);
      expect(text).toContain("nuffle_broadcaster_event_dispatch_lag_ms");
      // Bucket le=200 doit avoir capturé l'observation 120ms.
      expect(text).toMatch(/nuffle_broadcaster_event_dispatch_lag_ms_bucket\{le="200"\} [12]/);
    });

    it("setEngineDrift accepte des valeurs positives et negatives", async () => {
      metrics.setEngineDrift(
        { metric: "tdMean", race: "Halfling", seasonId: "S2026" },
        -0.08,
      );
      metrics.setEngineDrift(
        { metric: "tdMean", race: "Wood Elf", seasonId: "S2026" },
        0.05,
      );
      const text = await metricsExposition(metrics.registry);
      expect(text).toMatch(/nuffle_engine_drift\{[^}]*race="Halfling"[^}]*\} -0\.08/);
      expect(text).toMatch(/nuffle_engine_drift\{[^}]*race="Wood Elf"[^}]*\} 0\.05/);
    });

    it("observeSimMatchDuration peuple l'histogramme avec les buckets attendus", async () => {
      for (const seconds of [0.04, 0.08, 0.5, 1.5, 4.0]) {
        metrics.observeSimMatchDuration(
          { engineVer: "0.16.0", driver: "hybrid", outcome: "home" },
          seconds,
        );
      }
      const text = await metricsExposition(metrics.registry);
      // Bucket le=5 capture toutes les observations <= 5s.
      expect(text).toMatch(/nuffle_sim_match_duration_seconds_bucket\{[^}]*le="5"[^}]*\} 5/);
    });
  });
});
