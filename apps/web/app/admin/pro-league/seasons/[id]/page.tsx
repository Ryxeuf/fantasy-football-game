"use client";

/**
 * Page admin de detail d'une saison Pro League.
 *
 * Affiche : meta saison, liste des rounds (avec compteur matches),
 * standings ordonnees par points. Liens vers les pages associees
 * (admin/sim/replays filtrees, gestion de rounds — futur).
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { API_BASE } from "../../../../auth-client";
import SeasonMatches from "./_components/SeasonMatches";

interface SeasonDetail {
  season: {
    id: string;
    leagueId: string;
    year: number;
    status: string;
    driverKind: string;
    engineVer: string;
    startsAt: string | null;
    endsAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  rounds: Array<{
    id: string;
    roundNumber: number;
    status: string;
    scheduledAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    _count: { matches: number };
  }>;
  standings: Array<{
    teamId: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    points: number;
    tdFor: number;
    tdAgainst: number;
    team: { name: string; slug: string; race: string };
  }>;
}

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
  return json;
}

const ROUND_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
};

export default function AdminProSeasonDetailPage() {
  const params = useParams();
  const seasonId = typeof params.id === "string" ? params.id : "";

  const [data, setData] = useState<SeasonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetched = await fetchJSON(`/admin/pro-league/seasons/${seasonId}`);
      setData(fetched);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    if (seasonId) load();
  }, [load, seasonId]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4" />
          <p className="text-gray-600">Chargement…</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const { season, rounds, standings } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite">
            Saison {season.year}
          </h1>
          <p className="text-sm text-gray-600 font-mono">{season.id}</p>
        </div>
        <Link
          href="/admin/pro-league/seasons"
          className="text-sm text-blue-600 hover:underline"
        >
          ← Liste des saisons
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-gray-600">Statut</div>
          <div className="font-bold">{season.status}</div>
        </div>
        <div>
          <div className="text-gray-600">Driver</div>
          <div className="font-bold font-mono">{season.driverKind}</div>
        </div>
        <div>
          <div className="text-gray-600">Engine</div>
          <div className="font-bold font-mono">{season.engineVer}</div>
        </div>
        <div>
          <div className="text-gray-600">Cree le</div>
          <div className="font-bold">
            {new Date(season.createdAt).toLocaleDateString("fr-FR")}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-3">
          Rounds ({rounds.length})
        </h2>
        {rounds.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            Aucun round. Genere le calendrier depuis la liste des saisons.
          </p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">#</th>
                <th className="text-left p-2">Statut</th>
                <th className="text-left p-2">Programme</th>
                <th className="text-right p-2">Matches</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((r) => (
                <tr
                  key={r.id}
                  data-testid={`round-row-${r.id}`}
                  className="border-t border-gray-100"
                >
                  <td className="p-2 font-semibold">{r.roundNumber}</td>
                  <td className="p-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        ROUND_STATUS_COLORS[r.status] ?? "bg-gray-100"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="p-2 text-xs text-gray-600">
                    {r.scheduledAt
                      ? new Date(r.scheduledAt).toLocaleString("fr-FR")
                      : "—"}
                  </td>
                  <td className="p-2 text-right">{r._count.matches}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SeasonMatches seasonId={season.id} totalRounds={rounds.length} />

      <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-3">
          Classement ({standings.length})
        </h2>
        {standings.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Aucun standing.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">#</th>
                <th className="text-left p-2">Equipe</th>
                <th className="text-left p-2">Race</th>
                <th className="text-right p-2">J</th>
                <th className="text-right p-2">V</th>
                <th className="text-right p-2">N</th>
                <th className="text-right p-2">D</th>
                <th className="text-right p-2">TD+</th>
                <th className="text-right p-2">TD-</th>
                <th className="text-right p-2">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, idx) => (
                <tr
                  key={s.teamId}
                  data-testid={`standing-row-${s.teamId}`}
                  className="border-t border-gray-100"
                >
                  <td className="p-2 text-gray-500">{idx + 1}</td>
                  <td className="p-2 font-medium">{s.team.name}</td>
                  <td className="p-2 text-xs text-gray-600">{s.team.race}</td>
                  <td className="p-2 text-right">{s.played}</td>
                  <td className="p-2 text-right">{s.wins}</td>
                  <td className="p-2 text-right">{s.draws}</td>
                  <td className="p-2 text-right">{s.losses}</td>
                  <td className="p-2 text-right">{s.tdFor}</td>
                  <td className="p-2 text-right">{s.tdAgainst}</td>
                  <td className="p-2 text-right font-bold">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
