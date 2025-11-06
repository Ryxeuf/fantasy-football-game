"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../auth-client";

type User = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  createdAt: string;
};
type Match = { id: string; status: string; seed: string; createdAt: string };

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
  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [stats, setStats] = useState<{
    users: number;
    matches: number;
    health: string;
    time: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const me = await fetchJSON("/auth/me");
        if (me?.user?.role !== "admin") {
          window.location.href = "/";
          return;
        }
        const [{ users }, { matches }, stats] = await Promise.all([
          fetchJSON("/admin/users"),
          fetchJSON("/admin/matches"),
          fetchJSON("/admin/stats"),
        ]);
        setUsers(users);
        setMatches(matches);
        setStats(stats);
      } catch (e: any) {
        setError(e.message || "Erreur");
      }
    })();
  }, []);

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
        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-xl p-6 bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-600">Utilisateurs</div>
              <span className="text-2xl">👥</span>
            </div>
            <div className="text-3xl font-bold text-nuffle-anthracite">
              {stats?.users ?? "—"}
            </div>
          </div>
          <div className="rounded-xl p-6 bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-600">Parties</div>
              <span className="text-2xl">🎮</span>
            </div>
            <div className="text-3xl font-bold text-nuffle-anthracite">
              {stats?.matches ?? "—"}
            </div>
          </div>
          <div className="rounded-xl p-6 bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-600">Santé</div>
              <span className="text-2xl">💚</span>
            </div>
            <div className="text-3xl font-bold text-nuffle-anthracite mb-1">
              {stats?.health ?? "—"}
            </div>
            <div className="text-xs text-gray-500">
              {stats?.time ? new Date(stats.time).toLocaleTimeString() : ""}
            </div>
          </div>
        </div>
      </section>

      {/* Users Table */}
      <section>
        <h2 className="text-xl font-heading font-semibold text-nuffle-anthracite mb-4">
          👥 Utilisateurs
        </h2>
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
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-gray-50 transition-colors duration-150"
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Matches Table */}
      <section>
        <h2 className="text-xl font-heading font-semibold text-nuffle-anthracite mb-4">
          🎮 Parties
        </h2>
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
                {matches.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    <td className="px-6 py-4 font-mono text-xs text-gray-600">
                      {m.id}
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
