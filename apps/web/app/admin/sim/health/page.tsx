"use client";

/**
 * Console admin — sim engine health (Lot 2.B.3).
 *
 * Affiche la drift courante du moteur (rolling 7j) par race vs
 * référence FUMBBL. Sert de fallback quand Grafana est down ou pour
 * un rapide sanity check sans quitter l'app.
 *
 * Code couleur :
 *   🟢  drift ∈ ]−5%, +5%[
 *   🟡  drift ∈ ]−10%, +10%[
 *   🔴  drift au-delà de ±10%
 *
 * Lecture seule. Source : `GET /admin/sim/drift`.
 */

import { useEffect, useState } from "react";
import { API_BASE } from "../../../auth-client";

type DriftMetric = "tdMean" | "casualtyMean" | "winRate";

interface DriftSample {
  metric: DriftMetric;
  race: string;
  seasonId: string;
  observed: number;
  reference: number;
  drift: number;
  samples: number;
}

interface DriftPayload {
  samples: DriftSample[];
  computedAt: string;
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

function classifyDrift(absDrift: number): "ok" | "warn" | "crit" {
  if (absDrift < 0.05) return "ok";
  if (absDrift < 0.1) return "warn";
  return "crit";
}

function trafficLight(drift: number): string {
  switch (classifyDrift(Math.abs(drift))) {
    case "ok":
      return "🟢";
    case "warn":
      return "🟡";
    case "crit":
      return "🔴";
  }
}

function formatPct(drift: number): string {
  const sign = drift > 0 ? "+" : drift < 0 ? "" : "±";
  return `${sign}${(drift * 100).toFixed(1)}%`;
}

interface RaceSummary {
  race: string;
  seasonId: string;
  samples: number;
  metrics: Partial<Record<DriftMetric, DriftSample>>;
}

function groupByRace(samples: readonly DriftSample[]): RaceSummary[] {
  const map = new Map<string, RaceSummary>();
  for (const s of samples) {
    const key = `${s.seasonId}::${s.race}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        race: s.race,
        seasonId: s.seasonId,
        samples: s.samples,
        metrics: {},
      };
      map.set(key, entry);
    }
    entry.metrics[s.metric] = s;
  }
  return Array.from(map.values()).sort((a, b) => a.race.localeCompare(b.race));
}

export default function AdminSimHealthPage() {
  const [data, setData] = useState<DriftPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [windowDays, setWindowDays] = useState<number>(7);

  const refresh = async (days: number) => {
    setLoading(true);
    setError(null);
    try {
      const windowMs = days * 24 * 60 * 60 * 1000;
      const payload = await fetchJSON<DriftPayload>(
        `/admin/sim/drift?windowMs=${windowMs}`,
      );
      setData(payload);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh(windowDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const races = data ? groupByRace(data.samples) : [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Sim engine — health</h1>
      <p className="text-sm text-gray-600 mb-4">
        Drift relative observée (matchs réels Pro League) vs référence
        FUMBBL. 🟢 ∈ ±5% · 🟡 ∈ ±10% · 🔴 au-delà.
      </p>

      <div className="flex gap-3 items-center mb-6">
        <label className="text-sm">
          Fenêtre :
          <select
            value={windowDays}
            onChange={(e) => {
              const days = Number(e.target.value);
              setWindowDays(days);
              void refresh(days);
            }}
            className="ml-2 border rounded p-1"
          >
            <option value={1}>24h</option>
            <option value={7}>7 jours</option>
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
          </select>
        </label>
        <button
          onClick={() => void refresh(windowDays)}
          disabled={loading}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          {loading ? "…" : "Rafraîchir"}
        </button>
        {data && (
          <span className="text-xs text-gray-500">
            Calculé : {new Date(data.computedAt).toLocaleString()}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 border border-red-300 bg-red-50 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {data && races.length === 0 && (
        <div className="p-4 bg-gray-50 border rounded text-sm text-gray-600">
          Aucun match dans la fenêtre — pas de drift à mesurer.
        </div>
      )}

      {races.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-2">Race</th>
              <th className="text-right p-2">Saison</th>
              <th className="text-right p-2">Matchs</th>
              <th className="text-right p-2">tdMean</th>
              <th className="text-right p-2">vs ref</th>
              <th className="text-right p-2">casualtyMean</th>
              <th className="text-right p-2">vs ref</th>
              <th className="text-right p-2">winRate</th>
              <th className="text-right p-2">vs ref</th>
            </tr>
          </thead>
          <tbody>
            {races.map((r) => (
              <tr key={`${r.seasonId}-${r.race}`} className="border-b">
                <td className="p-2 font-medium">{r.race}</td>
                <td className="p-2 text-right text-gray-500">{r.seasonId}</td>
                <td className="p-2 text-right">{r.samples}</td>
                <td className="p-2 text-right">
                  {r.metrics.tdMean?.observed.toFixed(2) ?? "—"}
                </td>
                <td className="p-2 text-right">
                  {r.metrics.tdMean
                    ? `${trafficLight(r.metrics.tdMean.drift)} ${formatPct(r.metrics.tdMean.drift)}`
                    : "—"}
                </td>
                <td className="p-2 text-right">
                  {r.metrics.casualtyMean?.observed.toFixed(2) ?? "—"}
                </td>
                <td className="p-2 text-right">
                  {r.metrics.casualtyMean
                    ? `${trafficLight(r.metrics.casualtyMean.drift)} ${formatPct(r.metrics.casualtyMean.drift)}`
                    : "—"}
                </td>
                <td className="p-2 text-right">
                  {r.metrics.winRate
                    ? `${(r.metrics.winRate.observed * 100).toFixed(1)}%`
                    : "—"}
                </td>
                <td className="p-2 text-right">
                  {r.metrics.winRate
                    ? `${trafficLight(r.metrics.winRate.drift)} ${formatPct(r.metrics.winRate.drift)}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <details className="mt-6 text-xs text-gray-600">
        <summary className="cursor-pointer">Méthodologie</summary>
        <p className="mt-2">
          Chaque match contribue deux fois à l&apos;aggrégation (homeRace +
          awayRace). Les casualties sont split 50/50 entre les deux équipes
          (donnée per-team non disponible sur ProLeagueMatch). La drift est
          relative : <code>(observed − reference) / reference</code>. Une
          race sans match dans la fenêtre n&apos;apparaît pas.
        </p>
      </details>
    </div>
  );
}
