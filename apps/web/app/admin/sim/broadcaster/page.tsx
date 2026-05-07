"use client";

/**
 * Console admin — broadcaster live state (Lot 2.B.4).
 *
 * Affiche en temps réel les sessions broadcaster actives + total
 * subscribers. Auto-refresh toutes les 5s. Lecture seule.
 *
 * Source : `GET /admin/sim/broadcaster`. Compare la valeur en mémoire
 * (`getBroadcasterStats()`) avec la gauge Prometheus : un écart
 * signale un bug d'instrumentation à investiguer.
 */

import { useEffect, useState } from "react";
import { API_BASE } from "../../../auth-client";

interface BroadcasterPayload {
  activeSessions: number;
  totalSubscribers: number;
  promExposed: {
    activeSessions: number;
    totalSubscribers: number;
  };
  fetchedAt: string;
}

async function fetchJSON<T>(path: string): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(error.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const REFRESH_MS = 5_000;

export default function AdminBroadcasterPage() {
  const [data, setData] = useState<BroadcasterPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const load = async () => {
    try {
      const payload = await fetchJSON<BroadcasterPayload>(
        "/admin/sim/broadcaster",
      );
      setData(payload);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    void load();
    if (!autoRefresh) return;
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const driftActive =
    data && data.activeSessions !== data.promExposed.activeSessions;
  const driftSubs =
    data && data.totalSubscribers !== data.promExposed.totalSubscribers;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Broadcaster — live state</h1>
      <p className="text-sm text-gray-600 mb-4">
        Sessions broadcaster actives + subscribers SSE connectés.
        Auto-refresh {(REFRESH_MS / 1000).toFixed(0)}s. Une dérive entre
        la valeur en mémoire et la gauge Prometheus signale un bug
        d&apos;instrumentation.
      </p>

      <div className="flex gap-3 items-center mb-6">
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh
        </label>
        <button
          onClick={() => void load()}
          className="px-3 py-1 border rounded"
        >
          Rafraîchir maintenant
        </button>
        {data && (
          <span className="text-xs text-gray-500">
            Dernière lecture : {new Date(data.fetchedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 border border-red-300 bg-red-50 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border rounded bg-white">
            <div className="text-xs text-gray-500 mb-1">Sessions actives</div>
            <div className="text-3xl font-bold">{data.activeSessions}</div>
            <div className="text-xs text-gray-400 mt-2">
              Prometheus : {data.promExposed.activeSessions}
              {driftActive && <span className="ml-2 text-red-600">⚠ drift</span>}
            </div>
          </div>
          <div className="p-4 border rounded bg-white">
            <div className="text-xs text-gray-500 mb-1">Total subscribers</div>
            <div className="text-3xl font-bold">{data.totalSubscribers}</div>
            <div className="text-xs text-gray-400 mt-2">
              Prometheus : {data.promExposed.totalSubscribers}
              {driftSubs && <span className="ml-2 text-red-600">⚠ drift</span>}
            </div>
          </div>
        </div>
      )}

      <details className="mt-6 text-xs text-gray-600">
        <summary className="cursor-pointer">Notes</summary>
        <ul className="mt-2 list-disc list-inside space-y-1">
          <li>
            Une session est créée à la première subscription d&apos;un
            match et libérée quand tous les events sont dispatchés ET
            qu&apos;il n&apos;y a plus de subscribers.
          </li>
          <li>
            Le tick interne de dispatch tourne à 100ms. Pour le lag p95
            et la distribution, voir Grafana dashboard
            <code className="mx-1">nuffle_broadcaster_event_dispatch_lag_ms</code>.
          </li>
          <li>
            La capacité maximale d&apos;événements broadcastés en
            simultané est aujourd&apos;hui limitée par
            <code className="mx-1">setMaxListeners(1024)</code> par session.
          </li>
        </ul>
      </details>
    </div>
  );
}
