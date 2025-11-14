"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../auth-client";

type LocalMatch = {
  id: string;
  name: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  creator: {
    id: string;
    coachName: string;
    email: string;
  };
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
  };
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

async function deleteJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`,
    );
  return res.json();
}

export default function AdminLocalMatchesPage() {
  const router = useRouter();
  const [localMatches, setLocalMatches] = useState<LocalMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    loadLocalMatches();
  }, [statusFilter]);

  const loadLocalMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchJSON("/auth/me");
      if (me?.user?.role !== "admin") {
        window.location.href = "/";
        return;
      }
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      params.append("all", "true");
      const { localMatches: data } = await fetchJSON(
        `/local-match?${params.toString()}`,
      );
      setLocalMatches(data);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (matchId: string, matchName: string | null) => {
    if (
      !confirm(
        `Êtes-vous sûr de vouloir supprimer la partie "${
          matchName || "sans nom"
        }" ? Cette action est irréversible.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await deleteJSON(`/local-match/${matchId}`);
      loadLocalMatches();
    } catch (e: any) {
      setError(e.message || "Erreur lors de la suppression");
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "En attente";
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

  const filteredMatches = localMatches.filter((match) => {
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        (match.name?.toLowerCase().includes(searchLower) || false) ||
        match.teamA.name.toLowerCase().includes(searchLower) ||
        match.teamB.name.toLowerCase().includes(searchLower) ||
        match.creator.coachName.toLowerCase().includes(searchLower) ||
        match.creator.email.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-nuffle-ivory via-white to-nuffle-ivory/50 p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-nuffle-ivory via-white to-nuffle-ivory/50">
      <div className="mb-6">
        <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-2">
          🎯 Gestion des Matchs Locaux
        </h1>
        <p className="text-gray-600">
          Administration de toutes les parties offline (Match Local)
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, équipe, créateur..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nuffle-gold focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrer par statut
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nuffle-gold focus:border-transparent"
            >
              <option value="">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="in_progress">En cours</option>
              <option value="completed">Terminées</option>
              <option value="cancelled">Annulées</option>
            </select>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-2xl font-bold text-nuffle-anthracite">
            {localMatches.length}
          </div>
          <div className="text-sm text-gray-600">Total</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-2xl font-bold text-yellow-600">
            {localMatches.filter((m) => m.status === "pending").length}
          </div>
          <div className="text-sm text-gray-600">En attente</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-2xl font-bold text-blue-600">
            {localMatches.filter((m) => m.status === "in_progress").length}
          </div>
          <div className="text-sm text-gray-600">En cours</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-2xl font-bold text-green-600">
            {localMatches.filter((m) => m.status === "completed").length}
          </div>
          <div className="text-sm text-gray-600">Terminées</div>
        </div>
      </div>

      {/* Liste des matchs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom / ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Équipes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Créateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Aucun match local trouvé
                  </td>
                </tr>
              ) : (
                filteredMatches.map((match) => (
                  <tr
                    key={match.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {match.name || "Sans nom"}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {match.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <div>{match.teamA.name}</div>
                        <div className="text-xs text-gray-500">
                          vs {match.teamB.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {match.creator.coachName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {match.creator.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                          match.status,
                        )}`}
                      >
                        {getStatusLabel(match.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {match.status === "completed" &&
                      match.scoreTeamA !== null &&
                      match.scoreTeamB !== null
                        ? `${match.scoreTeamA} - ${match.scoreTeamB}`
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>Créée: {formatDate(match.createdAt)}</div>
                      {match.startedAt && (
                        <div className="text-xs">
                          Début: {formatDate(match.startedAt)}
                        </div>
                      )}
                      {match.completedAt && (
                        <div className="text-xs">
                          Fin: {formatDate(match.completedAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            router.push(`/local-matches/${match.id}`)
                          }
                          className="text-nuffle-gold hover:text-nuffle-bronze"
                        >
                          Voir
                        </button>
                        <button
                          onClick={() =>
                            handleDelete(match.id, match.name)
                          }
                          className="text-red-600 hover:text-red-800"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

