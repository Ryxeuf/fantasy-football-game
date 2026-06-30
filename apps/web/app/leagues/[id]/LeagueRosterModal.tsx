"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api-client";

// Roster en lecture seule d'un participant de la ligue. Tout coach inscrit
// peut consulter les rosters des autres équipes (route serveur
// `/leagues/:leagueId/teams/:teamId/roster-view`, gardée participant/commissaire).

interface RosterPlayer {
  id: string;
  name: string;
  position: string;
  /** Nom d'affichage lisible (fallback : slug technique). */
  positionName?: string;
  number: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string;
  spp: number;
  dead: boolean;
}

interface RosterResponse {
  team: { id: string; name: string; roster: string; treasury: number };
  players: RosterPlayer[];
}

interface Props {
  leagueId: string;
  teamId: string;
  teamName: string;
  onClose: () => void;
}

function formatSkills(raw: string): string {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

export function LeagueRosterModal({
  leagueId,
  teamId,
  teamName,
  onClose,
}: Props) {
  const [data, setData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<RosterResponse>(
      `/leagues/${leagueId}/teams/${teamId}/roster-view`,
    )
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, teamId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto p-4">
      <div
        data-testid="league-roster-modal"
        className="bg-white rounded-lg shadow-2xl max-w-3xl w-full my-4 p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-nuffle-anthracite">
            Roster — {teamName}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {error ? (
          <p
            data-testid="league-roster-error"
            className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1"
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-gray-500">Chargement…</p>
        ) : data ? (
          <>
            <div className="text-xs text-gray-600">
              {data.team.roster} · {data.players.length} joueur
              {data.players.length > 1 ? "s" : ""}
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500">
                  <tr className="border-b">
                    <th className="px-1 py-1 text-left">N°</th>
                    <th className="px-1 py-1 text-left">Nom</th>
                    <th className="px-1 py-1 text-left">Poste</th>
                    <th className="px-1 py-1 text-right">MA</th>
                    <th className="px-1 py-1 text-right">ST</th>
                    <th className="px-1 py-1 text-right">AG</th>
                    <th className="px-1 py-1 text-right">PA</th>
                    <th className="px-1 py-1 text-right">AV</th>
                    <th className="px-1 py-1 text-left">Compétences</th>
                    <th className="px-1 py-1 text-right">SPP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.players.map((p) => (
                    <tr
                      key={p.id}
                      className={`border-b border-gray-100 ${
                        p.dead ? "text-gray-400 line-through" : ""
                      }`}
                    >
                      <td className="px-1 py-1 tabular-nums">{p.number}</td>
                      <td className="px-1 py-1">
                        {p.name}
                        {p.dead ? " ☠" : ""}
                      </td>
                      <td className="px-1 py-1 text-gray-600">
                        {p.positionName ?? p.position}
                      </td>
                      <td className="px-1 py-1 text-right tabular-nums">
                        {p.ma}
                      </td>
                      <td className="px-1 py-1 text-right tabular-nums">
                        {p.st}
                      </td>
                      <td className="px-1 py-1 text-right tabular-nums">
                        {p.ag}+
                      </td>
                      <td className="px-1 py-1 text-right tabular-nums">
                        {p.pa === null ? "–" : `${p.pa}+`}
                      </td>
                      <td className="px-1 py-1 text-right tabular-nums">
                        {p.av}+
                      </td>
                      <td className="px-1 py-1 text-xs text-gray-600">
                        {formatSkills(p.skills) || "—"}
                      </td>
                      <td className="px-1 py-1 text-right tabular-nums">
                        {p.spp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
