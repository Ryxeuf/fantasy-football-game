/**
 * Métriques Prometheus (tâche S25.3 — Sprint 25).
 *
 * Expose 5 metriques custom requises par la roadmap + un histogramme de
 * latence HTTP. Chaque metrique est isolee dans son propre `Registry`
 * ou un registre injecte, afin de pouvoir instancier un mock dans les
 * tests sans polluer le state global.
 *
 * Metriques :
 *   - match_active_count        gauge   (matches en cours, mis a jour
 *                                        par game-rooms.ts)
 *   - matchmaking_queue_size    gauge   (utilisateurs en queue, mis a
 *                                        jour par services/matchmaking.ts)
 *   - ws_connections_open       gauge   (sockets actives, mis a jour
 *                                        par socket.ts)
 *   - pass_attempts_total       counter (label `result` : success/fumble/
 *                                        intercepted/inaccurate)
 *   - armor_break_total         counter (armor rolls reussis cote
 *                                        attaquant)
 *   - http_request_duration_ms  histogram(method, route, statusCode)
 *
 * Le serveur expose `metricsHandler` sur `/metrics`, format
 * Prometheus standard text/plain.
 */

import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";

export type PassResult =
  | "success"
  | "fumble"
  | "intercepted"
  | "inaccurate";

export interface HttpDurationLabels {
  method: string;
  route: string;
  statusCode: number;
}

export interface MetricsRegistry {
  readonly registry: Registry;

  /** Incremente `pass_attempts_total{result}`. */
  recordPassAttempt(result: PassResult): void;
  /** Incremente `armor_break_total`. */
  recordArmorBreak(): void;
  /** Set `match_active_count` (clamp a 0 si negatif). */
  setMatchActiveCount(value: number): void;
  /** Set `matchmaking_queue_size` (clamp a 0 si negatif). */
  setMatchmakingQueueSize(value: number): void;
  /** Set `ws_connections_open` (clamp a 0 si negatif). */
  setWsConnectionsOpen(value: number): void;
  /** Observe une duree HTTP (en ms). */
  observeHttpDuration(labels: HttpDurationLabels, ms: number): void;

  /** Helper test : retourne la valeur courante d'une gauge. */
  snapshotGauge(name: string): Promise<number>;
  /** Helper test : retourne les valeurs par label d'un counter. */
  snapshotCounter(name: string): Promise<Record<string, number>>;
}

/** Buckets en millisecondes alignes sur des seuils SLO communs. */
const HTTP_DURATION_BUCKETS_MS = [
  10, 25, 50, 100, 200, 350, 500, 750, 1000, 2500, 5000, 10000,
];

export function buildMetricsRegistry(): MetricsRegistry {
  const registry = new Registry();

  // process_cpu, process_resident_memory, nodejs_heap_*, etc. Tres utile
  // sur Grafana sans cout supplementaire dans le code metier.
  collectDefaultMetrics({ register: registry });

  const matchActiveCount = new Gauge({
    name: "match_active_count",
    help: "Nombre de matches en cours sur le serveur",
    registers: [registry],
  });
  const matchmakingQueueSize = new Gauge({
    name: "matchmaking_queue_size",
    help: "Nombre d'utilisateurs en attente de matchmaking",
    registers: [registry],
  });
  const wsConnectionsOpen = new Gauge({
    name: "ws_connections_open",
    help: "Nombre de connexions Socket.IO ouvertes",
    registers: [registry],
  });
  const passAttemptsTotal = new Counter({
    name: "pass_attempts_total",
    help: "Tentatives de passe (label result : success/fumble/intercepted/inaccurate)",
    labelNames: ["result"],
    registers: [registry],
  });
  const armorBreakTotal = new Counter({
    name: "armor_break_total",
    help: "Armures cassees cote attaquant",
    registers: [registry],
  });
  const httpRequestDuration = new Histogram({
    name: "http_request_duration_ms",
    help: "Duree des requetes HTTP en millisecondes",
    labelNames: ["method", "route", "statusCode"],
    buckets: HTTP_DURATION_BUCKETS_MS,
    registers: [registry],
  });

  const clamp = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

  return {
    registry,
    recordPassAttempt(result: PassResult) {
      passAttemptsTotal.inc({ result });
    },
    recordArmorBreak() {
      armorBreakTotal.inc();
    },
    setMatchActiveCount(value: number) {
      matchActiveCount.set(clamp(value));
    },
    setMatchmakingQueueSize(value: number) {
      matchmakingQueueSize.set(clamp(value));
    },
    setWsConnectionsOpen(value: number) {
      wsConnectionsOpen.set(clamp(value));
    },
    observeHttpDuration(labels, ms) {
      httpRequestDuration.observe(
        {
          method: labels.method,
          route: labels.route,
          statusCode: String(labels.statusCode),
        },
        ms,
      );
    },

    async snapshotGauge(name) {
      const metric = registry.getSingleMetric(name);
      if (!metric) return 0;
      const payload = (await (metric as Gauge).get()) as {
        values: Array<{ value: number }>;
      };
      return payload.values[0]?.value ?? 0;
    },
    async snapshotCounter(name) {
      const metric = registry.getSingleMetric(name);
      if (!metric) return {};
      const payload = (await (metric as Counter).get()) as {
        values: Array<{ value: number; labels: Record<string, string> }>;
      };
      const out: Record<string, number> = {};
      for (const v of payload.values) {
        const labelKey = Object.values(v.labels)[0] ?? "default";
        out[labelKey] = v.value;
      }
      return out;
    },
  } as MetricsRegistry;
}

/** Rend le format texte Prometheus pour un registre donne. */
export async function metricsExposition(registry: Registry): Promise<string> {
  return registry.metrics();
}

/** Singleton applicatif : un seul registre par process. */
export const appMetrics = buildMetricsRegistry();
