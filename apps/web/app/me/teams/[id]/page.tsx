"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "../../../auth-client";

async function fetchJSON(path: string) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: token ? `Bearer ${token}` : "" } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || `Erreur ${res.status}`);
  return res.json();
}

export default function TeamDetailPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const id = typeof window !== "undefined" ? window.location.pathname.split("/").pop() : "";

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const me = await fetchJSON("/auth/me");
        if (!me?.user) { window.location.href = "/login"; return; }
        const d = await fetchJSON(`/team/${id}`);
        setData(d);
      } catch (e: any) { setError(e.message || "Erreur"); }
    })();
  }, [id]);

  const team = data?.team;
  const match = data?.currentMatch;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">{team?.name || 'Équipe'}</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {team && (
        <>
          <div className="text-sm text-gray-600">Roster: {team.roster}</div>
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Nom</th>
                  <th className="text-left p-2">Pos</th>
                  <th className="text-left p-2">MA</th><th className="text-left p-2">ST</th><th className="text-left p-2">AG</th><th className="text-left p-2">PA</th><th className="text-left p-2">AV</th>
                  <th className="text-left p-2">Compétences</th>
                </tr>
              </thead>
              <tbody>
                {team.players?.map((p: any) => (
                  <tr key={p.id} className="odd:bg-white even:bg-gray-50">
                    <td className="p-2">{p.number}</td>
                    <td className="p-2">{p.name}</td>
                    <td className="p-2">{p.position}</td>
                    <td className="p-2">{p.ma}</td>
                    <td className="p-2">{p.st}</td>
                    <td className="p-2">{p.ag}</td>
                    <td className="p-2">{p.pa}</td>
                    <td className="p-2">{p.av}</td>
                    <td className="p-2">{p.skills}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {match && (
            <div className="rounded border p-4 bg-white">
              <div className="font-semibold">Partie en cours: {match.id}</div>
              <div className="text-sm text-gray-600">Statut: {match.status} • {new Date(match.createdAt).toLocaleString()}</div>
              <a className="mt-2 inline-block px-3 py-1.5 bg-blue-600 text-white rounded" href="/play">Aller jouer</a>
            </div>
          )}
        </>
      )}
    </div>
  );
}


