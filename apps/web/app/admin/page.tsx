"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../auth-client";

type User = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  createdAt: string;
};
type Match = { id: string; status: string; seed: string; createdAt: string };

type Stats = {
  users: {
    total: number;
    valid: number;
    admins: number;
    pending: number;
  };
  matches: {
    total: number;
  };
  teams: {
    total: number;
  };
  cups: {
    total: number;
    open: number;
    closed: number;
    archived: number;
  };
  recent: {
    users: Array<{ id: string; email: string; coachName: string; createdAt: string }>;
    matches: Array<{ id: string; status: string; createdAt: string }>;
  };
  health: string;
  time: string;
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

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const me = await fetchJSON("/auth/me");
        if (me?.user?.role !== "admin") {
          window.location.href = "/";
          return;
        }
        const [{ users }, { matches }, stats] = await Promise.all([
          fetchJSON("/admin/users?limit=10"),
          fetchJSON("/admin/matches?limit=10"),
          fetchJSON("/admin/stats"),
        ]);
        setUsers(users);
        setMatches(matches);
        setStats(stats);
      } catch (e: any) {
        setError(e.message || "Erreur");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
          📊 Aperçu
        </h1>
        <p className="text-sm text-gray-600">
          Vue d'ensemble de l'administration
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <section id="overview">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Utilisateurs */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
               onClick={() => router.push("/admin/users")}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-blue-700">Utilisateurs</div>
              <span className="text-3xl">👥</span>
            </div>
            <div className="text-4xl font-bold text-blue-900 mb-2">
              {stats?.users.total ?? "—"}
            </div>
            <div className="flex gap-4 text-xs text-blue-600">
              <span>✓ {stats?.users.valid ?? 0} validés</span>
              <span>👑 {stats?.users.admins ?? 0} admins</span>
              {stats && stats.users.pending > 0 && (
                <span className="text-orange-600">⏳ {stats.users.pending} en attente</span>
              )}
            </div>
          </div>

          {/* Parties */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
               onClick={() => router.push("/admin/matches")}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-green-700">Parties</div>
              <span className="text-3xl">🎮</span>
            </div>
            <div className="text-4xl font-bold text-green-900">
              {stats?.matches.total ?? "—"}
            </div>
          </div>

          {/* Équipes */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
               onClick={() => router.push("/admin/users")}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-purple-700">Équipes</div>
              <span className="text-3xl">⚽</span>
            </div>
            <div className="text-4xl font-bold text-purple-900">
              {stats?.teams.total ?? "—"}
            </div>
          </div>

          {/* Coupes */}
          <div className="rounded-xl p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
               onClick={() => router.push("/admin/cups")}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-yellow-700">Coupes</div>
              <span className="text-3xl">🏆</span>
            </div>
            <div className="text-4xl font-bold text-yellow-900 mb-2">
              {stats?.cups.total ?? "—"}
            </div>
            <div className="flex gap-2 text-xs text-yellow-600">
              <span>🟢 {stats?.cups.open ?? 0}</span>
              <span>🔵 {stats?.cups.closed ?? 0}</span>
              <span>🟣 {stats?.cups.archived ?? 0}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-xl font-heading font-semibold text-nuffle-anthracite mb-4">
          🚀 Actions rapides
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => router.push("/admin/users")}
            className="p-4 bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-all text-left hover:bg-blue-50"
          >
            <div className="text-2xl mb-2">👥</div>
            <div className="font-semibold text-gray-900">Gérer les utilisateurs</div>
            <div className="text-xs text-gray-500 mt-1">Voir et modifier les utilisateurs</div>
          </button>
          <button
            onClick={() => router.push("/admin/cups")}
            className="p-4 bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-all text-left hover:bg-yellow-50"
          >
            <div className="text-2xl mb-2">🏆</div>
            <div className="font-semibold text-gray-900">Gérer les coupes</div>
            <div className="text-xs text-gray-500 mt-1">Voir et gérer toutes les coupes</div>
          </button>
          <button
            onClick={() => router.push("/admin/matches")}
            className="p-4 bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-all text-left hover:bg-green-50"
          >
            <div className="text-2xl mb-2">🎮</div>
            <div className="font-semibold text-gray-900">Voir les parties</div>
            <div className="text-xs text-gray-500 mt-1">Consulter toutes les parties</div>
          </button>
          <button
            onClick={() => router.push("/admin/local-matches")}
            className="p-4 bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-all text-left hover:bg-purple-50"
          >
            <div className="text-2xl mb-2">🎯</div>
            <div className="font-semibold text-gray-900">Matchs Locaux</div>
            <div className="text-xs text-gray-500 mt-1">Gérer les parties offline</div>
          </button>
          <button
            onClick={() => router.push("/admin/data/skills")}
            className="p-4 bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-all text-left hover:bg-purple-50"
          >
            <div className="text-2xl mb-2">⚙️</div>
            <div className="font-semibold text-gray-900">Données du jeu</div>
            <div className="text-xs text-gray-500 mt-1">Compétences, rosters, etc.</div>
          </button>
        </div>
      </section>

      {/* Recent Activity */}
      <section>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Users */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-semibold text-nuffle-anthracite">
                👥 Utilisateurs récents
              </h2>
              <button
                onClick={() => router.push("/admin/users")}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Voir tout →
              </button>
            </div>
            {stats?.recent.users && stats.recent.users.length > 0 ? (
              <div className="space-y-3">
                {stats.recent.users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{user.coachName || user.email}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Aucun utilisateur récent</p>
            )}
          </div>

          {/* Recent Matches */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-semibold text-nuffle-anthracite">
                🎮 Parties récentes
              </h2>
              <button
                onClick={() => router.push("/admin/matches")}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Voir tout →
              </button>
            </div>
            {stats?.recent.matches && stats.recent.matches.length > 0 ? (
              <div className="space-y-3">
                {stats.recent.matches.map((match) => (
                  <div
                    key={match.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <div className="font-mono text-xs text-gray-600 mb-1">
                        {match.id.substring(0, 8)}...
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {match.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(match.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Aucune partie récente</p>
            )}
          </div>
        </div>
      </section>

      {/* Users Table */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-heading font-semibold text-nuffle-anthracite">
            👥 Utilisateurs récents
          </h2>
          <button
            onClick={() => router.push("/admin/users")}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Voir tous les utilisateurs →
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-nuffle-gold/10 to-nuffle-gold/5">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                    Rôle
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                    Créé le
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.length > 0 ? (
                  users.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                      onClick={() => router.push(`/admin/users`)}
                    >
                      <td className="px-6 py-4 font-mono text-sm text-gray-600">
                        {u.email}
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {u.name || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(u.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      Aucun utilisateur
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Matches Table */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-heading font-semibold text-nuffle-anthracite">
            🎮 Parties récentes
          </h2>
          <button
            onClick={() => router.push("/admin/matches")}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Voir toutes les parties →
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-nuffle-gold/10 to-nuffle-gold/5">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                    ID
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                    Seed
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-nuffle-anthracite uppercase tracking-wider">
                    Créée le
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {matches.length > 0 ? (
                  matches.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-gray-600">
                        {m.id.substring(0, 12)}...
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {m.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-600">
                        {m.seed}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(m.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      Aucune partie
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
