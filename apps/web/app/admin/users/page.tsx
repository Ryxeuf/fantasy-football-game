"use client";
import { useEffect, useState, useCallback } from "react";
import { API_BASE } from "../../auth-client";

type User = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  patreon?: boolean;
  valid?: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    teams: number;
    matches: number;
    createdMatches: number;
    teamSelections: number;
  };
};

type UserDetails = User & {
  teams: Array<{
    id: string;
    name: string;
    roster: string;
    createdAt: string;
    _count: { players: number };
  }>;
  matches: Array<{
    id: string;
    status: string;
    createdAt: string;
  }>;
  createdMatches: Array<{
    id: string;
    status: string;
    createdAt: string;
  }>;
};

type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

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
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error?.error || `Erreur ${res.status}`);
  }
  return res.json();
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        sortBy,
        sortOrder,
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
      });
      const data = await fetchJSON(`/admin/users?${params}`);
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (e: any) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }, [currentPage, sortBy, sortOrder, search, roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(`Voulez-vous vraiment changer le rôle de cet utilisateur en "${newRole}" ?`)) {
      return;
    }
    setActionLoading(userId);
    try {
      await fetchJSON(`/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      await loadUsers();
      if (selectedUser === userId && userDetails) {
        await loadUserDetails(userId);
      }
    } catch (e: any) {
      alert(e.message || "Erreur lors de la modification du rôle");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePatreonChange = async (userId: string, patreon: boolean) => {
    setActionLoading(userId);
    try {
      await fetchJSON(`/admin/users/${userId}/patreon`, {
        method: "PATCH",
        body: JSON.stringify({ patreon }),
      });
      await loadUsers();
      if (selectedUser === userId && userDetails) {
        await loadUserDetails(userId);
      }
    } catch (e: any) {
      alert(e.message || "Erreur lors de la modification du statut Patreon");
    } finally {
      setActionLoading(null);
    }
  };

  const handleValidChange = async (userId: string, valid: boolean) => {
    setActionLoading(userId);
    try {
      await fetchJSON(`/admin/users/${userId}/valid`, {
        method: "PATCH",
        body: JSON.stringify({ valid }),
      });
      await loadUsers();
      if (selectedUser === userId && userDetails) {
        await loadUserDetails(userId);
      }
    } catch (e: any) {
      alert(e.message || "Erreur lors de la modification du statut de validation");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId: string, userEmail: string) => {
    if (
      !confirm(
        `⚠️ ATTENTION: Voulez-vous vraiment supprimer l'utilisateur "${userEmail}" ?\n\nCette action est irréversible.`,
      )
    ) {
      return;
    }
    setActionLoading(userId);
    try {
      await fetchJSON(`/admin/users/${userId}`, {
        method: "DELETE",
      });
      await loadUsers();
    } catch (e: any) {
      alert(e.message || "Erreur lors de la suppression");
    } finally {
      setActionLoading(null);
    }
  };

  const loadUserDetails = async (userId: string) => {
    setSelectedUser(userId);
    try {
      const data = await fetchJSON(`/admin/users/${userId}`);
      setUserDetails(data.user);
    } catch (e: any) {
      alert(e.message || "Erreur lors du chargement des détails");
      setSelectedUser(null);
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <span className="text-gray-400">↕</span>;
    return sortOrder === "asc" ? <span>↑</span> : <span>↓</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            👥 Gestion des Utilisateurs
          </h1>
          <p className="text-sm text-gray-600">
            Gérez les utilisateurs et leurs permissions
          </p>
        </div>
        {pagination && (
          <div className="text-sm text-gray-600 bg-white px-4 py-2 rounded-lg border border-gray-200">
            {pagination.total} utilisateur{pagination.total !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Rechercher (email, nom)..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all bg-white"
          >
            <option value="">Tous les rôles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4"></div>
            <p className="text-gray-500">Chargement...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun utilisateur trouvé</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-nuffle-gold/10 to-nuffle-gold/5">
              <tr>
                <th
                  className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider cursor-pointer hover:bg-nuffle-gold/20 transition-colors"
                  onClick={() => handleSort("email")}
                >
                  <div className="flex items-center gap-2">
                    Email <SortIcon column="email" />
                  </div>
                </th>
                <th
                  className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider cursor-pointer hover:bg-nuffle-gold/20 transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-2">
                    Nom <SortIcon column="name" />
                  </div>
                </th>
                <th
                  className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider cursor-pointer hover:bg-nuffle-gold/20 transition-colors"
                  onClick={() => handleSort("role")}
                >
                  <div className="flex items-center gap-2">
                    Rôle <SortIcon column="role" />
                  </div>
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Validé
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Statistiques
                </th>
                <th
                  className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider cursor-pointer hover:bg-nuffle-gold/20 transition-colors"
                  onClick={() => handleSort("createdAt")}
                >
                  <div className="flex items-center gap-2">
                    Créé le <SortIcon column="createdAt" />
                  </div>
                </th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                  onClick={() => loadUserDetails(u.id)}
                >
                  <td className="px-6 py-4 font-mono text-xs text-gray-600">
                    {u.email}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {u.name || "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.role === "admin"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.valid
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {u.valid ? "✓ Validé" : "✗ Non validé"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-3 text-xs text-gray-600">
                      <span title="Équipes">⚽ {u._count.teams}</span>
                      <span title="Parties">🎲 {u._count.matches}</span>
                      <span title="Parties créées">➕ {u._count.createdMatches}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(u.createdAt).toLocaleDateString("fr-FR", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2 flex-wrap">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        disabled={actionLoading === u.id}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-nuffle-gold focus:border-nuffle-gold outline-none transition-all bg-white disabled:opacity-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => handleValidChange(u.id, !u.valid)}
                        disabled={actionLoading === u.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors text-xs font-medium ${
                          u.valid
                            ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                            : "bg-green-50 text-green-700 hover:bg-green-100"
                        }`}
                        title={u.valid ? "Invalider le compte" : "Valider le compte"}
                      >
                        <span>{u.valid ? "✗" : "✓"}</span>
                        <span>{u.valid ? "Invalider" : "Valider"}</span>
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.email)}
                        disabled={actionLoading === u.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors text-xs font-medium"
                        title="Supprimer"
                      >
                        <span>{actionLoading === u.id ? "⏳" : "🗑️"}</span>
                        <span>Supprimer</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-between items-center bg-white rounded-xl shadow-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600 font-medium">
            Page {pagination.page} sur {pagination.totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Précédent
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={currentPage === pagination.totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* Modal de détails */}
      {selectedUser && userDetails && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => {
            setSelectedUser(null);
            setUserDetails(null);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-6 max-w-3xl max-h-[90vh] overflow-y-auto w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-heading font-bold text-nuffle-anthracite">
                👤 Détails de l'utilisateur
              </h2>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUserDetails(null);
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Informations</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Email:</span>{" "}
                    <span className="font-mono">{userDetails.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Nom:</span> {userDetails.name || "—"}
                  </div>
                  <div>
                    <span className="text-gray-600">Rôle:</span>{" "}
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        userDetails.role === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {userDetails.role}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Patreon:</span>{" "}
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={userDetails.patreon || false}
                        onChange={(e) => handlePatreonChange(userDetails.id, e.target.checked)}
                        disabled={actionLoading === userDetails.id}
                        className="rounded"
                      />
                      <span className={`text-xs ${userDetails.patreon ? "text-green-700 font-semibold" : "text-gray-600"}`}>
                        {userDetails.patreon ? "Oui" : "Non"}
                      </span>
                    </label>
                  </div>
                  <div>
                    <span className="text-gray-600">Validé:</span>{" "}
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={userDetails.valid || false}
                        onChange={(e) => handleValidChange(userDetails.id, e.target.checked)}
                        disabled={actionLoading === userDetails.id}
                        className="rounded"
                      />
                      <span className={`text-xs ${userDetails.valid ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}`}>
                        {userDetails.valid ? "Oui" : "Non"}
                      </span>
                    </label>
                  </div>
                  <div>
                    <span className="text-gray-600">Créé le:</span>{" "}
                    {new Date(userDetails.createdAt).toLocaleString("fr-FR")}
                  </div>
                  <div>
                    <span className="text-gray-600">Modifié le:</span>{" "}
                    {new Date(userDetails.updatedAt).toLocaleString("fr-FR")}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Statistiques</h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="text-gray-600">Équipes</div>
                    <div className="text-2xl font-bold">{userDetails._count.teams}</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded">
                    <div className="text-gray-600">Parties</div>
                    <div className="text-2xl font-bold">{userDetails._count.matches}</div>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded">
                    <div className="text-gray-600">Parties créées</div>
                    <div className="text-2xl font-bold">{userDetails._count.createdMatches}</div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded">
                    <div className="text-gray-600">Sélections</div>
                    <div className="text-2xl font-bold">{userDetails._count.teamSelections}</div>
                  </div>
                </div>
              </div>

              {userDetails.teams.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Équipes ({userDetails.teams.length})</h3>
                  <div className="border rounded overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-2">Nom</th>
                          <th className="text-left p-2">Roster</th>
                          <th className="text-left p-2">Joueurs</th>
                          <th className="text-left p-2">Créée le</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userDetails.teams.map((team) => (
                          <tr key={team.id} className="odd:bg-white even:bg-gray-50">
                            <td className="p-2">{team.name}</td>
                            <td className="p-2">{team.roster}</td>
                            <td className="p-2">{team._count.players}</td>
                            <td className="p-2 text-xs text-gray-600">
                              {new Date(team.createdAt).toLocaleDateString("fr-FR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {userDetails.createdMatches.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">
                    Dernières parties créées ({userDetails.createdMatches.length})
                  </h3>
                  <div className="border rounded overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-2">ID</th>
                          <th className="text-left p-2">Statut</th>
                          <th className="text-left p-2">Créée le</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userDetails.createdMatches.map((match) => (
                          <tr key={match.id} className="odd:bg-white even:bg-gray-50">
                            <td className="p-2 font-mono text-xs">{match.id}</td>
                            <td className="p-2">
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  match.status === "finished"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {match.status}
                              </span>
                            </td>
                            <td className="p-2 text-xs text-gray-600">
                              {new Date(match.createdAt).toLocaleDateString("fr-FR")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
