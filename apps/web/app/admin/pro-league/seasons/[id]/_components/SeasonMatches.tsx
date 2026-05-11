"use client";

/**
 * Section "Matchs" pour la page detail saison admin Pro League.
 *
 * Filtres : roundNumber (select), status (select). Affiche la liste
 * paginee par roundNumber asc puis scheduledAt asc. Action "Simuler"
 * par ligne pour les matchs non-finaux + lien vers replay si replayId.
 */

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../../../../auth-client";

interface MatchRow {
  id: string;
  status: string;
  scheduledAt: string;
  simulatedAt: string | null;
  completedAt: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  outcome: string | null;
  isTest: boolean;
  replayId: string | null;
  homeTeam: { name: string; slug: string };
  awayTeam: { name: string; slug: string };
  round: { roundNumber: number };
}

interface SeasonMatchesProps {
  seasonId: string;
  /** Total des rounds dans la saison (pour le select). */
  totalRounds: number;
}

async function fetchJSON(path: string, options?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
  return json;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-gray-100 text-gray-700",
  ready: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

const FINAL_STATUSES = new Set(["completed", "failed"]);

export default function SeasonMatches({
  seasonId,
  totalRounds,
}: SeasonMatchesProps) {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roundFilter, setRoundFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [simulating, setSimulating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (roundFilter) params.append("roundNumber", roundFilter);
      if (statusFilter) params.append("status", statusFilter);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const data = await fetchJSON(
        `/admin/pro-league/seasons/${seasonId}/matches${qs}`,
      );
      setMatches(data.matches ?? []);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }, [seasonId, roundFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSimulate = async (matchId: string) => {
    if (!confirm("Simuler ce match maintenant ?")) return;
    setSimulating(matchId);
    try {
      const result = await fetchJSON(
        `/admin/pro-league/matches/${matchId}/simulate`,
        { method: "POST", body: "{}" },
      );
      if (result.simulated === false) {
        alert("Le match est deja dans un status final.");
      }
      await load();
    } catch (e: any) {
      alert(e.message || "Erreur lors de la simulation");
    } finally {
      setSimulating(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h2 className="text-lg font-semibold">Matchs</h2>
        <div className="flex gap-2 items-center">
          <select
            data-testid="round-filter"
            value={roundFilter}
            onChange={(e) => setRoundFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1"
          >
            <option value="">Tous les rounds</option>
            {Array.from({ length: totalRounds }, (_, i) => i + 1).map((n) => (
              <option key={n} value={String(n)}>
                Round {n}
              </option>
            ))}
          </select>
          <select
            data-testid="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1"
          >
            <option value="">Tous les statuts</option>
            <option value="scheduled">scheduled</option>
            <option value="ready">ready</option>
            <option value="in_progress">in_progress</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 italic">Chargement…</p>
      ) : matches.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          Aucun match avec ces filtres.
        </p>
      ) : (
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Round</th>
              <th className="text-left p-2">Equipes</th>
              <th className="text-left p-2">Statut</th>
              <th className="text-right p-2">Score</th>
              <th className="text-left p-2">Programme</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => {
              const isFinal = FINAL_STATUSES.has(m.status);
              const score =
                m.scoreHome !== null && m.scoreAway !== null
                  ? `${m.scoreHome} - ${m.scoreAway}`
                  : "—";
              return (
                <tr
                  key={m.id}
                  data-testid={`match-row-${m.id}`}
                  className="border-t border-gray-100"
                >
                  <td className="p-2 font-semibold">{m.round.roundNumber}</td>
                  <td className="p-2">
                    <span className="font-medium">{m.homeTeam.name}</span>{" "}
                    <span className="text-gray-400">vs</span>{" "}
                    <span className="font-medium">{m.awayTeam.name}</span>
                  </td>
                  <td className="p-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[m.status] ?? "bg-gray-100"
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="p-2 text-right font-mono">{score}</td>
                  <td className="p-2 text-xs text-gray-600">
                    {new Date(m.scheduledAt).toLocaleString("fr-FR")}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-2 flex-wrap">
                      {!isFinal && (
                        <button
                          onClick={() => handleSimulate(m.id)}
                          disabled={simulating === m.id}
                          data-testid={`btn-simulate-${m.id}`}
                          className="px-2 py-1 text-xs text-white bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-50"
                        >
                          {simulating === m.id ? "…" : "Simuler"}
                        </button>
                      )}
                      {m.replayId && (
                        <a
                          href={`/pro-league/matches/${m.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          Replay
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
