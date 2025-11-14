"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../auth-client";

type LocalMatch = {
  id: string;
  name: string | null;
  status: string; // "pending", "in_progress", "completed", "cancelled"
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  teamA: {
    id: string;
    name: string;
    roster: string;
    owner: {
      id: string;
      coachName: string;
    };
  };
  teamB: {
    id: string;
    name: string;
    roster: string;
    owner: {
      id: string;
      coachName: string;
    };
  } | null;
  cup: {
    id: string;
    name: string;
    status: string;
  } | null;
  scoreTeamA: number | null;
  scoreTeamB: number | null;
};

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

export default function LocalMatchesPage() {
  const router = useRouter();
  const [localMatches, setLocalMatches] = useState<LocalMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    loadLocalMatches();
  }, [statusFilter]);

  const loadLocalMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const { localMatches: data } = await fetchJSON(`/local-match${params}`);
      setLocalMatches(data);
    } catch (e: any) {
      console.error("Erreur lors du chargement des parties offline:", e);
      setError(e.message || "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "En attente";
      case "waiting_for_player":
        return "En attente de joueur";
      case "in_progress":
        return "En cours";
      case "completed":
        return "Terminée";
      case "cancelled":
        return "Annulée";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "waiting_for_player":
        return "bg-orange-100 text-orange-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-nuffle-ivory via-white to-nuffle-ivory/50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-nuffle-anthracite">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-nuffle-ivory via-white to-nuffle-ivory/50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-nuffle-anthracite">
            Parties Offline (Match Local)
          </h1>
          <button
            onClick={() => router.push("/local-matches/new")}
            className="px-4 py-2 bg-nuffle-gold text-nuffle-anthracite rounded-lg font-semibold hover:bg-nuffle-bronze transition-colors"
          >
            + Créer une partie
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-nuffle-anthracite mb-2">
            Filtrer par statut:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-white text-nuffle-anthracite rounded-lg border border-gray-300"
          >
            <option value="all">Toutes</option>
            <option value="pending">En attente</option>
            <option value="waiting_for_player">En attente de joueur</option>
            <option value="in_progress">En cours</option>
            <option value="completed">Terminées</option>
            <option value="cancelled">Annulées</option>
          </select>
        </div>

        {localMatches.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center shadow-sm">
            <p className="text-nuffle-anthracite text-lg mb-4">
              Aucune partie offline trouvée
            </p>
            <button
              onClick={() => router.push("/local-matches/new")}
              className="px-4 py-2 bg-nuffle-gold text-nuffle-anthracite rounded-lg font-semibold hover:bg-nuffle-bronze transition-colors"
            >
              Créer votre première partie
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {localMatches.map((match) => (
              <div
                key={match.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all cursor-pointer shadow-sm"
                onClick={() => router.push(`/local-matches/${match.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-nuffle-anthracite">
                        {match.name || "Partie sans nom"}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(
                          match.status,
                        )}`}
                      >
                        {getStatusLabel(match.status)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">
                          Équipe A
                        </p>
                        <p className="font-semibold text-nuffle-anthracite">
                          {match.teamA.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {match.teamA.roster}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">
                          Équipe B
                        </p>
                        {match.teamB ? (
                          <>
                            <p className="font-semibold text-nuffle-anthracite">
                              {match.teamB.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {match.teamB.roster}
                            </p>
                          </>
                        ) : (
                          <p className="font-semibold text-gray-400 italic">
                            En attente d'une équipe
                          </p>
                        )}
                      </div>
                    </div>
                    {match.status === "completed" &&
                      match.scoreTeamA !== null &&
                      match.scoreTeamB !== null && (
                        <div className="mb-3">
                          <p className="text-lg font-bold text-nuffle-anthracite">
                            Score: {match.scoreTeamA} - {match.scoreTeamB}
                          </p>
                        </div>
                      )}
                    {match.cup && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-600">
                          Coupe: {match.cup.name}
                        </p>
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      Créée le {formatDate(match.createdAt)}
                      {match.startedAt && (
                        <> • Commencée le {formatDate(match.startedAt)}</>
                      )}
                      {match.completedAt && (
                        <> • Terminée le {formatDate(match.completedAt)}</>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

