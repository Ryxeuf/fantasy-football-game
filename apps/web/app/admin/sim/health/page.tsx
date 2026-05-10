"use client";

/**
 * Console admin — sim engine health (Lot 2.B.3, augmenté Lot 4.A.3).
 *
 * Hub d'observabilité du sim engine côté UI :
 *
 *   1. **Active alerts** — drift alerts (warn / critical, |drift| >
 *      10% / 25%) + race-bound alerts (Lot 4.A.3) au-dessus de la
 *      table.
 *   2. **Last sim** — timestamp du dernier match Pro League completé,
 *      avec ago humain.
 *   3. **Drift table** par race vs FUMBBL (rolling 7j default), avec
 *      🟢🟡🔴 par métrique (tdMean / casualtyMean / winRate).
 *   4. **Cross-links** — entry points vers les autres consoles
 *      `/admin/sim/{broadcaster, replays, test-match,
 *      compare-versions, diff-replays}`.
 *
 * Lecture seule. Source : `GET /admin/sim/health-snapshot`.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE } from "../../../auth-client";

type DriftMetric = "tdMean" | "casualtyMean" | "winRate";
type AlertSeverity = "warn" | "critical";
type RaceBoundDirection = "above_max" | "below_min";

interface DriftSample {
  metric: DriftMetric;
  race: string;
  seasonId: string;
  observed: number;
  reference: number;
  drift: number;
  samples: number;
}

interface DriftAlert {
  severity: AlertSeverity;
  metric: DriftMetric;
  race: string;
  seasonId: string;
  drift: number;
  observed: number;
  reference: number;
  samples: number;
}

interface RaceBoundAlert {
  severity: "critical";
  race: string;
  seasonId: string;
  metric: DriftMetric;
  direction: RaceBoundDirection;
  observed: number;
  bound: number;
  samples: number;
}

interface HealthSnapshot {
  samples: DriftSample[];
  driftAlerts: DriftAlert[];
  boundAlerts: RaceBoundAlert[];
  counts: { warn: number; critical: number };
  lastSimAt: string | null;
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

function formatAgo(iso: string | null): string {
  if (!iso) return "jamais";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return "à l'instant";
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "<1 min";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
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

function severityClass(s: AlertSeverity): string {
  return s === "critical"
    ? "border-red-300 bg-red-50 text-red-900"
    : "border-yellow-300 bg-yellow-50 text-yellow-900";
}

export default function AdminSimHealthPage() {
  const [data, setData] = useState<HealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [windowDays, setWindowDays] = useState<number>(7);

  const refresh = async (days: number): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const windowMs = days * 24 * 60 * 60 * 1000;
      const payload = await fetchJSON<HealthSnapshot>(
        `/admin/sim/health-snapshot?windowMs=${windowMs}`,
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

      <div className="flex flex-wrap gap-3 items-center mb-6">
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
          <>
            <span className="text-xs text-gray-500">
              Calculé : {new Date(data.computedAt).toLocaleString()}
            </span>
            <span className="text-xs text-gray-500">
              Dernier match : {formatAgo(data.lastSimAt)}
            </span>
            <span className="ml-auto inline-flex gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-900">
                ⚠ {data.counts.warn} warn
              </span>
              <span className="px-2 py-1 rounded bg-red-100 text-red-900">
                🔴 {data.counts.critical} critical
              </span>
            </span>
          </>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 border border-red-300 bg-red-50 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {data &&
        (data.driftAlerts.length > 0 || data.boundAlerts.length > 0) && (
          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Active alerts</h2>
            <ul className="space-y-2 text-sm">
              {data.driftAlerts.map((a, i) => (
                <li
                  key={`drift-${i}`}
                  className={`border rounded p-2 ${severityClass(a.severity)}`}
                >
                  <strong className="uppercase">{a.severity}</strong> · drift{" "}
                  <code>{a.metric}</code> {a.race} ({a.seasonId}) :{" "}
                  observed <strong>{a.observed.toFixed(2)}</strong> vs ref{" "}
                  {a.reference.toFixed(2)} ({formatPct(a.drift)}, {a.samples}{" "}
                  matchs)
                </li>
              ))}
              {data.boundAlerts.map((a, i) => (
                <li
                  key={`bound-${i}`}
                  className={`border rounded p-2 ${severityClass("critical")}`}
                >
                  <strong className="uppercase">CRITICAL</strong> · borne BB{" "}
                  <code>{a.metric}</code> {a.race} ({a.seasonId}) :{" "}
                  observed <strong>{a.observed.toFixed(2)}</strong>{" "}
                  {a.direction === "above_max" ? ">" : "<"} {a.bound.toFixed(2)}{" "}
                  ({a.samples} matchs)
                </li>
              ))}
            </ul>
          </section>
        )}

      {data &&
        races.length === 0 &&
        data.driftAlerts.length === 0 &&
        data.boundAlerts.length === 0 && (
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

      <nav className="mt-8 flex flex-wrap gap-3 text-xs text-gray-600 border-t pt-4">
        <Link
          href={"/admin/sim/broadcaster" as never}
          className="underline"
        >
          → Broadcaster live stats
        </Link>
        <Link href={"/admin/sim/loadtest" as never} className="underline">
          → Broadcaster load test
        </Link>
        <Link href={"/admin/sim/replays" as never} className="underline">
          → Replays
        </Link>
        <Link href={"/admin/sim/test-match" as never} className="underline">
          → Sandbox test match
        </Link>
        <Link
          href={"/admin/sim/compare-versions" as never}
          className="underline"
        >
          → Cross-version compare
        </Link>
        <Link
          href={"/admin/sim/diff-replays" as never}
          className="underline"
        >
          → Replay diff
        </Link>
      </nav>

      <details className="mt-6 text-xs text-gray-600">
        <summary className="cursor-pointer">Méthodologie</summary>
        <p className="mt-2">
          Chaque match contribue deux fois à l&apos;aggrégation (homeRace +
          awayRace). Les casualties sont split 50/50 entre les deux équipes
          (donnée per-team non disponible sur ProLeagueMatch). La drift est
          relative : <code>(observed − reference) / reference</code>. Une
          race sans match dans la fenêtre n&apos;apparaît pas. Alertes
          drift : warn |drift|&gt;10%, critical |drift|&gt;25%, minimum 5
          matchs. Bornes BB-réalistes (Lot 4.A.3) : alertes critical quand
          l&apos;observed sort des plages canoniques par race
          (ex. Halfling winrate &gt; 45% suspect).
        </p>
      </details>
    </div>
  );
}
