"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api-client";

interface MatchTeamInfo {
  coachName: string;
  teamName: string;
  rosterName?: string;
}

interface MatchSummary {
  id: string;
  status: string;
  createdAt: string;
  lastMoveAt: string | null;
  isMyTurn: boolean;
  score: { teamA: number; teamB: number };
  half: number;
  turn: number;
  myTeam: MatchTeamInfo | null;
  opponent: MatchTeamInfo | null;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "active": return "En cours";
    case "pending": return "En attente";
    case "prematch": return "Pré-match";
    case "prematch-setup": return "Configuration";
    case "ended": return "Terminé";
    case "cancelled": return "Annulé";
    default: return status;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "active": return "bg-green-500";
    case "pending": return "bg-yellow-500";
    case "prematch": case "prematch-setup": return "bg-blue-500";
    case "ended": return "bg-gray-500";
    case "cancelled": return "bg-red-500";
    default: return "bg-gray-400";
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function MyMatchesPage() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "my-turn" | "active" | "ended">("all");

  useEffect(() => {
    apiRequest<{ matches: MatchSummary[] }>("/match/my-matches")
      .then((data) => setMatches(data.matches || []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = matches.filter((m) => {
    if (filter === "my-turn") return m.isMyTurn && m.status === "active";
    if (filter === "active") return m.status === "active" || m.status === "prematch" || m.status === "prematch-setup";
    if (filter === "ended") return m.status === "ended";
    return true;
  });

  const myTurnCount = matches.filter((m) => m.isMyTurn && m.status === "active").length;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Mes matchs</h1>
        {myTurnCount > 0 && (
          <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-semibold animate-pulse">
            {myTurnCount} match{myTurnCount > 1 ? "s" : ""} en attente de votre tour
          </span>
        )}
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {(["all", "my-turn", "active", "ended"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {f === "all" ? "Tous" : f === "my-turn" ? `Mon tour (${myTurnCount})` : f === "active" ? "En cours" : "Terminés"}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400">Chargement...</p>}
      {error && <p className="text-red-400">Erreur : {error}</p>}

      {!loading && filtered.length === 0 && (
        <p className="text-gray-400">Aucun match trouvé.</p>
      )}

      {/* Liste des matchs */}
      <div className="space-y-3">
        {filtered.map((m) => (
          <a
            key={m.id}
            href={m.status === "active" || m.status === "prematch" || m.status === "prematch-setup"
              ? `/play/${m.id}`
              : m.status === "pending"
                ? `/waiting/${m.id}`
                : "#"}
            className={`block p-4 rounded-lg border transition-colors ${
              m.isMyTurn && m.status === "active"
                ? "border-green-500 bg-green-900/20 hover:bg-green-900/30"
                : "border-gray-700 bg-gray-800/50 hover:bg-gray-800"
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${getStatusColor(m.status)}`} />
                  <span className="text-sm text-gray-400">{getStatusLabel(m.status)}</span>
                  {m.isMyTurn && m.status === "active" && (
                    <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">Votre tour</span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-white">
                  <span className="font-semibold">
                    {m.myTeam?.teamName || "Mon équipe"}
                  </span>
                  {m.status !== "pending" && (
                    <span className="text-lg font-bold text-yellow-400">
                      {m.score.teamA} - {m.score.teamB}
                    </span>
                  )}
                  <span className="font-semibold">
                    {m.opponent?.teamName || "En attente..."}
                  </span>
                </div>

                <div className="text-xs text-gray-500 mt-1">
                  {m.opponent?.coachName && `vs Coach ${m.opponent.coachName}`}
                  {m.half > 0 && ` | Mi-temps ${m.half}, Tour ${m.turn}`}
                </div>
              </div>

              <div className="text-right text-xs text-gray-500">
                <div>{formatDate(m.createdAt)}</div>
                {m.lastMoveAt && (
                  <div>Dernier coup : {formatDate(m.lastMoveAt)}</div>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
