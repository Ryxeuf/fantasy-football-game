"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../auth-client";

type Match = { id: string; status: string; seed: string; createdAt: string };

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: token ? `Bearer ${token}` : "" } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`);
  return res.json();
}

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
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
        const { matches } = await fetchJSON("/admin/matches");
        setMatches(matches);
      } catch (e: any) {
        setError(e.message || "Erreur");
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Parties</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
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
                <td className="p-2">{new Date(m.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


