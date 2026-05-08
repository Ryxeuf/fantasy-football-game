/**
 * Métriques Prometheus (tâche S25.3 — Sprint 25 ; étendu Lot 2.A.2).
 *
 * Expose les métriques applicatives custom + un histogramme de latence
 * HTTP. Chaque metrique est isolee dans son propre `Registry` ou un
 * registre injecte, afin de pouvoir instancier un mock dans les tests
 * sans polluer le state global.
 *
 * Catalogue
 * ---------
 * Live state (S25.3) :
 *   - match_active_count        gauge   (game-rooms.ts)
 *   - matchmaking_queue_size    gauge   (services/matchmaking.ts)
 *   - ws_connections_open       gauge   (socket.ts)
 *   - pass_attempts_total       counter (label `result`)
 *   - armor_break_total         counter
 *   - http_request_duration_ms  histogram(method, route, statusCode)
 *
 * Pro League sim engine (Lot 2.A.2) :
 *   - nuffle_sim_match_duration_seconds       histogram(engineVer, driver, outcome)
 *   - nuffle_sim_match_total                  counter(status, driver)
 *   - nuffle_replay_size_bytes                histogram(engineVer)
 *   - nuffle_broadcaster_active_sessions      gauge
 *   - nuffle_broadcaster_total_subscribers    gauge
 *   - nuffle_broadcaster_event_dispatch_lag_ms histogram
 *   - nuffle_engine_drift                     gauge(metric, race, seasonId)
 *
 * Pro League driver comparator (Lot 3.B.2) :
 *   - nuffle_engine_compare_score_delta_mean  gauge(engineVer, pairing)
 *   - nuffle_engine_compare_score_delta_p95   gauge(engineVer, pairing)
 *   - nuffle_engine_compare_diverged_pct      gauge(engineVer, pairing)
 *   - nuffle_engine_compare_outcome_flipped_pct gauge(engineVer, pairing)
 *
 * Le serveur expose `/metrics` sur le réseau Docker interne (Prometheus
 * scrape, non exposé internet). Cardinality kept bounded :
 *  - `driver` ∈ {'hybrid','full'}
 *  - `outcome` ∈ {'home','away','draw','failed'}
 *  - `status` ∈ {'success','failed'}
 *  - `metric` ∈ {'tdMean','casualtyMean','turnoverMean','homeWinRate', …}
 *  - `race` couvre les 16 archétypes Pro League
 *  - `engineVer` change rarement (~1/saison via pinning)
 *  - `pairing` ∈ {'<homeId>__<awayId>'} (16*15=240 combinaisons max)
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

/** Driver utilisé pour la simulation (lot 3.B.1 introduira 'full'). */
export type SimDriver = "hybrid" | "full";

/** Issue d'un match côté simulation (vs `proLeagueMatch.outcome`). */
export type SimOutcome = "home" | "away" | "draw" | "failed";

/** Statut top-level d'une simulation pour le compteur agrégé. */
export type SimStatus = "success" | "failed";

export interface SimMatchDurationLabels {
  engineVer: string;
  driver: SimDriver;
  outcome: SimOutcome;
}

export interface SimMatchTotalLabels {
  status: SimStatus;
  driver: SimDriver;
}

export interface ReplaySizeLabels {
  engineVer: string;
}

export interface EngineDriftLabels {
  /** Métrique observée — `tdMean`, `casualtyMean`, `turnoverMean`, `homeWinRate`, etc. */
  metric: string;
  /** Race archétype concernée — `Orc`, `Wood Elf`, `Halfling`, … ou `*` pour aggregat. */
  race: string;
  /** Saison Pro League à laquelle se rattache la mesure. */
  seasonId: string;
}

/**
 * Lot 3.B.2 — labels pour les jauges du comparator hybrid vs full.
 * `pairing` est concaténé `<homeTeamId>__<awayTeamId>` côté caller pour
 * limiter la cardinalité (240 max sur 16 équipes Pro League) et garder
 * les requêtes Grafana lisibles.
 */
export interface EngineCompareLabels {
  engineVer: string;
  pairing: string;
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

