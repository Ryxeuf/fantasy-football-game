"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../auth-client";

type TeamSelection = {
  user: { id: string; coachName: string; email: string };
  teamRef: { id: string; name: string; roster: string } | null;
  team: string;
};

type Match = {
  id: string;
  status: string;
  seed: string;
  createdAt: string;
  lastMoveAt: string | null;
  currentTurnUserId: string | null;
  creator: { id: string; email: string; coachName: string } | null;
  teamSelections: TeamSelection[];
  _count: { turns: number; players: number };
};

type StatusCounts = {
  pending: number;
  prematch: number;
  "prematch-setup": number;
  active: number;
  ended: number;
  cancelled: number;
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

async function patchJSON(path: string, data: any) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
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

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  prematch: "Pré-match",
  "prematch-setup": "Setup",
  active: "En cours",
  ended: "Terminée",
  cancelled: "Annulée",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  prematch: "bg-orange-100 text-orange-800",
  "prematch-setup": "bg-indigo-100 text-indigo-800",
  active: "bg-blue-100 text-blue-800",
  ended: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function AdminMatchesPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadMatches();
  }, [statusFilter]);

  const loadMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await fetchJSON("/auth/me");
      const user = me?.user;
      const roles: string[] | undefined = Array.isArray(user?.roles)
        ? user.roles
        : user?.role
          ? [user.role]
          : undefined;
      if (!roles || !roles.includes("admin")) {
        window.location.href = "/";
        return;
      }
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (search) params.append("search", search);
      const data = await fetchJSON(`/admin/matches?${params.toString()}`);
      setMatches(data.matches);
      setStatusCounts(data.statusCounts);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadMatches();
  };

  const handleChangeStatus = async (matchId: string, newStatus: string) => {
    const statusLabel = STATUS_LABELS[newStatus] || newStatus;
    if (
      !confirm(
        `Changer le statut de cette partie en "${statusLabel}" ?`,
      )
    ) {
      return;
    }
    setActionLoading(matchId);
    setError(null);
    try {
      await patchJSON(`/admin/matches/${matchId}/status`, {
        status: newStatus,
      });
      loadMatches();
    } catch (e: any) {
      setError(e.message || "Erreur lors du changement de statut");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (matchId: string) => {
    if (
      !confirm(
        `Supprimer cette partie et toutes ses données (tours, selections) ? Cette action est irréversible.`,
      )
    ) {
      return;
    }
    setActionLoading(matchId);
    setError(null);
    try {
      await deleteJSON(`/admin/matches/${matchId}`);
      loadMatches();
    } catch (e: any) {
      setError(e.message || "Erreur lors de la suppression");
    } finally {
      setActionLoading(null);
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

  const getTeamInfo = (match: Match, index: 0 | 1) => {
    const sel = match.teamSelections[index];
    if (!sel) return null;
    return {
      teamName: sel.teamRef?.name || sel.team || "?",
      roster: sel.teamRef?.roster || "",
      coach: sel.user.coachName || sel.user.email,
    };
  };

  const totalMatches = statusCounts
    ? Object.values(statusCounts).reduce((a, b) => a + b, 0)
    : matches.length;

  const filteredMatches = matches.filter((match) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const teamA = getTeamInfo(match, 0);
    const teamB = getTeamInfo(match, 1);
    return (
      match.id.toLowerCase().includes(s) ||
      match.seed.toLowerCase().includes(s) ||
      match.status.toLowerCase().includes(s) ||
      (match.creator?.coachName?.toLowerCase().includes(s) ?? false) ||
      (match.creator?.email?.toLowerCase().includes(s) ?? false) ||
      (teamA?.teamName?.toLowerCase().includes(s) ?? false) ||
      (teamA?.coach?.toLowerCase().includes(s) ?? false) ||
      (teamB?.teamName?.toLowerCase().includes(s) ?? false) ||
      (teamB?.coach?.toLowerCase().includes(s) ?? false)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
          Gestion des Parties
        </h1>
        <p className="text-sm text-gray-600">
          Administration des parties en ligne (matchmaking)
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <span>!</span>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            x
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-2xl font-bold text-nuffle-anthracite">
            {totalMatches}
          </div>
          <div className="text-sm text-gray-600">Total</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-2xl font-bold text-yellow-600">
            {statusCounts?.pending ?? 0}
          </div>
          <div className="text-sm text-gray-600">En attente</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-2xl font-bold text-orange-600">
            {(statusCounts?.prematch ?? 0) +
              (statusCounts?.["prematch-setup"] ?? 0)}
          </div>
          <div className="text-sm text-gray-600">Pré-match</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-2xl font-bold text-blue-600">
            {statusCounts?.active ?? 0}
          </div>
          <div className="text-sm text-gray-600">En cours</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-2xl font-bold text-green-600">
            {statusCounts?.ended ?? 0}
          </div>
          <div className="text-sm text-gray-600">Terminées</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="text-2xl font-bold text-red-600">
            {statusCounts?.cancelled ?? 0}
          </div>
          <div className="text-sm text-gray-600">Annulées</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="ID, seed, coach, equipe..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nuffle-gold focus:border-transparent"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-nuffle-gold text-white rounded-lg hover:bg-nuffle-bronze transition-colors"
              >
                Chercher
              </button>
            </div>
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
              <option value="prematch">Pré-match</option>
              <option value="prematch-setup">Setup</option>
              <option value="active">En cours</option>
              <option value="ended">Terminées</option>
              <option value="cancelled">Annulées</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadMatches}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Rafraichir
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-nuffle-gold/10 to-nuffle-gold/5">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Equipes
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Créateur
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Tours
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredMatches.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    Aucune partie trouvée
                  </td>
                </tr>
              ) : (
                filteredMatches.map((match) => {
                  const teamA = getTeamInfo(match, 0);
                  const teamB = getTeamInfo(match, 1);
                  const isExpanded = expandedMatch === match.id;
                  const isLoading = actionLoading === match.id;

                  return (
                    <tr
                      key={match.id}
                      className={`hover:bg-gray-50 transition-colors ${isLoading ? "opacity-50" : ""}`}
                    >
                      {/* ID */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() =>
                            setExpandedMatch(isExpanded ? null : match.id)
                          }
                          className="text-left"
                        >
                          <div className="font-mono text-xs text-gray-600">
                            {match.id.slice(0, 8)}...
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            seed: {match.seed.slice(0, 12)}...
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs space-y-1">
                            <div>
                              <span className="font-medium">ID complet:</span>{" "}
                              <span className="font-mono">{match.id}</span>
                            </div>
                            <div>
                              <span className="font-medium">Seed:</span>{" "}
                              <span className="font-mono">{match.seed}</span>
                            </div>
                            <div>
                              <span className="font-medium">Joueurs:</span>{" "}
                              {match._count.players}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Teams */}
                      <td className="px-6 py-4">
                        {teamA ? (
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {teamA.teamName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {teamA.roster} - {teamA.coach}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 italic">
                            En attente
                          </div>
                        )}
                        {teamA && teamB && (
                          <div className="text-xs text-gray-400 my-0.5">
                            vs
                          </div>
                        )}
                        {teamB ? (
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {teamB.teamName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {teamB.roster} - {teamB.coach}
                            </div>
                          </div>
                        ) : (
                          teamA && (
                            <div className="text-xs text-gray-400 italic">
                              vs En attente
                            </div>
                          )
                        )}
                      </td>

                      {/* Creator */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {match.creator ? (
                          <div>
                            <div className="text-sm text-gray-900">
                              {match.creator.coachName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {match.creator.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            STATUS_COLORS[match.status] ||
                            "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {STATUS_LABELS[match.status] || match.status}
                        </span>
                      </td>

                      {/* Turns */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {match._count.turns}
                      </td>

                      {/* Dates */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>Créée: {formatDate(match.createdAt)}</div>
                        {match.lastMoveAt && (
                          <div className="text-xs">
                            Dernier coup: {formatDate(match.lastMoveAt)}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {/* Status change dropdown */}
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleChangeStatus(match.id, e.target.value);
                              }
                            }}
                            disabled={isLoading}
                            className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-nuffle-gold"
                          >
                            <option value="">Changer statut...</option>
                            {Object.entries(STATUS_LABELS)
                              .filter(([key]) => key !== match.status)
                              .map(([key, label]) => (
                                <option key={key} value={key}>
                                  {label}
                                </option>
                              ))}
                          </select>
                          <button
                            onClick={() => handleDelete(match.id)}
                            disabled={isLoading}
                            className="text-xs text-red-600 hover:text-red-800 text-left"
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
