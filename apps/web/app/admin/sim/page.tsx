"use client";

/**
 * Petit utilitaire admin (Phase 0 — pre-Pro League UI).
 *
 * Permet de declencher une simulation depuis le navigateur sans passer
 * par le CLI. Hit `POST /admin/sim/run` qui appelle `runBench` du
 * sim-engine et retourne metrics + report texte.
 *
 * Cette page disparaitra quand la Phase 1 livrera la vraie UI Pro
 * League (lots 1.A scheduler + 1.B broadcaster + 1.C pages).
 */

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../auth-client";
import EngineVersionsBadge from "../_components/EngineVersionsBadge";

interface Team {
  id: string;
  city: string;
  name: string;
  race: string;
  nflFlavor: string;
}

interface VivacityMetrics {
  matches: number;
  td: { mean: number; std: number; p5: number; p95: number };
  casualties: { mean: number; std: number };
  turnovers: { mean: number };
  fatTails: { highScoring: number; bloodbath: number };
  outcomes: { home: number; away: number; draw: number; upsetRate: number };
  meetsTargets: { stdDevTd: boolean; upsetRate: boolean };
}

interface SimRunResult {
  pairing: {
    home: { id: string; name: string; race: string };
    away: { id: string; name: string; race: string };
  };
  matches: number;
  metrics: VivacityMetrics;
  favorite?: "home" | "away";
  report: string;
}

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
      ...(init?.headers ?? {}),
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

const RUN_OPTIONS = [10, 50, 200, 500, 1000];

export default function AdminSimPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamA, setTeamA] = useState<string>("");
  const [teamB, setTeamB] = useState<string>("");
  const [runs, setRuns] = useState<number>(50);
  const [seed, setSeed] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimRunResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await fetchJSON<{ teams: Team[] }>("/admin/sim/teams");
        setTeams(data.teams);
        if (data.teams.length >= 2) {
          setTeamA(data.teams[0].id);
          setTeamB(data.teams[1].id);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const teamLabel = useMemo(() => {
    const map = new Map(teams.map((t) => [t.id, `${t.city} ${t.name} (${t.race})`]));
    return (id: string) => map.get(id) ?? id;
  }, [teams]);

  async function handleRun() {
    if (!teamA || !teamB || teamA === teamB) {
      setError("Choisis deux equipes differentes.");
      return;
    }
    setError(null);
    setRunning(true);
    try {
      const out = await fetchJSON<SimRunResult>("/admin/sim/run", {
        method: "POST",
        body: JSON.stringify({ teamA, teamB, runs, seed }),
      });
      setResult(out);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            🎲 Simulateur Pro League
          </h1>
          <p className="text-sm text-gray-600">
            Utilitaire Phase 0 : declenche une simulation deterministe et
            affiche le rapport stat. Sera remplace par la vraie UI Pro
            League en Phase 1 (lots 1.A / 1.B / 1.C).
          </p>
        </div>
        <EngineVersionsBadge variant="inline" />
      </header>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          ⚠️ {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Parametres</h2>
        {loading ? (
          <p className="text-gray-500">Chargement des equipes…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">
                Equipe domicile
              </span>
              <select
                value={teamA}
                onChange={(e) => setTeamA(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2"
                disabled={running}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {teamLabel(t.id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">
                Equipe visiteur
              </span>
              <select
                value={teamB}
                onChange={(e) => setTeamB(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2"
                disabled={running}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {teamLabel(t.id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">
                Nombre de matchs
              </span>
              <select
                value={runs}
                onChange={(e) => setRuns(Number.parseInt(e.target.value, 10))}
                className="border border-gray-300 rounded px-3 py-2"
                disabled={running}
              >
                {RUN_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700">
                Seed (replay deterministe)
              </span>
              <input
                type="number"
                min={0}
                value={seed}
                onChange={(e) =>
                  setSeed(Math.max(0, Number.parseInt(e.target.value, 10) || 0))
                }
                className="border border-gray-300 rounded px-3 py-2"
                disabled={running}
              />
            </label>
          </div>
        )}
        <button
          type="button"
          onClick={handleRun}
          disabled={loading || running || !teamA || !teamB || teamA === teamB}
          className="mt-4 px-6 py-2 rounded-lg bg-nuffle-anthracite text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? "Simulation en cours…" : "Lancer la simulation"}
        </button>
      </section>

      {result && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm space-y-4">
          <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
            <h2 className="text-lg font-semibold break-words">
              {result.pairing.home.name} vs {result.pairing.away.name}
            </h2>
            <span className="text-xs text-gray-500">
              {result.matches} matchs simules
            </span>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Metric label="TD / match" value={result.metrics.td.mean.toFixed(2)} subtle={`std ${result.metrics.td.std.toFixed(2)}`} />
            <Metric label="Casualties" value={result.metrics.casualties.mean.toFixed(2)} />
            <Metric label="Turnovers" value={result.metrics.turnovers.mean.toFixed(2)} />
            <Metric
              label="Outcomes"
              value={`${result.metrics.outcomes.home}–${result.metrics.outcomes.away}–${result.metrics.outcomes.draw}`}
              subtle="V D N"
            />
            <Metric
              label=">=5 TD"
              value={`${(result.metrics.fatTails.highScoring * 100).toFixed(1)}%`}
            />
            <Metric
              label=">=4 cas"
              value={`${(result.metrics.fatTails.bloodbath * 100).toFixed(1)}%`}
            />
            <Metric
              label="Upset rate"
              value={`${(result.metrics.outcomes.upsetRate * 100).toFixed(1)}%`}
              subtle={result.favorite ? `fav. ${result.favorite}` : "no fav."}
            />
            <Metric
              label="Sprint targets"
              value={`${result.metrics.meetsTargets.stdDevTd ? "✓" : "✗"} std / ${result.metrics.meetsTargets.upsetRate ? "✓" : "✗"} upset`}
            />
          </div>

          <details className="bg-gray-50 rounded p-3">
            <summary className="cursor-pointer font-medium text-sm">
              Rapport texte (CLI-style)
            </summary>
            <pre className="mt-2 text-xs whitespace-pre-wrap font-mono">{result.report}</pre>
          </details>

          <details className="bg-gray-50 rounded p-3">
            <summary className="cursor-pointer font-medium text-sm">
              Reponse JSON brute
            </summary>
            <pre className="mt-2 text-xs whitespace-pre-wrap font-mono">{JSON.stringify(result, null, 2)}</pre>
          </details>
        </section>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  subtle,
}: {
  label: string;
  value: string;
  subtle?: string;
}) {
  return (
    <div className="bg-gray-50 rounded p-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-lg font-semibold text-nuffle-anthracite">{value}</div>
      {subtle && <div className="text-xs text-gray-500">{subtle}</div>}
    </div>
  );
}
