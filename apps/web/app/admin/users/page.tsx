"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../auth-client";

type User = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  createdAt: string;
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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
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
        const { users } = await fetchJSON("/admin/users");
        setUsers(users);
      } catch (e: any) {
        setError(e.message || "Erreur");
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Utilisateurs</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
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
    </div>
  );
}
