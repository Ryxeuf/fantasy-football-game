/**
 * Pro League broadcaster load test — Lot 4.C.1.
 *
 * Pourquoi
 * --------
 * Le broadcaster (`pro-league-match-broadcaster.ts`) tient un MVP
 * `EventEmitter` in-process avec `setInterval` toutes les 100ms. La
 * roadmap Phase 4.C.1 demande de mesurer **où** ce design sature :
 * combien de subscribers concurrents avant que le dispatch lag p99
 * dépasse les 100ms, et combien de RAM consomme N sessions actives.
 *
 * Ce module fournit un harnais **synthétique et offline** :
 *   1. Pas de DB — on construit les events en mémoire.
 *   2. Pas de sim-engine — on instancie directement des `EventEmitter`
 *      avec le même contrat de dispatch que le broadcaster prod.
 *   3. Mesure CPU + RSS + percentiles dispatch lag.
 *
 * Le harnais est **pur côté logique** (entrée : config, sortie :
 * résultat), ce qui le rend testable. Le CLI (`scripts/loadtest-
 * broadcaster.ts`) ne fait qu'appeler `runBroadcasterLoadTest` et
 * imprime le rapport.
 *
 * Choix de design
 * ---------------
 * - Le harnais ne touche **pas** le module broadcaster prod : on
 *   recrée la même boucle dispatch (setInterval + scan d'events
 *   classés par `displayAtMs`) pour mesurer son comportement intrinsèque
 *   sans dépendre de l'état global `sessions Map`. Si la boucle prod
 *   est refactorée, le test continuera à mesurer un dispatch
 *   in-process représentatif (les chiffres seront comparables si
 *   l'architecture EventEmitter est conservée).
 * - On accepte que la mesure soit influencée par l'event loop Node.js :
 *   c'est exactement ce qu'on cherche à observer en prod.
 */

import { EventEmitter } from "node:events";

export interface LoadTestConfig {
  /** Nombre de sessions concurrentes (matchs simulés). */
  readonly matches: number;
  /** Subscribers par session. */
  readonly subscribers: number;
  /** Events par session. Tous espacés de `eventSpacingMs`. */
  readonly events: number;
  /** Espacement entre events successifs (ms). Default 100ms. */
  readonly eventSpacingMs?: number;
  /** Granularité du tick interne (ms). Default 100ms (= prod). */
  readonly tickIntervalMs?: number;
}

export interface PercentileStats {
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly max: number;
  readonly mean: number;
}

export interface LoadTestResult {
  readonly config: LoadTestConfig;
  readonly totalEventsDispatched: number;
  readonly totalListenerInvocations: number;
  readonly dispatchLagMs: PercentileStats;
  readonly cpuMs: { readonly user: number; readonly system: number };
  readonly memoryMb: { readonly rss: number; readonly heapUsed: number };
  readonly durationMs: number;
}

const DEFAULT_TICK_MS = 100;
const DEFAULT_SPACING_MS = 100;

