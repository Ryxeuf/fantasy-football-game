"use client";

/**
 * Console admin — sandbox / test match (Lot 2.C.4).
 *
 * Permet à un admin de lancer un match Pro League depuis le navigateur
 * sans impact ELO / standings / paris / wallet. Une fois lancé, le
 * replay est accessible via le viewer normal (avec banner "TEST MATCH"
 * — Lot 2.C.5).
 *
 * Affiche également les 20 derniers test matchs lancés pour relancer /
 * comparer rapidement.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE } from "../../../auth-client";

interface Team {
  id: string;
  city: string;
  name: string;
  race: string;
  nflFlavor: string;
}

interface CreateResult {
  matchId: string;
  seasonId: string;
  engineVer: string;
}

interface TestMatchSummary {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  status: string;
  scoreHome: number | null;
  scoreAway: number | null;
  outcome: string | null;
  engineVer: string | null;
  createdAt: string;
  simulatedAt: string | null;
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

export default function AdminTestMatchPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [homeTeamId, setHomeTeamId] = useState<string>("");
  const [awayTeamId, setAwayTeamId] = useState<string>("");
  const [list, setList] = useState<TestMatchSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CreateResult | null>(null);

  const loadTeams = async () => {
    const data = await fetchJSON<{ teams: Team[] }>("/admin/sim/teams");
    setTeams(data.teams);
    if (data.teams.length >= 2) {
      setHomeTeamId(data.teams[0].id);
      setAwayTeamId(data.teams[1].id);
    }
  };

  const loadList = async () => {
    const data = await fetchJSON<{ matches: TestMatchSummary[] }>(
      "/admin/sim/test-matches?limit=20",
    );
    setList(data.matches);
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await Promise.all([loadTeams(), loadList()]);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const launch = async () => {
    if (homeTeamId === awayTeamId) {
      setError("Choisis deux équipes différentes.");
      return;
    }
    setRunning(true);
    setError(null);
    setLastResult(null);
    try {
      const result = await fetchJSON<CreateResult>(
        "/admin/sim/test-match",
        {
          method: "POST",
          body: JSON.stringify({ homeTeamId, awayTeamId }),
        },
      );
      setLastResult(result);
      await loadList();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Sandbox — test match</h1>
      <p className="text-sm text-gray-600 mb-4">
        Lance un match Pro League sans impact ELO / standings / paris /
        wallet. Le replay est accessible immédiatement après simulation
        (~50ms). Les matchs créés ici sont marqués <code>isTest=true</code>
        et exclus des statistiques agrégées.
      </p>

      <div className="grid grid-cols-3 gap-3 items-end mb-4 p-4 border rounded bg-white">
        <label className="text-sm">
          <div className="mb-1">Équipe à domicile</div>
          <select
            value={homeTeamId}
            onChange={(e) => setHomeTeamId(e.target.value)}
            className="w-full border rounded p-2"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.city} {t.name} ({t.race})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="mb-1">Équipe à l&apos;extérieur</div>
          <select
            value={awayTeamId}
            onChange={(e) => setAwayTeamId(e.target.value)}
            className="w-full border rounded p-2"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.city} {t.name} ({t.race})
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => void launch()}
          disabled={running || loading || homeTeamId === awayTeamId}
          className="px-4 py-2 rounded bg-nuffle-gold text-white font-medium disabled:opacity-50"
        >
          {running ? "Simulation…" : "Lancer le match test"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 border border-red-300 bg-red-50 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {lastResult && (
        <div className="mb-4 p-3 border border-green-300 bg-green-50 rounded text-sm">
          Match simulé : <code>{lastResult.matchId}</code> (engineVer{" "}
          {lastResult.engineVer}) ·{" "}
          <Link
            href={`/pro-league/match/${lastResult.matchId}` as never}
            className="underline text-green-700"
          >
            Voir le replay
          </Link>
        </div>
      )}

      <h2 className="text-lg font-semibold mb-2 mt-6">
        Derniers matchs test ({list.length})
      </h2>
      {list.length === 0 ? (
        <p className="text-sm text-gray-500">
          Aucun match test pour le moment.
        </p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Match</th>
              <th className="text-right p-2">Score</th>
              <th className="text-right p-2">Status</th>
              <th className="text-right p-2">engineVer</th>
              <th className="text-right p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id} className="border-b">
                <td className="p-2 text-gray-500 text-xs">
                  {new Date(m.createdAt).toLocaleString()}
                </td>
                <td className="p-2">
                  {m.homeTeamName}{" "}
                  <span className="text-gray-400">vs</span> {m.awayTeamName}
                </td>
                <td className="p-2 text-right font-mono">
                  {m.scoreHome ?? "-"} - {m.scoreAway ?? "-"}
                </td>
                <td className="p-2 text-right">{m.status}</td>
                <td className="p-2 text-right text-gray-500 text-xs">
                  {m.engineVer ?? "-"}
                </td>
                <td className="p-2 text-right">
                  <Link
                    href={`/pro-league/match/${m.id}` as never}
                    className="text-blue-600 underline"
                  >
                    Replay
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
