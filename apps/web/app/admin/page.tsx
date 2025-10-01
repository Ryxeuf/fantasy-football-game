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
    <>
      <h1 className="text-2xl font-bold">Aperçu</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <section id="overview">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl p-4 bg-white border shadow">
            <div className="text-sm text-gray-500">Utilisateurs</div>
            <div className="text-2xl font-bold">{stats?.users ?? "—"}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border shadow">
            <div className="text-sm text-gray-500">Parties</div>
            <div className="text-2xl font-bold">{stats?.matches ?? "—"}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border shadow">
            <div className="text-sm text-gray-500">Santé</div>
            <div className="text-2xl font-bold">{stats?.health ?? "—"}</div>
            <div className="text-xs text-gray-400">
              {stats?.time ? new Date(stats.time).toLocaleTimeString() : ""}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Utilisateurs</h2>
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Nom</th>
                <th className="text-left p-2">Rôle</th>
                <th className="text-left p-2">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="odd:bg-white even:bg-gray-50">
                  <td className="p-2 font-mono">{u.email}</td>
                  <td className="p-2">{u.name || "—"}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2">
                    {new Date(u.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Parties</h2>
        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">ID</th>
                <th className="text-left p-2">Statut</th>
                <th className="text-left p-2">Seed</th>
                <th className="text-left p-2">Créée le</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.id} className="odd:bg-white even:bg-gray-50">
                  <td className="p-2 font-mono">{m.id}</td>
                  <td className="p-2">{m.status}</td>
                  <td className="p-2 font-mono">{m.seed}</td>
                  <td className="p-2">
                    {new Date(m.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