function computePercentiles(samples: readonly number[]): PercentileStats {
  if (samples.length === 0) {
    return { p50: 0, p95: 0, p99: 0, max: 0, mean: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (q: number): number => {
    const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
    return sorted[idx]!;
  };
  let sum = 0;
  for (const s of sorted) sum += s;
  return {
    p50: pick(0.5),
    p95: pick(0.95),
    p99: pick(0.99),
    max: sorted[sorted.length - 1]!,
    mean: sum / sorted.length,
  };
}

interface SyntheticEvent {
  readonly displayAtMs: number;
}

interface SyntheticSession {
  readonly events: readonly SyntheticEvent[];
  readonly startedAt: number;
  nextIndex: number;
  readonly emitter: EventEmitter;
  timer?: NodeJS.Timeout;
}

/**
 * Harnais de load test — exécute N sessions × M subscribers en
 * parallèle et capture les statistiques. Resolve quand toutes les
 * sessions ont dispatché tous leurs events.
 */
export function runBroadcasterLoadTest(
  config: LoadTestConfig,
): Promise<LoadTestResult> {
  const tickMs = config.tickIntervalMs ?? DEFAULT_TICK_MS;
  const spacingMs = config.eventSpacingMs ?? DEFAULT_SPACING_MS;
  const startCpu = process.cpuUsage();
  const startWall = Date.now();
  const lagSamples: number[] = [];
  let totalEventsDispatched = 0;
  let totalListenerInvocations = 0;

  const buildEvents = (): SyntheticEvent[] => {
    const out: SyntheticEvent[] = [];
    for (let i = 0; i < config.events; i += 1) {
      out.push({ displayAtMs: i * spacingMs });
    }
    return out;
  };

  return new Promise<LoadTestResult>((resolve) => {
    let sessionsRemaining = config.matches;
    if (sessionsRemaining === 0) {
      resolve({
        config,
        totalEventsDispatched: 0,
        totalListenerInvocations: 0,
        dispatchLagMs: computePercentiles([]),
        cpuMs: { user: 0, system: 0 },
        memoryMb: snapshotMemoryMb(),
        durationMs: 0,
      });
      return;
    }

    const finalize = (): void => {
      const cpu = process.cpuUsage(startCpu);
      const result: LoadTestResult = {
        config,
        totalEventsDispatched,
        totalListenerInvocations,
        dispatchLagMs: computePercentiles(lagSamples),
        cpuMs: { user: cpu.user / 1000, system: cpu.system / 1000 },
        memoryMb: snapshotMemoryMb(),
        durationMs: Date.now() - startWall,
      };
      resolve(result);
    };

    for (let s = 0; s < config.matches; s += 1) {
      const session: SyntheticSession = {
        events: buildEvents(),
        startedAt: Date.now(),
        nextIndex: 0,
        emitter: new EventEmitter(),
      };
      session.emitter.setMaxListeners(config.subscribers + 16);
      for (let l = 0; l < config.subscribers; l += 1) {
        session.emitter.on("event", () => {
          totalListenerInvocations += 1;
        });
      }
      const tick = (): void => {
        const elapsed = Date.now() - session.startedAt;
        while (
          session.nextIndex < session.events.length &&
          session.events[session.nextIndex]!.displayAtMs <= elapsed
        ) {
          const ev = session.events[session.nextIndex]!;
          lagSamples.push(elapsed - ev.displayAtMs);
          session.emitter.emit("event", ev);
          totalEventsDispatched += 1;
          session.nextIndex += 1;
        }
        if (session.nextIndex >= session.events.length && session.timer) {
          clearInterval(session.timer);
          session.timer = undefined;
          session.emitter.removeAllListeners();
          sessionsRemaining -= 1;
          if (sessionsRemaining === 0) finalize();
        }
      };
      session.timer = setInterval(tick, tickMs);
      // Pas de `unref()` ici (contrairement au broadcaster prod) : on
      // veut que Node reste éveillé tant que les sessions n'ont pas
      // toutes dispatché leurs events. Le harnais est one-shot et
      // resolve() une fois finished.
    }
  });
}

function snapshotMemoryMb(): { readonly rss: number; readonly heapUsed: number } {
  const m = process.memoryUsage();
  return {
    rss: Math.round((m.rss / (1024 * 1024)) * 100) / 100,
    heapUsed: Math.round((m.heapUsed / (1024 * 1024)) * 100) / 100,
  };
}

/** Format un rapport texte concis du résultat (pour le CLI). */
export function formatLoadTestReport(result: LoadTestResult): string {
  const { config, dispatchLagMs, cpuMs, memoryMb } = result;
  const totalSubscribers = config.matches * config.subscribers;
  return [
    `=== Broadcaster load test — Lot 4.C.1 ===`,
    `Config: ${config.matches} matches × ${config.subscribers} subscribers (= ${totalSubscribers} total) × ${config.events} events`,
    `Tick interval: ${config.tickIntervalMs ?? DEFAULT_TICK_MS}ms · Event spacing: ${config.eventSpacingMs ?? DEFAULT_SPACING_MS}ms`,
    `Duration: ${result.durationMs}ms`,
    ``,
    `Dispatch:`,
    `  events dispatched      : ${result.totalEventsDispatched}`,
    `  listener invocations   : ${result.totalListenerInvocations}`,
    ``,
    `Dispatch lag (ms):`,
    `  p50 ${dispatchLagMs.p50.toFixed(1)}  p95 ${dispatchLagMs.p95.toFixed(1)}  p99 ${dispatchLagMs.p99.toFixed(1)}  max ${dispatchLagMs.max.toFixed(1)}  mean ${dispatchLagMs.mean.toFixed(1)}`,
    ``,
    `Resource usage:`,
    `  CPU user/system : ${cpuMs.user.toFixed(1)}ms / ${cpuMs.system.toFixed(1)}ms`,
    `  RSS / heapUsed  : ${memoryMb.rss}MB / ${memoryMb.heapUsed}MB`,
  ].join("\n");
}