  /** Pro League sim — observe la durée d'une simulation (en secondes). */
  observeSimMatchDuration(labels: SimMatchDurationLabels, seconds: number): void;
  /** Pro League sim — incrémente le compteur de matchs simulés. */
  recordSimMatch(labels: SimMatchTotalLabels): void;
  /** Pro League sim — observe la taille (bytes) d'un replay compressé. */
  observeReplaySize(labels: ReplaySizeLabels, bytes: number): void;
  /** Broadcaster — set le nombre de sessions actives (clamp à 0). */
  setBroadcasterActiveSessions(value: number): void;
  /** Broadcaster — set le total de subscribers (clamp à 0). */
  setBroadcasterTotalSubscribers(value: number): void;
  /** Broadcaster — observe le délai de dispatch d'un event (en ms, peut être négatif si avance, dans ce cas clampé à 0). */
  observeBroadcasterDispatchLag(ms: number): void;
  /** Engine drift — set la dérive d'une métrique vs baseline (en delta relatif, ex: 0.04 pour +4%). */
  setEngineDrift(labels: EngineDriftLabels, value: number): void;

  /** Lot 3.B.2 — set les jauges du comparator hybrid vs full pour un pairing. */
  setEngineCompareStats(
    labels: EngineCompareLabels,
    stats: {
      readonly meanScoreDelta: number;
      readonly p95ScoreDelta: number;
      readonly divergedPct: number;
      readonly outcomeFlippedPct: number;
    },
  ): void;

  /** Helper test : retourne la valeur courante d'une gauge. */
  snapshotGauge(name: string): Promise<number>;
  /** Helper test : retourne les valeurs par label d'un counter. */
  snapshotCounter(name: string): Promise<Record<string, number>>;
}

/** Buckets en millisecondes alignes sur des seuils SLO communs. */
const HTTP_DURATION_BUCKETS_MS = [
  10, 25, 50, 100, 200, 350, 500, 750, 1000, 2500, 5000, 10000,
];

/** Buckets en secondes pour les sims (hybrid ~50ms, full attendu ~1-3s). */
const SIM_DURATION_BUCKETS_SECONDS = [
  0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 3, 5, 10, 30,
];

/** Buckets en bytes pour la taille des replays (CBOR+gzip). Hybrid ~5-15KB,
 *  full attendu ~30-100KB selon la verbosité d'events. */
const REPLAY_SIZE_BUCKETS_BYTES = [
  1024, 5_120, 10_240, 25_600, 51_200, 102_400, 256_000, 512_000, 1_048_576,
];

/** Buckets en millisecondes pour le lag de dispatch broadcaster.
 *  Tick interne 100ms — un dispatch healthy reste sous 200ms. */
