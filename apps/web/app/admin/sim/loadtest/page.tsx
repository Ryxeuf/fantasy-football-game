"use client";

/**
 * Console admin — broadcaster load test (Lot J).
 *
 * Wrappe le CLI `pnpm sim:loadtest:broadcaster` (Lot 4.C.1) via la
 * route `POST /admin/sim/loadtest`. Permet de mesurer le seuil de
 * scaling depuis le navigateur sans accès shell.
 *
 * Caps server-side (volontairement plus stricts que le CLI) :
 *   - matches ≤ 50, subscribers ≤ 1000, events ≤ 200
 *
 * Pour des scaling tests plus agressifs, utiliser le CLI offline.
 */

import Link from "next/link";
import { useState } from "react";
import { API_BASE } from "../../../auth-client";

interface PercentileStats {
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

interface LoadTestResult {
  config: {
    matches: number;
    subscribers: number;
    events: number;
    eventSpacingMs?: number;
    tickIntervalMs?: number;
  };
  totalEventsDispatched: number;
  totalListenerInvocations: number;
  dispatchLagMs: PercentileStats;
  cpuMs: { user: number; system: number };
  memoryMb: { rss: number; heapUsed: number };
  durationMs: number;
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(error.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** p99 > 100ms (= 1 tick) → flag rouge ; p99 > 50ms → orange. */
function lagSeverityClass(p99: number): string {
  if (p99 > 100) return "text-red-700 font-semibold";
  if (p99 > 50) return "text-orange-600";
  return "text-emerald-700";
}

export default function AdminLoadtestPage() {
  const [matches, setMatches] = useState<number>(10);
  const [subscribers, setSubscribers] = useState<number>(100);
  const [events, setEvents] = useState<number>(50);
  const [eventSpacingMs, setEventSpacingMs] = useState<number>(100);
  const [tickIntervalMs, setTickIntervalMs] = useState<number>(100);
  const [result, setResult] = useState<LoadTestResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await postJSON<LoadTestResult>("/admin/sim/loadtest", {
        matches,
        subscribers,
        events,
        eventSpacingMs,
        tickIntervalMs,
      });
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const totalSubscribers = matches * subscribers;
  const estimatedDurationMs = events * eventSpacingMs;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">
        Sim engine — broadcaster load test
      </h1>
      <p className="text-sm text-gray-600 mb-4">
        Mesure le seuil de saturation du broadcaster Pro League. Wrappe
        le CLI offline <code>pnpm sim:loadtest:broadcaster</code>.
        Caps : matches ≤ 50, subscribers ≤ 1000, events ≤ 200.
        Pour des scaling tests plus agressifs, utiliser le CLI.
      </p>

      <div className="grid grid-cols-3 gap-3 items-end mb-4 p-4 border rounded bg-white">
        <label className="text-sm">
          <div className="mb-1">Matches concurrents</div>
          <input
            type="number"
            min={1}
            max={50}
            value={matches}
            onChange={(e) => setMatches(Number(e.target.value))}
            className="w-full border rounded p-2"
          />
        </label>
        <label className="text-sm">
          <div className="mb-1">Subscribers / match</div>
          <input
            type="number"
            min={1}
            max={1000}
            value={subscribers}
            onChange={(e) => setSubscribers(Number(e.target.value))}
            className="w-full border rounded p-2"
          />
        </label>
        <label className="text-sm">
          <div className="mb-1">Events / match</div>
          <input
            type="number"
            min={1}
            max={200}
            value={events}
            onChange={(e) => setEvents(Number(e.target.value))}
            className="w-full border rounded p-2"
          />
        </label>
        <label className="text-sm">
          <div className="mb-1">Event spacing (ms)</div>
          <input
            type="number"
            min={1}
            max={1000}
            value={eventSpacingMs}
            onChange={(e) => setEventSpacingMs(Number(e.target.value))}
            className="w-full border rounded p-2"
          />
        </label>
        <label className="text-sm">
          <div className="mb-1">Tick interval (ms)</div>
          <input
            type="number"
            min={1}
            max={1000}
            value={tickIntervalMs}
            onChange={(e) => setTickIntervalMs(Number(e.target.value))}
            className="w-full border rounded p-2"
          />
        </label>
        <div className="text-xs text-gray-500">
          Total subscribers concurrents :{" "}
          <strong>{totalSubscribers.toLocaleString()}</strong>
          <br />
          Durée estimée : ~
          <strong>{(estimatedDurationMs / 1000).toFixed(1)}s</strong>
        </div>
        <div className="col-span-3 flex justify-end">
          <button
            data-testid="run-loadtest"
            onClick={() => void run()}
            disabled={loading}
            className="px-4 py-2 rounded bg-nuffle-gold text-white font-medium disabled:opacity-50"
          >
            {loading ? `Compute… (~${(estimatedDurationMs / 1000).toFixed(0)}s)` : "Run load test"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 border border-red-300 bg-red-50 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div data-testid="loadtest-result" className="space-y-4">
          <div className="p-3 border rounded bg-gray-50 text-sm">
            <div>
              Config : {result.config.matches} matches ×{" "}
              {result.config.subscribers} subscribers ={" "}
              <strong>
                {(
                  result.config.matches * result.config.subscribers
                ).toLocaleString()}
              </strong>{" "}
              total · {result.config.events} events
            </div>
            <div>
              Durée : <strong>{result.durationMs}ms</strong> · Events
              dispatched :{" "}
              <strong>{result.totalEventsDispatched.toLocaleString()}</strong>{" "}
              · Listener invocations :{" "}
              <strong>
                {result.totalListenerInvocations.toLocaleString()}
              </strong>
            </div>
          </div>

          <div className="p-3 border rounded bg-white">
            <h2 className="font-medium mb-2">Dispatch lag (ms)</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                  <th className="text-right p-2">p50</th>
                  <th className="text-right p-2">p95</th>
                  <th
                    className="text-right p-2"
                    title="Critère SLO : p99 ≤ 1 tick (= 100ms par défaut)"
                  >
                    p99
                  </th>
                  <th className="text-right p-2">max</th>
                  <th className="text-right p-2">mean</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 text-right font-mono">
                    {result.dispatchLagMs.p50.toFixed(1)}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {result.dispatchLagMs.p95.toFixed(1)}
                  </td>
                  <td
                    data-testid="lag-p99"
                    className={`p-2 text-right font-mono ${lagSeverityClass(result.dispatchLagMs.p99)}`}
                  >
                    {result.dispatchLagMs.p99.toFixed(1)}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {result.dispatchLagMs.max.toFixed(1)}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {result.dispatchLagMs.mean.toFixed(1)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-3 border rounded bg-white text-sm">
            <h2 className="font-medium mb-2">Resource usage</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                CPU user : <strong>{result.cpuMs.user.toFixed(1)}ms</strong>
                <br />
                CPU system :{" "}
                <strong>{result.cpuMs.system.toFixed(1)}ms</strong>
              </div>
              <div>
                RSS : <strong>{result.memoryMb.rss}MB</strong>
                <br />
                heapUsed : <strong>{result.memoryMb.heapUsed}MB</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="mt-8 flex flex-wrap gap-3 text-xs text-gray-600 border-t pt-4">
        <Link href={"/admin/sim/health" as never} className="underline">
          → Sim health dashboard
        </Link>
        <Link href={"/admin/sim/broadcaster" as never} className="underline">
          → Broadcaster live stats
        </Link>
      </nav>
    </div>
  );
}