const BROADCASTER_DISPATCH_LAG_BUCKETS_MS = [
  10, 25, 50, 100, 200, 350, 500, 750, 1000, 2000, 5000,
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

  // Pro League sim engine metrics (Lot 2.A.2).
  const simMatchDuration = new Histogram({
    name: "nuffle_sim_match_duration_seconds",
    help: "Durée d'une simulation de match Pro League (sim-engine), en secondes",
    labelNames: ["engineVer", "driver", "outcome"],
    buckets: SIM_DURATION_BUCKETS_SECONDS,
    registers: [registry],
  });
  const simMatchTotal = new Counter({
    name: "nuffle_sim_match_total",
    help: "Total de simulations de matchs Pro League (label `status` : success|failed, `driver`)",
    labelNames: ["status", "driver"],
    registers: [registry],
  });
  const replaySize = new Histogram({
    name: "nuffle_replay_size_bytes",
    help: "Taille du replay compressé (CBOR+gzip) en bytes",
    labelNames: ["engineVer"],
    buckets: REPLAY_SIZE_BUCKETS_BYTES,
    registers: [registry],
  });
  const broadcasterActiveSessions = new Gauge({
    name: "nuffle_broadcaster_active_sessions",
    help: "Nombre de MatchSession actives dans le broadcaster",
    registers: [registry],
  });
  const broadcasterTotalSubscribers = new Gauge({
    name: "nuffle_broadcaster_total_subscribers",
    help: "Total des subscribers (SSE clients) connectés au broadcaster",
    registers: [registry],
  });
  const broadcasterDispatchLag = new Histogram({
    name: "nuffle_broadcaster_event_dispatch_lag_ms",
    help: "Délai de dispatch d'un event (Date.now() - (startedAt + displayAtMs)) en ms",
    buckets: BROADCASTER_DISPATCH_LAG_BUCKETS_MS,
    registers: [registry],
  });
  const engineDrift = new Gauge({
    name: "nuffle_engine_drift",
    help: "Dérive relative d'une métrique sim vs baseline FUMBBL/snapshot (delta relatif, ex: 0.04 = +4%)",
    labelNames: ["metric", "race", "seasonId"],
    registers: [registry],
  });

  // Lot 3.B.2 — jauges comparator hybrid vs full driver, par pairing.
  const engineCompareScoreDeltaMean = new Gauge({
    name: "nuffle_engine_compare_score_delta_mean",
    help: "Moyenne du delta absolu home+away score entre hybrid et full pour un pairing (Lot 3.B.2)",
    labelNames: ["engineVer", "pairing"],
    registers: [registry],
  });
  const engineCompareScoreDeltaP95 = new Gauge({
    name: "nuffle_engine_compare_score_delta_p95",
    help: "p95 du delta absolu home+away score entre hybrid et full pour un pairing (Lot 3.B.2)",
    labelNames: ["engineVer", "pairing"],
    registers: [registry],
  });
  const engineCompareDivergedPct = new Gauge({
    name: "nuffle_engine_compare_diverged_pct",
    help: "Pct (0..1) de matchs où hybrid et full divergent (scoreTotal>0 OR outcomeChanged) — Lot 3.B.2",
    labelNames: ["engineVer", "pairing"],
    registers: [registry],
  });
  const engineCompareOutcomeFlippedPct = new Gauge({
    name: "nuffle_engine_compare_outcome_flipped_pct",
    help: "Pct (0..1) de matchs où l'outcome flip entre hybrid et full — Lot 3.B.2",
    labelNames: ["engineVer", "pairing"],
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
    observeSimMatchDuration(labels, seconds) {
      const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
      simMatchDuration.observe(
        {
          engineVer: labels.engineVer,
          driver: labels.driver,
          outcome: labels.outcome,
        },
        safe,
      );
    },
    recordSimMatch(labels) {
      simMatchTotal.inc({
        status: labels.status,
        driver: labels.driver,
      });
    },
    observeReplaySize(labels, bytes) {
      const safe = Number.isFinite(bytes) && bytes >= 0 ? bytes : 0;
      replaySize.observe({ engineVer: labels.engineVer }, safe);
    },
    setBroadcasterActiveSessions(value) {
      broadcasterActiveSessions.set(clamp(value));
    },
    setBroadcasterTotalSubscribers(value) {
      broadcasterTotalSubscribers.set(clamp(value));
    },
    observeBroadcasterDispatchLag(ms) {
      // Lag négatif = event dispatché en avance (peu probable mais
      // possible si le wallclock recule). On clamp pour ne pas polluer
      // l'histogramme.
      const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
      broadcasterDispatchLag.observe(safe);
    },
    setEngineDrift(labels, value) {
      const safe = Number.isFinite(value) ? value : 0;
      engineDrift.set(
        {
          metric: labels.metric,
          race: labels.race,
          seasonId: labels.seasonId,
        },
        safe,
      );
    },
    setEngineCompareStats(labels, stats) {
      const safe = (n: number): number => (Number.isFinite(n) ? n : 0);
      const tags = { engineVer: labels.engineVer, pairing: labels.pairing };
      engineCompareScoreDeltaMean.set(tags, safe(stats.meanScoreDelta));
      engineCompareScoreDeltaP95.set(tags, safe(stats.p95ScoreDelta));
      engineCompareDivergedPct.set(tags, safe(stats.divergedPct));
      engineCompareOutcomeFlippedPct.set(tags, safe(stats.outcomeFlippedPct));
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
